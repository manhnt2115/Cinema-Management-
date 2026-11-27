import { assertWritableTarget, createClient, dbName } from '../scripts/config.js';

assertWritableTarget({ allowDemo: true, allowQa: true });
const client=createClient();
const DAY=86400000;
const dayKey=date=>new Date(date.getTime()+7*3600000).toISOString().slice(0,10).replaceAll('-','');
try{
  await client.connect(); const db=client.db(dbName);
  const [movies,rooms]=await Promise.all([db.collection('movies').find({status:'NOW_SHOWING'}).sort({_id:1}).toArray(),db.collection('rooms').find({}).sort({_id:1}).toArray()]);
  if(!movies.length||!rooms.length)throw new Error('Thiếu phim NOW_SHOWING hoặc phòng; không thể bổ sung lịch.');
  const reference=process.env.FUTURE_REFERENCE_AT?new Date(process.env.FUTURE_REFERENCE_AT):new Date(); if(!Number.isFinite(reference.getTime()))throw new Error('FUTURE_REFERENCE_AT không hợp lệ.');
  const local=new Date(reference.getTime()+7*3600000); const day0=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-7*3600000);
  let addedShowtimes=0,addedSeats=0,skipped=0;
  for(let day=1;day<=7;day++)for(let slot=0;slot<2;slot++){
    const room=rooms[(day+slot)%rooms.length],movie=movies[(day*2+slot)%movies.length],hour=slot?19:10;
    const startAt=new Date(day0.getTime()+day*DAY+(hour-7)*3600000),endAt=new Date(startAt.getTime()+movie.durationMinutes*60000);
    const id=`ST-FUT-${dayKey(startAt)}-${room._id}-${String(slot+1).padStart(2,'0')}`;
    if(await db.collection('showtimes').findOne({_id:id},{projection:{_id:1}})){skipped++;continue;}
    const overlap=await db.collection('showtimes').findOne({roomId:room._id,startAt:{$lt:endAt},endAt:{$gt:startAt}},{projection:{_id:1}});
    if(overlap){skipped++;continue;}
    const showtime={_id:id,movieId:movie._id,roomId:room._id,startAt,endAt,basePriceVnd:80000+(day%4)*10000,status:'OPEN'};
    const seats=room.seats.map(seat=>({_id:`${id}_${seat.code}`,showtimeId:id,seatCode:seat.code,status:'AVAILABLE',bookingId:null,holdExpiresAt:null}));
    await db.collection('showtimes').insertOne(showtime);
    try{await db.collection('showtime_seats').insertMany(seats,{ordered:true});}
    catch(error){await db.collection('showtimes').deleteOne({_id:id});throw error;}
    addedShowtimes++;addedSeats+=seats.length;
  }
  console.log(JSON.stringify({database:dbName,reference:reference.toISOString(),addedShowtimes,addedSeats,skipped},null,2));
}finally{await client.close();}
