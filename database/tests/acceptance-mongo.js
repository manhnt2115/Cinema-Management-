import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { acceptanceGuard } from './acceptance-guard.js';
const {client,db}=await acceptanceGuard({write:true});
const output=process.env.ACCEPTANCE_EVIDENCE_DIR;assert(output);
const results=[];
try {
 const names=['customers','movies','rooms','showtimes','showtime_seats','bookings'];
 assert.deepEqual((await db.listCollections().toArray()).map(x=>x.name).sort(),[...names].sort());
 const fixtures=Object.fromEntries(await Promise.all(names.map(async n=>[n,await db.collection(n).findOne({})])));
 const cases=[
  ['customers','email','invalid'],['customers','createdAt','2026-11-28'],['customers','fullName',''],
  ['movies','durationMinutes',1.5],['movies','durationMinutes',0],['movies','durationMinutes',601],['movies','genres',[]],['movies','genres',['A','A']],['movies','genres',['x'.repeat(61)]],['movies','status','INVALID'],
  ['rooms','seats',[]],['rooms','seats',[{code:'A1',row:'A',number:'1',type:'STANDARD'}]],
  ['showtimes','basePriceVnd',-1],['showtimes','startAt','2026-11-28'],['showtimes','status','INVALID'],
  ['showtime_seats','status','INVALID'],['showtime_seats','bookingId',42],['showtime_seats','holdExpiresAt','2026-11-28'],
  ['bookings','totalAmountVnd',-1],['bookings','seats',[]],['bookings','createdAt','2026-11-28'],['bookings','status','INVALID'],['bookings','payment',{method:'CARD',status:'SUCCESS',paidAt:new Date()}]
 ];
 for(const n of names)cases.push([n,'_id',null]);
 for(const [n,field,value] of cases) {
  const id='ACCEPTANCE-REJECT-'+results.length;
  const doc={...structuredClone(fixtures[n]),_id:id,[field]:value};
  let code,message,details;
  try {await db.collection(n).insertOne(doc);}catch(e){code=e.code;message=e.message;details=e.errInfo;}
  if(code!==121) {await db.collection(n).deleteOne({_id:doc._id});}
  assert.equal(code,121,`${n}.${field}`);results.push({collection:n,field,expectedCode:121,actualCode:code,message,details,pass:true});
 }
 for(const n of ['customers','showtime_seats']) {
  const id='ACCEPTANCE-UNIQUE-'+n;
  let code,message,keyPattern;
  try {await db.collection(n).insertOne({...structuredClone(fixtures[n]),_id:id});}catch(e){code=e.code;message=e.message;keyPattern=e.keyPattern;}
  if(code!==11000)await db.collection(n).deleteOne({_id:id});
  assert.equal(code,11000,n);results.push({collection:n,expectedCode:11000,actualCode:code,message,keyPattern,pass:true});
 }
 console.log(JSON.stringify({passed:results.length,failed:0}));
}finally{await mkdir(output,{recursive:true});await writeFile(output+'/mongo-rejections.json',JSON.stringify(results,null,2));await client.close();}
