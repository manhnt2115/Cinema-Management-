import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { getDb } from './db.js';
import { registerAdminRoutes } from './admin.js';

const app = express();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
app.use(cors()); app.use(express.json({ limit: '2mb' }));
const bookingId = () => `BK-${new Date(Date.now()+25200000).toISOString().slice(0,10).replaceAll('-','')}-${randomBytes(6).toString('hex').toUpperCase()}`;

app.get('/api/schedule', asyncRoute(async (_req, res) => {
 const db = await getDb();
 const shows = await db.collection('showtimes').aggregate([
  {$lookup:{from:'movies',localField:'movieId',foreignField:'_id',as:'movie'}},
  {$lookup:{from:'rooms',localField:'roomId',foreignField:'_id',as:'room'}},
  {$set:{movieTitle:{$first:'$movie.title'},movieStatus:{$first:'$movie.status'},roomName:{$first:'$room.name'}}},
  {$unset:['movie','room']},{$sort:{startAt:1,_id:1}}
 ]).toArray();
 res.json(shows.map(show => ({...show,bookable:show.status==='OPEN' && show.movieStatus==='NOW_SHOWING' && new Date(show.startAt)>new Date()})));
}));

app.get('/api/health', asyncRoute(async (_q,res)=>{const db=await getDb();await db.command({ping:1});res.json({ok:true,database:db.databaseName});}));
app.get('/api/showtimes/:id', asyncRoute(async (req,res)=>{const db=await getDb(),showtime=await db.collection('showtimes').findOne({_id:req.params.id});if(!showtime)return res.status(404).json({error:'Không tìm thấy suất chiếu.'});const [movie,room]=await Promise.all([db.collection('movies').findOne({_id:showtime.movieId}),db.collection('rooms').findOne({_id:showtime.roomId})]);if(!movie||!room)return res.status(409).json({error:'Dữ liệu phim hoặc phòng chiếu của suất chiếu không còn hợp lệ.'});res.json({...showtime,movie:{_id:movie._id,title:movie.title,durationMinutes:movie.durationMinutes,genres:movie.genres,status:movie.status},room:{_id:room._id,name:room.name,capacity:Array.isArray(room.seats)?room.seats.length:0}});}));
app.get('/api/customers', asyncRoute(async (_q,res)=>res.json(await (await getDb()).collection('customers').find({}, {projection:{_id:1,fullName:1}}).sort({fullName:1,_id:1}).toArray())));
app.get('/api/customers/:id', asyncRoute(async (req,res)=>{const x=await (await getDb()).collection('customers').findOne({_id:req.params.id},{projection:{_id:1,fullName:1,createdAt:1}});if(!x)return res.status(404).json({error:'Không tìm thấy khách hàng.'});res.json(x);}));
app.get('/api/movies', asyncRoute(async (_q,res)=>res.json(await (await getDb()).collection('movies').find({status:'NOW_SHOWING'}).sort({title:1,_id:1}).toArray())));
app.get('/api/catalog/movies', asyncRoute(async (_q,res)=>res.json(await (await getDb()).collection('movies').find({}).sort({status:1,title:1,_id:1}).toArray())));
app.get('/api/movies/:id', asyncRoute(async (req,res)=>{const movie=await (await getDb()).collection('movies').findOne({_id:req.params.id});if(!movie)return res.status(404).json({error:'Không tìm thấy phim.'});res.json(movie);}));
app.get('/api/movies/:id/showtimes', asyncRoute(async (req,res)=>{const db=await getDb();if(!await db.collection('movies').findOne({_id:req.params.id},{projection:{_id:1}}))return res.status(404).json({error:'Không tìm thấy phim.'});res.json(await db.collection('showtimes').find({movieId:req.params.id,status:'OPEN',startAt:{$gt:new Date()}}).sort({startAt:1,_id:1}).toArray());}));
app.get('/api/rooms/:id', asyncRoute(async (req,res)=>{const db=await getDb(),room=await db.collection('rooms').findOne({_id:req.params.id});if(!room)return res.status(404).json({error:'Không tìm thấy phòng chiếu.'});const showtimes=await db.collection('showtimes').find({roomId:room._id}).sort({startAt:1,_id:1}).toArray();res.json({...room,capacity:Array.isArray(room.seats)?room.seats.length:0,showtimes});}));
app.get('/api/showtimes/:id/seats', asyncRoute(async (req,res)=>{const db=await getDb();if(!await db.collection('showtimes').findOne({_id:req.params.id},{projection:{_id:1}}))return res.status(404).json({error:'Không tìm thấy suất chiếu.'});res.json(await db.collection('showtime_seats').find({showtimeId:req.params.id}).sort({seatCode:1}).toArray());}));

app.post('/api/bookings', asyncRoute(async (req,res)=>{
 let {customerId,showtimeId,seatCodes}=req.body??{};customerId=typeof customerId==='string'?customerId.trim():'';showtimeId=typeof showtimeId==='string'?showtimeId.trim():'';
 if(!customerId||!showtimeId)return res.status(400).json({error:'Vui lòng chọn hồ sơ khách hàng và suất chiếu.'});
 if(!Array.isArray(seatCodes)||!seatCodes.length||seatCodes.some(x=>typeof x!=='string'||!x.trim()))return res.status(400).json({error:'Vui lòng chọn ít nhất một ghế hợp lệ.'});
 seatCodes=seatCodes.map(x=>x.trim());if(new Set(seatCodes).size!==seatCodes.length)return res.status(400).json({error:'Danh sách ghế không được có mã ghế trùng.'});
 const db=await getDb(),customers=db.collection('customers'),movies=db.collection('movies'),showtimes=db.collection('showtimes'),rooms=db.collection('rooms'),seats=db.collection('showtime_seats'),bookings=db.collection('bookings');
 if(!await customers.findOne({_id:customerId},{projection:{_id:1}}))return res.status(404).json({error:'Không tìm thấy khách hàng.'});
 const showtime=await showtimes.findOne({_id:showtimeId});if(!showtime)return res.status(404).json({error:'Không tìm thấy suất chiếu.'});
 const [movie,room]=await Promise.all([movies.findOne({_id:showtime.movieId}),rooms.findOne({_id:showtime.roomId})]);
 if(!movie)return res.status(409).json({error:'Phim của suất chiếu không tồn tại.'});if(movie.status!=='NOW_SHOWING')return res.status(409).json({error:'Phim hiện không ở trạng thái đang chiếu.'});if(!room)return res.status(409).json({error:'Phòng chiếu của suất chiếu không tồn tại.'});
 const start=new Date(showtime.startAt),end=new Date(showtime.endAt);if(showtime.status!=='OPEN')return res.status(409).json({error:'Suất chiếu hiện không mở bán.'});if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||start<=new Date())return res.status(409).json({error:'Thời gian suất chiếu không hợp lệ hoặc đã bắt đầu.'});if(!Number.isSafeInteger(showtime.basePriceVnd)||showtime.basePriceVnd<0)throw new Error('Giá vé của suất chiếu không hợp lệ.');
 const roomCodes=new Set((room.seats||[]).map(x=>x.code));if(seatCodes.some(x=>!roomCodes.has(x)))return res.status(400).json({error:'Một hoặc nhiều ghế không thuộc sơ đồ phòng của suất chiếu.'});
 if(await seats.countDocuments({showtimeId,seatCode:{$in:seatCodes}})!==seatCodes.length)return res.status(409).json({error:'Trạng thái ghế của suất chiếu chưa được khởi tạo đầy đủ.'});
 const id=bookingId(),held=[];let inserted=false;const compensate=async()=>{await seats.updateMany({showtimeId,seatCode:{$in:held},bookingId:id,status:{$in:['HELD','BOOKED']}},{$set:{status:'AVAILABLE',bookingId:null,holdExpiresAt:null}});if(inserted)await bookings.updateOne({_id:id,status:{$in:['PENDING','CONFIRMED']}},{$set:{status:'CANCELLED','payment.status':'FAILED','payment.failedAt':new Date()}});};
 try{
  for(const code of seatCodes){const r=await seats.updateOne({showtimeId,seatCode:code,status:'AVAILABLE',bookingId:null},{$set:{status:'HELD',bookingId:id,holdExpiresAt:null}});if(r.matchedCount!==1||r.modifiedCount!==1){await compensate();return res.status(409).json({error:`Ghế ${code} không còn khả dụng; vui lòng chọn lại ghế.`});}held.push(code);}
  const bookingSeats=seatCodes.map(seatCode=>({seatCode,unitPriceVnd:showtime.basePriceVnd})),doc={_id:id,customerId,showtimeId,movieId:showtime.movieId,seats:bookingSeats,totalAmountVnd:showtime.basePriceVnd*seatCodes.length,status:'PENDING',payment:{method:'SIMULATED',status:'PENDING',paidAt:null},createdAt:new Date()};
  await bookings.insertOne(doc);inserted=true;const confirmed=await seats.updateMany({showtimeId,seatCode:{$in:held},status:'HELD',bookingId:id},{$set:{status:'BOOKED',holdExpiresAt:null}});if(confirmed.matchedCount!==held.length||confirmed.modifiedCount!==held.length)throw new Error('Không thể xác nhận đầy đủ quyền sở hữu ghế.');
  const paidAt=new Date(),finalized=await bookings.updateOne({_id:id,status:'PENDING','payment.status':'PENDING'},{$set:{status:'CONFIRMED','payment.status':'SUCCESS','payment.paidAt':paidAt}});if(finalized.modifiedCount!==1)throw new Error('Không thể xác nhận booking và thanh toán mô phỏng.');res.status(201).json({...doc,status:'CONFIRMED',payment:{method:'SIMULATED',status:'SUCCESS',paidAt}});
 }catch(error){try{await compensate();}catch(e){console.error('Booking compensation failed:',e.message);}throw error;}
}));

async function history(customerId){const db=await getDb();if(!await db.collection('customers').findOne({_id:customerId},{projection:{_id:1}}))return null;return db.collection('bookings').aggregate([{$match:{customerId}},{$lookup:{from:'movies',localField:'movieId',foreignField:'_id',as:'movie'}},{$lookup:{from:'showtimes',localField:'showtimeId',foreignField:'_id',as:'showtime'}},{$set:{movieTitle:{$ifNull:[{$first:'$movie.title'},null]},startAt:{$ifNull:[{$first:'$showtime.startAt'},null]},roomId:{$ifNull:[{$first:'$showtime.roomId'},null]}}},{$lookup:{from:'rooms',localField:'roomId',foreignField:'_id',as:'room'}},{$set:{roomName:{$ifNull:[{$first:'$room.name'},null]}}},{$unset:['movie','showtime','room']},{$sort:{createdAt:-1,_id:-1}}]).toArray();}
app.get('/api/customers/:customerId/bookings/details',asyncRoute(async(req,res)=>{const x=await history(req.params.customerId);if(!x)return res.status(404).json({error:'Không tìm thấy khách hàng.'});res.json(x);}));
app.get('/api/customers/:customerId/bookings',asyncRoute(async(req,res)=>{const x=await history(req.params.customerId);if(!x)return res.status(404).json({error:'Không tìm thấy khách hàng.'});res.json(x.map(({movieTitle,startAt,roomId,roomName,...v})=>v));}));

app.post('/api/customers/:customerId/bookings/:bookingId/cancel',asyncRoute(async(req,res)=>{
 const db=await getDb(),bookings=db.collection('bookings'),seats=db.collection('showtime_seats'),booking=await bookings.findOne({_id:req.params.bookingId});if(!booking)return res.status(404).json({error:'Không tìm thấy đơn đặt vé.'});if(booking.customerId!==req.params.customerId)return res.status(404).json({error:'Không tìm thấy đơn đặt vé của khách hàng này.'});if(booking.status!=='CONFIRMED')return res.status(409).json({error:'Chỉ đơn đặt vé đã xác nhận mới có thể hủy.'});
 const show=await db.collection('showtimes').findOne({_id:booking.showtimeId});if(!show)return res.status(409).json({error:'Không tìm thấy suất chiếu của đơn đặt vé.'});if(new Date(show.startAt)<=new Date())return res.status(409).json({error:'Không thể hủy vé của suất đã bắt đầu.'});
 const at=new Date(),cancellation={reason:'CUSTOMER_REQUEST',cancelledAt:at,refund:{method:'SIMULATED',status:'SUCCESS',refundedAt:at}},claimed=await bookings.updateOne({_id:booking._id,customerId:booking.customerId,status:'CONFIRMED'},{$set:{status:'CANCELLED',cancellation}});if(claimed.modifiedCount!==1)return res.status(409).json({error:'Đơn đặt vé đã được xử lý bởi yêu cầu khác.'});
 try{const codes=booking.seats.map(x=>x.seatCode),released=await seats.updateMany({showtimeId:booking.showtimeId,seatCode:{$in:codes},status:'BOOKED',bookingId:booking._id},{$set:{status:'AVAILABLE',bookingId:null,holdExpiresAt:null}});if(released.matchedCount!==codes.length||released.modifiedCount!==codes.length)throw new Error('Không thể giải phóng đầy đủ ghế của booking.');res.json({...booking,status:'CANCELLED',cancellation});}
 catch(error){await bookings.updateOne({_id:booking._id,status:'CANCELLED','cancellation.cancelledAt':at},{$set:{status:'CONFIRMED'},$unset:{cancellation:''}});throw error;}
}));

registerAdminRoutes(app);app.use((_q,res)=>res.status(404).json({error:'Không tìm thấy API.'}));app.use((err,_q,res,_n)=>{console.error(err.message);if(!res.headersSent)res.status(500).json({error:'Đã xảy ra lỗi máy chủ.'});});
const port=Number(process.env.PORT||3000);app.listen(port,()=>console.log(`API listening on http://localhost:${port}`));
