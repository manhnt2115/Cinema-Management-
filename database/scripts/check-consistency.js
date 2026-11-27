import { createClient, dbName, collectionCounts } from './config.js';
import { validators } from './schema.js';

const client=createClient(); let failed=false;
const countAgg=async(col,p)=>((await col.aggregate([...p,{$count:'n'}]).toArray())[0]?.n||0);
try{
 await client.connect();const db=client.db(dbName),now=new Date();const c=Object.fromEntries(['customers','movies','rooms','showtimes','showtime_seats','bookings'].map(n=>[n,db.collection(n)]));
 const [rooms,showtimes,seats,bookings]=await Promise.all([c.rooms.find({}).toArray(),c.showtimes.find({}).toArray(),c.showtime_seats.find({}).toArray(),c.bookings.find({}).toArray()]);
 const roomMap=new Map(rooms.map(x=>[x._id,new Set((x.seats||[]).map(s=>s.code))])),showMap=new Map(showtimes.map(x=>[x._id,x]));
 const issues={
  bookingMissingCustomer:await countAgg(c.bookings,[{$lookup:{from:'customers',localField:'customerId',foreignField:'_id',as:'x'}},{$match:{x:{$size:0}}}]),
  bookingMissingMovie:await countAgg(c.bookings,[{$lookup:{from:'movies',localField:'movieId',foreignField:'_id',as:'x'}},{$match:{x:{$size:0}}}]),
  bookingMissingShowtime:await countAgg(c.bookings,[{$lookup:{from:'showtimes',localField:'showtimeId',foreignField:'_id',as:'x'}},{$match:{x:{$size:0}}}]),
  showtimeMissingMovie:await countAgg(c.showtimes,[{$lookup:{from:'movies',localField:'movieId',foreignField:'_id',as:'x'}},{$match:{x:{$size:0}}}]),
  showtimeMissingRoom:await countAgg(c.showtimes,[{$lookup:{from:'rooms',localField:'roomId',foreignField:'_id',as:'x'}},{$match:{x:{$size:0}}}]),
  incorrectTotals:bookings.filter(b=>b.totalAmountVnd!==(b.seats||[]).reduce((n,x)=>n+x.unitPriceVnd,0)).length,
  paymentMismatch:bookings.filter(b=>(b.status==='CONFIRMED'&&(b.payment?.status!=='SUCCESS'||!(b.payment?.paidAt instanceof Date)))||(b.status==='CANCELLED'&&!((b.payment?.status==='FAILED'&&!b.cancellation)||(b.payment?.status==='SUCCESS'&&b.cancellation?.reason==='CUSTOMER_REQUEST'&&b.cancellation?.refund?.status==='SUCCESS')))).length,
  seatNotInRoom:seats.filter(x=>{const s=showMap.get(x.showtimeId);return !s||!roomMap.get(s.roomId)?.has(x.seatCode)}).length,
  staleHeld:seats.filter(x=>x.status==='HELD'&&(!x.holdExpiresAt||x.holdExpiresAt<now)).length
 };
 const seatGroups=new Map();for(const s of seats){const k=s.showtimeId;seatGroups.set(k,(seatGroups.get(k)||[]).concat(s));}
 issues.missingOrDuplicateSeats=0;for(const s of showtimes){const expected=roomMap.get(s.roomId)||new Set(),actual=seatGroups.get(s._id)||[];if(actual.length!==expected.size||new Set(actual.map(x=>x.seatCode)).size!==actual.length)issues.missingOrDuplicateSeats++;}
 issues.overlappingShowtimes=0;for(let i=0;i<showtimes.length;i++)for(let j=i+1;j<showtimes.length;j++){const a=showtimes[i],b=showtimes[j];if(a.roomId===b.roomId&&a.startAt<b.endAt&&b.startAt<a.endAt)issues.overlappingShowtimes++;}
 const bookingMap=new Map(bookings.map(x=>[x._id,x]));issues.bookedWithoutValidBooking=seats.filter(s=>{if(s.status!=='BOOKED')return false;const b=bookingMap.get(s.bookingId);return !b||b.status!=='CONFIRMED'||b.showtimeId!==s.showtimeId||!b.seats.some(x=>x.seatCode===s.seatCode)}).length;
 issues.cancelledOwnsSeats=seats.filter(s=>s.bookingId&&bookingMap.get(s.bookingId)?.status==='CANCELLED').length;
 issues.confirmedSeatMismatch=bookings.filter(b=>b.status==='CONFIRMED'&&b.seats.some(x=>!seats.some(s=>s.showtimeId===b.showtimeId&&s.seatCode===x.seatCode&&s.status==='BOOKED'&&s.bookingId===b._id))).length;
 const schemaProblems={};for(const [name,validator] of Object.entries(validators)){const r=await db.command({aggregate:name,pipeline:[{$match:{$nor:[validator]}},{$count:'n'}],cursor:{}});schemaProblems[name]=r.cursor.firstBatch[0]?.n||0;}
 const distributions={bookingStatus:await c.bookings.aggregate([{$group:{_id:'$status',count:{$sum:1}}},{$sort:{_id:1}}]).toArray(),seatStatus:await c.showtime_seats.aggregate([{$group:{_id:'$status',count:{$sum:1}}},{$sort:{_id:1}}]).toArray(),showtimes:{past:await c.showtimes.countDocuments({endAt:{$lt:now}}),current:await c.showtimes.countDocuments({startAt:{$lte:now},endAt:{$gte:now}}),future:await c.showtimes.countDocuments({startAt:{$gt:now}}),bookable:await c.showtimes.countDocuments({status:'OPEN',startAt:{$gt:now}})}};
 failed=Object.values(issues).some(Boolean)||Object.values(schemaProblems).some(Boolean);console.log(JSON.stringify({database:dbName,counts:await collectionCounts(db),issues,schemaProblems,distributions,ok:!failed},null,2));
}catch(error){failed=true;console.error(error.stack||error.message);}finally{await client.close();}if(failed)process.exitCode=1;
