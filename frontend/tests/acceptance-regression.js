import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { acceptanceGuard } from '../../database/tests/acceptance-guard.js';

const { client, db, base } = await acceptanceGuard({ write: process.env.ACCEPTANCE_READ_ONLY !== '1' });
const web = process.env.TEST_WEB_BASE_URL || 'http://127.0.0.1:5173/';
const root = process.env.ACCEPTANCE_EVIDENCE_DIR;
assert(root, 'External evidence directory required');
await mkdir(root,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const records=[], errors=[], network=[];
const record=(name,expected,actual)=> { assert.deepEqual(actual,expected,name); records.push({name,expected,actual,pass:true}); };
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
const idCompare=(a,b)=>a._id.localeCompare(b._id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const page=await browser.newPage({viewport:{width:1440,height:900}});
function watch(p) {
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=> { if(r.url().includes('/api/')) network.push({method:r.request().method(),url:r.url(),status:r.status()}); });
}
async function enforceApi(p) {
  await p.route('**/api/**',route=>{
    const target=new URL(route.request().url()), expected=new URL(base);
    if(!target.pathname.startsWith('/api/')) return route.continue();
    if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!==expected.port) {
      errors.push('API target mismatch: request blocked'); return route.abort();
    }
    return route.continue();
  });
}
watch(page);
await enforceApi(page);
async function open(hash, selector) {
  await page.goto(web+hash);
  await page.locator(selector).first().waitFor();
}
async function untilIds(selector,attr,expected) {
  let ids;
  for(let i=0;i<70;i++) {
    ids=await page.locator(selector).evaluateAll((els,attr)=>els.map(e=>e.getAttribute(attr)),attr);
    if(JSON.stringify(ids)===JSON.stringify(expected)) return ids;
    await sleep(50);
  }
  assert.deepEqual(ids,expected,selector); return ids;
}
try {
  const [movies,customers,shows,bookings]=await Promise.all(['movies','customers','showtimes','bookings'].map(n=>db.collection(n).find({}).toArray()));
  await open('#/movies','#movie-filters');
  // All genres and statuses, empty/no-accent/case/trim searches, AND and both sorts.
  const genres=['',...new Set(movies.flatMap(m=>m.genres))];
  const cases=[...genres.flatMap(genre=>['','NOW_SHOWING','COMING_SOON'].map(status=>({q:'',genre,status}))), ...['  BI MAT  ','  hành TRÌNH  ','[','zzzzzz','   '].map(q=>({q,genre:'',status:''}))];
  for(const f of cases) for(const sort of ['asc','desc']) {
    await page.locator('#movie-filters [name=q]').fill(f.q);
    for(const k of ['genre','status']) await page.locator(`#movie-filters [name=${k}]`).selectOption(f[k]);
    await page.locator('#movie-filters [name=sort]').selectOption(sort);
    const expected=movies.filter(m=>normalize(m.title).includes(normalize(f.q))&&(!f.genre||m.genres.includes(f.genre))&&(!f.status||m.status===f.status)).sort((a,b)=>(sort==='asc'?1:-1)*(a.title.localeCompare(b.title,'vi')||idCompare(a,b))).map(m=>'#/movies/'+encodeURIComponent(m._id));
    record('UI phim '+JSON.stringify({...f,sort}),expected,await untilIds('#movie-results .catalog-card','href',expected));
  }
  await page.screenshot({path:root+'/movie-filters.png'});
  await page.getByRole('button',{name:'Xóa bộ lọc'}).click();
  const first=page.locator('#movie-results .catalog-card').first();
  const target=await first.getAttribute('href');
  await first.focus(); await page.keyboard.press('Enter'); await page.waitForURL('**/'+target);
  record('Enter mở thẻ phim',target,new URL(page.url()).hash);
  await open('#/admin/customers','#admin-filters');
  for(const q of ['CUS001','khach01@cinema.test','  KHACH HANG DEMO 01  ','[','zzzz']) {
    await page.locator('#admin-filters [name=q]').fill(q);
    const expected=customers.filter(c=>normalize(`${c._id} ${c.fullName} ${c.email}`).includes(normalize(q))).sort((a,b)=>a.fullName.localeCompare(b.fullName,'vi')||idCompare(a,b)).slice(0,10).map(c=>c._id);
    record('UI khách '+q,expected,await untilIds('[data-customer]','data-customer',expected));
  }
  await open('#/admin/bookings','#admin-filters');
  await page.locator('[data-booking]').first().waitFor();
  // Fetch real responses, deliberately deliver the older response last.
  await page.route('**/api/admin/bookings?**',async route=>{
    const r=await route.fetch();
    const status=new URL(route.request().url()).searchParams.get('status');
    await sleep(status==='CANCELLED'?1000:60);
    await route.fulfill({response:r});
  });
  await page.locator('#admin-filters [name=status]').selectOption('CANCELLED');
  await sleep(90);
  await page.locator('#admin-filters [name=status]').selectOption('CONFIRMED');
  const expected=bookings.filter(b=>b.status==='CONFIRMED').sort((a,b)=>b.createdAt-a.createdAt||b._id.localeCompare(a._id)).slice(0,10).map(b=>b._id);
  await untilIds('[data-booking]','data-booking',expected); await sleep(1200);
  record('Phản hồi cũ không ghi đè bộ lọc mới',expected,await untilIds('[data-booking]','data-booking',expected));
  await page.unroute('**/api/admin/bookings?**');
  await page.screenshot({path:root+'/bookings-race.png'});
  // Rapid first-load navigation while catalog calls are still in flight.
  await page.route('**/api/catalog/movies',async route=>{await sleep(600); await route.continue();});
  await page.goto(web+'#/',{waitUntil:'commit'});
  await page.evaluate(()=>{location.hash='#/help';});
  await page.getByRole('heading',{name:'Hướng dẫn sử dụng'}).waitFor(); await sleep(800);
  record('Điều hướng lần mở đầu không bị bootstrap ghi đè','#/help',new URL(page.url()).hash);
  await page.unroute('**/api/catalog/movies');
  if(process.env.ACCEPTANCE_READ_ONLY!=='1') {
    const show=shows.find(s=>s.status==='OPEN'&&s.startAt>new Date()); assert(show);
    const seat=await db.collection('showtime_seats').findOne({showtimeId:show._id,status:'AVAILABLE'}); assert(seat);
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    const competitors=await Promise.all(contexts.map(c=>c.newPage()));
    for(let i=0;i<2;i++) {
      const p=competitors[i]; watch(p); await enforceApi(p);
      await p.goto(web+'#/booking/'+show._id); await p.locator('[data-seat]').first().waitFor();
      await p.locator('.profile-button').click(); await p.locator(`[data-profile=CUS04${8+i}]`).click();
      await p.locator(`[data-seat="${seat.seatCode}"]`).waitFor();
      await p.locator(`[data-seat="${seat.seatCode}"]`).click(); await p.locator('#continue-booking').click(); await p.locator('#pay-button').waitFor();
    }
    const before=await db.collection('bookings').countDocuments({});
    const outcomes=competitors.map(p=>p.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/bookings')));
    await Promise.all(competitors.map(p=>p.locator('#pay-button').click()));
    const responses=await Promise.all(outcomes);
    record('Hai browser độc lập tranh ghế',[201,409],responses.map(r=>r.status()).sort());
    record('Không tạo booking dư',before+1,await db.collection('bookings').countDocuments({}));
    const saved=await db.collection('showtime_seats').findOne({_id:seat._id});
    const winner=await db.collection('bookings').findOne({_id:saved.bookingId});
    record('Chủ ghế khớp booking',[show._id,seat.seatCode,'CONFIRMED'],[winner.showtimeId,winner.seats[0].seatCode,winner.status]);
    for(let i=0;i<2;i++) await competitors[i].screenshot({path:root+`/competition-${responses[i].status()}.png`});
    const loser=competitors[responses.findIndex(r=>r.status()===409)];
    await loser.locator('#checkout-error').waitFor(); assert((await loser.locator('#checkout-error').innerText()).length>0);
    // Same document customer -> admin must reload analytics after mutation.
    await page.evaluate(()=>{location.hash='#/admin/dashboard';});
    await page.locator('.metric-card strong').first().waitFor();
    const total=await db.collection('bookings').countDocuments({});
    record('Dashboard làm mới sau đặt vé',String(total),await page.locator('.metric-card strong').first().innerText());
    await page.screenshot({path:root+'/dashboard-after-booking.png'});
    await Promise.all(contexts.map(c=>c.close()));
  }
  record('Không lỗi JavaScript',[],errors);
  console.log(JSON.stringify({passed:records.length,failed:0}));
} catch(e) {
  await page.screenshot({path:root+'/failure.png'}).catch(()=>{});
  records.push({name:'Unhandled failure',pass:false,error:e.stack}); throw e;
} finally {
  await writeFile(root+'/regression-results.json',JSON.stringify({records,errors,network},null,2));
  await browser.close(); await client.close();
}
