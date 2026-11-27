import { createClient, dbName } from './config.js';
import { validators } from './schema.js';

if (dbName !== 'cinema_booking_demo' && !dbName.startsWith('cinema_booking_qa_')) throw new Error(`Từ chối migration database ${dbName}.`);
if (process.env.CONFIRM_SCHEMA_MIGRATION !== 'YES') throw new Error('Chưa xác nhận. Đặt CONFIRM_SCHEMA_MIGRATION=YES sau khi backup/kiểm tra đúng database đích.');
const client=createClient();
try{
 await client.connect();const db=client.db(dbName),invalid=(await db.collection('bookings').aggregate([{$match:{$nor:[validators.bookings]}},{$count:'n'}]).toArray())[0]?.n||0;
 if(invalid)throw new Error(`Có ${invalid} booking không tương thích validator mới; chưa áp dụng migration.`);
 await db.command({collMod:'bookings',validator:validators.bookings,validationLevel:'strict',validationAction:'error'});
 console.log(JSON.stringify({database:dbName,compatibleDocuments:true,migrated:'bookings validator',invalid},null,2));
}finally{await client.close();}
