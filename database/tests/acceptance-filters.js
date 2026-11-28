import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { acceptanceGuard } from './acceptance-guard.js';

// Read-only oracle: derive results from raw BSON documents, not UI/API output.
const { client, db, base, database } = await acceptanceGuard();
const checks = [];
const output = process.env.ACCEPTANCE_EVIDENCE_DIR;
assert(output, 'External ACCEPTANCE_EVIDENCE_DIR required');
const names = ['customers','movies','rooms','showtimes','showtime_seats','bookings'];
try {
  const docs = Object.fromEntries(await Promise.all(names.map(async n => [n, await db.collection(n).find({}).toArray()])));
  async function get(route, status = 200) {
    const r = await fetch(base + route); assert.equal(r.status, status, route); return r.json();
  }
  const b = docs.bookings;
  const cases = [{}, {bookingId:b[0]._id}, {bookingId:'NOT-FOUND'}, ...docs.customers.map(c=>({customerId:c._id})), ...docs.movies.map(m=>({movieId:m._id})), ...docs.showtimes.map(s=>({showtimeId:s._id})), ...['CONFIRMED','CANCELLED','PENDING'].map(status=>({status}))];
  for (const x of b.slice(0, 15)) {
    const local = new Date(x.createdAt.getTime()+7*3600000).toISOString().slice(0,10);
    const from = new Date(local+'T00:00:00+07:00'), to = new Date(from.getTime()+86400000);
    cases.push({from:from.toISOString(),to:to.toISOString()}, {customerId:x.customerId,movieId:x.movieId,status:x.status,from:from.toISOString(),to:to.toISOString()});
  }
  cases.push({customerId:'CUS050',status:'CONFIRMED',movieId:'MV012'}, {from:'2099-01-01T00:00:00+07:00'}, {to:'2000-01-01T00:00:00+07:00'});
  for(const f of cases) for(const sort of ['asc','desc']) {
    const expected = b.filter(x=> (!f.bookingId || x._id===f.bookingId) && (!f.customerId || x.customerId===f.customerId) && (!f.movieId || x.movieId===f.movieId) && (!f.showtimeId || x.showtimeId===f.showtimeId) && (!f.status || x.status===f.status) && (!f.from || x.createdAt>=new Date(f.from)) && (!f.to || x.createdAt<new Date(f.to)))
      .sort((x,y)=>(sort==='asc'?1:-1)*(x.createdAt-y.createdAt || (x._id<y._id?-1:x._id>y._id?1:0))).map(x=>x._id);
    const actual = [];
    const pages = Math.max(1,Math.ceil(expected.length/7));
    for(let page=1;page<=pages;page++) {
      const q = new URLSearchParams({...f,sort,page,pageSize:7});
      const r = await get('/api/admin/bookings?'+q);
      assert.equal(r.total, expected.length, String(q)); assert.equal(r.page,page); assert.equal(r.totalPages,Math.ceil(expected.length/7));
      actual.push(...r.items.map(x=>x._id));
    }
    assert.deepEqual(actual,expected,JSON.stringify({f,sort}));
    assert.equal(new Set(actual).size,actual.length);
    checks.push({filter:f,sort,expectedIds:expected,actualIds:actual,count:expected.length,pass:true});
  }
  for (const q of ['page=0','page=-1','page=1.5','page=NaN','pageSize=101','pageSize=0','sort=bad','status=bad','from=bad','from=2026-11-29&to=2026-11-28','customerId[$ne]=CUS001','page=1&page=2']) {
    await get('/api/admin/bookings?'+q,400); checks.push({invalidQuery:q,pass:true});
  }
  for(const q of ['[', '.*', 'khach01@cinema.test', 'CUS001']) {
    const expected=docs.customers.filter(c=>[c._id,c.fullName,c.email].some(v=>v.toLowerCase().includes(q.toLowerCase()))).map(c=>c._id).sort();
    const actual=(await get('/api/admin/customers?q='+encodeURIComponent(q))).map(c=>c._id).sort();
    assert.deepEqual(actual,expected); checks.push({customerSearch:q,expectedIds:expected,actualIds:actual,pass:true});
  }
  const r=await get('/api/admin/bookings?page=99999&pageSize=7'); assert.deepEqual(r.items,[]);
  for (const date of ['2026-02-30','2026-02-29','2026-13-01']) {
    await get('/api/admin/bookings?page=1&from='+date,400); checks.push({invalidCalendarDate:date,pass:true});
  }
  for(const c of docs.customers) {
    const expected=b.filter(x=>x.customerId===c._id).sort((x,y)=>y.createdAt-x.createdAt||(x._id<y._id?1:-1)).map(x=>x._id);
    const rows=await get(`/api/customers/${c._id}/bookings/details`);
    assert.deepEqual(rows.map(x=>x._id),expected);
    for(const x of rows) assert.equal(x.roomName,docs.rooms.find(r=>r._id===docs.showtimes.find(s=>s._id===x.showtimeId).roomId).name);
    checks.push({historyCustomer:c._id,expectedIds:expected,actualIds:rows.map(x=>x._id),pass:true});
  }
  console.log(JSON.stringify({database,passed:checks.length,failed:0}));
} finally {
  await client.close(); await mkdir(output,{recursive:true});
  await writeFile(output+'/filter-oracle.json',JSON.stringify({database,checks},null,2));
}
