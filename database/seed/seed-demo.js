import { assertWritableTarget, collectionCounts, createClient, dbName } from '../scripts/config.js';
import { ensureCollectionsAndValidators, ensureIndexes } from '../scripts/schema.js';
import { buildPlan, validatePlan } from './plan.js';

assertWritableTarget({ allowDemo: true, allowQa: true });
const client=createClient();
try{
 await client.connect(); const db=client.db(dbName); const before=await collectionCounts(db);
 if(Object.values(before).some(Boolean))throw new Error(`Database ${dbName} không trống; seed bị từ chối. Counts: ${JSON.stringify(before)}`);
 const reference=process.env.SEED_REFERENCE_AT?new Date(process.env.SEED_REFERENCE_AT):new Date(); if(!Number.isFinite(reference.getTime()))throw new Error('SEED_REFERENCE_AT không hợp lệ.');
 const plan=buildPlan(reference); validatePlan(plan); await ensureCollectionsAndValidators(db); await ensureIndexes(db);
 for(const name of ['customers','movies','rooms','showtimes','showtime_seats','bookings'])await db.collection(name).insertMany(plan[name],{ordered:true});
 console.log(JSON.stringify({database:dbName,meta:plan.meta,counts:await collectionCounts(db)},null,2));
}finally{await client.close();}
