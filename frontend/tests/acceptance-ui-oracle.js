import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { acceptanceGuard } from '../../database/tests/acceptance-guard.js';
const {client,db}=await acceptanceGuard();
const root=process.env.ACCEPTANCE_EVIDENCE_DIR; assert(root);
await mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const records=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Enforce read-only even if a view accidentally issues an unsafe request.
await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
const cmp=(a,b)=>a._id.localeCompare(b._id);
const day=x=>new Date(x).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
const web=process.env.TEST_WEB_BASE_URL||'http://127.0.0.1:5173/';
async function open(hash) {await page.goto(web+hash);await page.locator('#admin-filters').waitFor();}
async function apply(f) {
  for(const [key,value] of Object.entries(f)) {
    const input=page.locator(`#admin-filters [name=${key}]`);
    if(await input.evaluate(e=>e.tagName)==='SELECT') await input.selectOption(value);
    else {await input.fill(value);await input.dispatchEvent('change');}
  }
  await pause(350);
}
async function ids(attr) {return page.locator(`[${attr}]`).evaluateAll((els,a)=>els.map(e=>e.getAttribute(a)),attr);}
async function collect(attr,expected,name) {
  const actual=[]; let n=0;
  do {
    await page.getByText('Đang tải đơn đặt vé…',{exact:true}).waitFor({state:'hidden'});
    await pause(70); actual.push(...await ids(attr));
    const next=page.locator('.pagination button').last();
    if(!await next.count()||await next.isDisabled())break;
    await next.click();if(++n>100)throw Error('Pagination loop');
  } while(true);
  assert.deepEqual(actual,expected,name);
  assert.equal(new Set(actual).size,actual.length);
  records.push({name,expectedIds:expected,actualIds:actual,count:actual.length,pass:true});
}
try {
 const [movies,shows,customers,bookings]=await Promise.all(['movies','showtimes','customers','bookings'].map(n=>db.collection(n).find({}).toArray()));
 await open('#/admin/movies');
 const movieCases=[...['','NOW_SHOWING','COMING_SOON'].flatMap(status=>['','Gia đình','Tâm lý'].map(genre=>({q:'',status,genre}))),...[' BI MAT ','[','   ','zzzzz'].map(q=>({q,status:'',genre:''}))];
 for(const f of movieCases)for(const sort of ['asc','desc']) {
  await apply({...f,sort});
  const expected=movies.filter(m=>norm(m.title).includes(norm(f.q))&&(!f.status||m.status===f.status)&&(!f.genre||m.genres.includes(f.genre))).sort((a,b)=>(sort==='desc'?-1:1)*(a.title.localeCompare(b.title,'vi')||cmp(a,b))).map(m=>m._id);
  await collect('data-edit-movie',expected,'Admin phim '+JSON.stringify({...f,sort}));
 }
 await page.screenshot({path:root+'/admin-movies-filter.png'});
 await page.getByRole('button',{name:'Xóa bộ lọc'}).click();
 await pause(100);
 await collect('data-edit-movie',[...movies].sort((a,b)=>a.title.localeCompare(b.title,'vi')||cmp(a,b)).map(m=>m._id),'Xóa bộ lọc quản trị sau render');
 await open('#/admin/showtimes');
 const showCases=[{q:'',room:'',day:'',status:''},...['ROOM001','ROOM002','ROOM003'].flatMap(room=>['','OPEN','CLOSED'].map(status=>({q:'',room,day:'',status}))),...shows.slice(0,8).map(s=>({q:'',room:s.roomId,day:day(s.startAt),status:s.status})),{q:'  BI MAT ',room:'',day:'',status:''},{q:'zzzz',room:'',day:'',status:''}];
 for(const f of showCases)for(const sort of ['asc','desc']) {
  await apply({...f,sort});
  const expected=shows.filter(s=>norm(movies.find(m=>m._id===s.movieId).title).includes(norm(f.q))&&(!f.room||s.roomId===f.room)&&(!f.day||day(s.startAt)===f.day)&&(!f.status||s.status===f.status)).sort((a,b)=>(sort==='desc'?-1:1)*(a.startAt-b.startAt||cmp(a,b))).map(s=>s._id);
  await collect('data-show-detail',expected,'Admin suất '+JSON.stringify({...f,sort}));
 }
 await page.screenshot({path:root+'/admin-showtimes-filter.png'});
 await open('#/admin/customers');
 for(const sort of ['name','count']) {
  await apply({q:'',sort});
  const counts=new Map(customers.map(c=>[c._id,bookings.filter(b=>b.customerId===c._id).length]));
  const expected=[...customers].sort((a,b)=>sort==='count'?counts.get(b._id)-counts.get(a._id)||cmp(a,b):a.fullName.localeCompare(b.fullName,'vi')||cmp(a,b)).map(c=>c._id);
  await collect('data-customer',expected,'Khách hàng mọi trang '+sort);
 }
 await open('#/admin/bookings');
 for(const f of [
  {bookingId:'',customerId:'',movieId:'',showtimeId:'',status:'',from:'',to:'',sort:'desc'},
  {bookingId:'',customerId:'CUS001',movieId:'',showtimeId:'',status:'CONFIRMED',from:'',to:'',sort:'asc'},
  {bookingId:'',customerId:'',movieId:'MV002',showtimeId:'',status:'CANCELLED',from:'',to:'',sort:'desc'},
  {bookingId:'',customerId:'CUS050',movieId:'MV012',showtimeId:'',status:'CONFIRMED',from:'',to:'',sort:'desc'},
  {bookingId:'NOT-FOUND',customerId:'',movieId:'',showtimeId:'',status:'',from:'',to:'',sort:'desc'},
  {bookingId:'',customerId:'',movieId:'',showtimeId:'ST028',status:'',from:'2026-11-01',to:'2026-11-28',sort:'asc'}
 ]) {
  await apply(f);
  const expected=bookings.filter(b=>(!f.bookingId||b._id===f.bookingId)&&(!f.customerId||b.customerId===f.customerId)&&(!f.movieId||b.movieId===f.movieId)&&(!f.showtimeId||b.showtimeId===f.showtimeId)&&(!f.status||b.status===f.status)&&(!f.from||day(b.createdAt)>=f.from)&&(!f.to||day(b.createdAt)<=f.to)).sort((a,b)=>(f.sort==='asc'?1:-1)*(a.createdAt-b.createdAt||cmp(a,b))).map(b=>b._id);
  await collect('data-booking',expected,'Admin đơn '+JSON.stringify(f));
 }
 await page.goto(web+'#/schedule');await page.locator('#schedule-filters').waitFor();
 for(const d of [...new Set(shows.map(s=>day(s.startAt)))])for(const movie of ['',...movies.map(m=>m._id)]) {
  await page.locator('#schedule-filters [name=day]').fill(d);await page.locator('#schedule-filters [name=day]').dispatchEvent('change');
  await page.locator('#schedule-filters [name=movie]').selectOption(movie);
  const items=shows.filter(s=>day(s.startAt)===d&&(!movie||s.movieId===movie)).sort((a,b)=>a.startAt-b.startAt||cmp(a,b));
  const groups=[...new Set(items.map(s=>s.movieId))];
  const expected=groups.flatMap(id=>items.filter(s=>s.movieId===id)).map(s=>s.status==='OPEN'&&s.startAt>new Date()&&movies.find(m=>m._id===s.movieId).status==='NOW_SHOWING'?'#/booking/'+s._id:null);
  const actual=await page.locator('#schedule-results .showtime-card').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
  assert.deepEqual(actual,expected);records.push({name:'Lịch chiếu '+JSON.stringify({day:d,movie}),expectedLinks:expected,actualLinks:actual,pass:true});
 }
 await page.screenshot({path:root+'/schedule-filter.png'});
 await page.goto(web+'#/my-tickets');await page.locator('#ticket-filters').waitFor();
 const now=new Date();
 for(const group of ['upcoming','history','cancelled','all']) for(const status of ['','CONFIRMED','CANCELLED','PENDING'])for(const sort of ['asc','desc']) {
  await page.locator('#ticket-filters [name=group]').selectOption(group);
  await page.locator('#ticket-filters [name=status]').selectOption(status);
  await page.locator('#ticket-filters [name=sort]').selectOption(sort);
  const expected=bookings.filter(b=>b.customerId==='CUS001'&&(!status||b.status===status)&&(group==='all'||(group==='upcoming'?b.status==='CONFIRMED'&&shows.find(s=>s._id===b.showtimeId).startAt>now:group==='cancelled'?b.status==='CANCELLED':b.status!=='CANCELLED'&&shows.find(s=>s._id===b.showtimeId).startAt<=now))).sort((a,b)=>(sort==='asc'?1:-1)*(a.createdAt-b.createdAt||cmp(a,b))).map(b=>b._id);
  const actual=[];
  do {
   actual.push(...await page.locator('.ticket-summary > a:first-child').evaluateAll(els=>els.map(e=>decodeURIComponent(e.getAttribute('href').split('/').at(-1)))));
   const next=page.locator('#tickets-next');if(!await next.count()||await next.isDisabled())break;await next.click();
  }while(true);
  assert.deepEqual(actual,expected,JSON.stringify({group,status,sort}));records.push({name:'Vé CUS001 '+JSON.stringify({group,status,sort}),expectedIds:expected,actualIds:actual,pass:true});
 }
 await page.screenshot({path:root+'/ticket-filter.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:records.length,failed:0}));
}catch(e){records.push({pass:false,error:e.stack});await page.screenshot({path:root+'/oracle-failure.png'});throw e;}
finally{await writeFile(root+'/ui-oracle-results.json',JSON.stringify({records,errors},null,2));await browser.close();await client.close();}
