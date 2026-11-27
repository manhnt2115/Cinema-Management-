import { assertWritableTarget, createClient, dbName } from './config.js';
import { ensureCollectionsAndValidators } from './schema.js';

assertWritableTarget({allowQa:true});const client=createClient();
const valid={
 customers:{_id:'VALID-CUS',fullName:'Khách Hợp Lệ',email:'valid@qa.test',createdAt:new Date()},
 movies:{_id:'VALID-MV',title:'Phim Hợp Lệ',genres:['Demo'],durationMinutes:100,status:'NOW_SHOWING',synopsis:'Dữ liệu QA.'},
 rooms:{_id:'VALID-ROOM',name:'Phòng QA',seats:[{code:'A1',row:'A',number:1,type:'STANDARD'}]},
 showtimes:{_id:'VALID-ST',movieId:'VALID-MV',roomId:'VALID-ROOM',startAt:new Date(Date.now()+86400000),endAt:new Date(Date.now()+90000000),basePriceVnd:80000,status:'OPEN'},
 showtime_seats:{_id:'VALID-ST_A1',showtimeId:'VALID-ST',seatCode:'A1',status:'AVAILABLE',bookingId:null,holdExpiresAt:null},
 bookings:{_id:'VALID-BK',customerId:'VALID-CUS',showtimeId:'VALID-ST',movieId:'VALID-MV',seats:[{seatCode:'A1',unitPriceVnd:80000}],totalAmountVnd:80000,status:'CONFIRMED',payment:{method:'SIMULATED',status:'SUCCESS',paidAt:new Date()},createdAt:new Date()}
};
try{await client.connect();const db=client.db(dbName);if((await db.listCollections().toArray()).length)throw new Error(`QA validator database ${dbName} không trống.`);await ensureCollectionsAndValidators(db);const results={};for(const [name,doc] of Object.entries(valid)){await db.collection(name).insertOne(doc);let rejected=false;try{await db.collection(name).insertOne({...doc,_id:`INVALID-${name}`,status:'__INVALID__',...(name==='customers'?{email:7}:{}),...(name==='rooms'?{seats:'bad'}:{})});}catch(error){rejected=error.code===121;}results[name]={validAccepted:true,invalidRejected:rejected};if(!rejected)throw new Error(`Validator ${name} không từ chối document sai.`);}console.log(JSON.stringify({database:dbName,results},null,2));}finally{await client.close();}
