import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { acceptanceGuard } from './acceptance-guard.js';
const {client,db,base}=await acceptanceGuard({write:true});
const root=process.env.ACCEPTANCE_EVIDENCE_DIR;assert(root);
const results=[];
try {
 const show=await db.collection('showtimes').findOne({startAt:{$gt:new Date('2026-11-29')},status:'OPEN'});assert(show);
 const seat=await db.collection('showtime_seats').findOne({showtimeId:show._id});assert(seat);
 const ids=['ACCEPTANCE-DATE-BEFORE','ACCEPTANCE-DATE-START','ACCEPTANCE-DATE-END','ACCEPTANCE-DATE-AFTER'];
 assert.equal(await db.collection('bookings').countDocuments({_id:{$in:ids}}),0,'Run once before reset');
 const times=['2026-11-26T16:59:59.999Z','2026-11-26T17:00:00.000Z','2026-11-27T16:59:59.999Z','2026-11-27T17:00:00.000Z'];
 const docs=ids.map((_id,i)=>({_id,customerId:'CUS050',showtimeId:show._id,movieId:show.movieId,seats:[{seatCode:seat.seatCode,unitPriceVnd:show.basePriceVnd}],totalAmountVnd:show.basePriceVnd,status:'CANCELLED',payment:{method:'SIMULATED',status:'FAILED',paidAt:null},createdAt:new Date(times[i])}));
 await db.collection('bookings').insertMany(docs);
 const filter={customerId:'CUS050',from:'2026-11-27T00:00:00+07:00',to:'2026-11-28T00:00:00+07:00',sort:'asc',page:'1',pageSize:'100'};
 const raw=await db.collection('bookings').find({customerId:'CUS050'}).toArray();
 const expected=raw.filter(b=>b.createdAt>=new Date(filter.from)&&b.createdAt<new Date(filter.to)).sort((a,b)=>a.createdAt-b.createdAt||a._id.localeCompare(b._id)).map(b=>b._id);
 const response=await fetch(base+'/api/admin/bookings?'+new URLSearchParams(filter));assert.equal(response.status,200);
 const actual=(await response.json()).items.map(b=>b._id);
 assert.deepEqual(actual,expected);
 assert(actual.includes(ids[1])&&actual.includes(ids[2])&&!actual.includes(ids[0])&&!actual.includes(ids[3]));
 results.push({name:'Vietnam midnight [from,to) millisecond boundaries',filter,fixtures:docs,expectedIds:expected,actualIds:actual,pass:true});
 console.log(JSON.stringify({passed:1,failed:0}));
}finally{await mkdir(root,{recursive:true});await writeFile(root+'/date-boundaries.json',JSON.stringify(results,null,2));await client.close();}
