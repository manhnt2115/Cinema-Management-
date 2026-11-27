const DAY = 86400000;
export const seedValue = 20261128;
function rngFactory(seed) { let x = seed >>> 0; return () => ((x = (1664525 * x + 1013904223) >>> 0) / 4294967296); }
const pick = (items, rng) => items[Math.floor(rng() * items.length)];

function startOfVietnamDay(reference) {
  const local = new Date(reference.getTime() + 7 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 7 * 3600000);
}
function makeSeats(capacity) {
  return Array.from({ length: capacity }, (_, i) => { const row = String.fromCharCode(65 + Math.floor(i / 8)); const number = i % 8 + 1; return { code: `${row}${number}`, row, number, type: i >= capacity - 8 ? 'PREMIUM' : 'STANDARD' }; });
}

export function buildPlan(reference = new Date(), seed = seedValue) {
  const rng = rngFactory(seed), day0 = startOfVietnamDay(reference);
  const customers = Array.from({ length: 50 }, (_, i) => ({ _id: `CUS${String(i + 1).padStart(3, '0')}`, fullName: `Khách Hàng Demo ${String(i + 1).padStart(2, '0')}`, email: `khach${String(i + 1).padStart(2, '0')}@cinema.test`, createdAt: new Date(day0.getTime() - (120 - i) * DAY) }));
  const titles = ['Hành Trình Ánh Sao','Bí Mật Thành Phố','Ngày Mai Rực Rỡ','Vùng Trời Lặng Gió','Chuyến Tàu Cuối Tuần','Hồ Sơ Mùa Mưa','Dòng Sông Ký Ức','Mùa Hè Trên Mây','Đêm Trong Thư Viện','Con Đường Phía Biển','Bản Nhạc Cuối Thu','Ngọn Đèn Trong Sương'];
  const genreSets = [['Phiêu lưu','Gia đình'],['Tâm lý','Bí ẩn'],['Hài','Tình cảm'],['Phiêu lưu','Tâm lý'],['Hài','Gia đình'],['Bí ẩn','Tâm lý'],['Lịch sử','Tâm lý'],['Hoạt hình','Gia đình'],['Kinh dị','Bí ẩn'],['Phiêu lưu','Hành động'],['Âm nhạc','Tình cảm'],['Khoa học viễn tưởng','Phiêu lưu']];
  const movies = titles.map((title, i) => ({ _id: `MV${String(i + 1).padStart(3, '0')}`, title, genres: genreSets[i], durationMinutes: 92 + (i * 7) % 43, status: i < 9 ? 'NOW_SHOWING' : 'COMING_SOON', synopsis: `Câu chuyện giả lập phục vụ minh họa dữ liệu cho phim ${title}.` }));
  const rooms = [32,40,48].map((capacity, i) => ({ _id: `ROOM${String(i + 1).padStart(3, '0')}`, name: `Phòng ${i + 1}`, seats: makeSeats(capacity) }));
  const offsets = [...Array(20)].map((_,i)=>-14+(i%14)).concat(Array(5).fill(0), [...Array(20)].map((_,i)=>1+(i%14)));
  const times = [9,13,17,21]; const showtimes=[]; const used=new Map();
  for(let i=0;i<45;i++){
    const room=rooms[i%3], movie=movies[i%9], offset=offsets[i], key=`${room._id}:${offset}`; const slot=used.get(key)||0; used.set(key,slot+1);
    const hour=times[(slot + Math.floor(i/3))%times.length]; const startAt=new Date(day0.getTime()+offset*DAY+(hour-7)*3600000); const endAt=new Date(startAt.getTime()+movie.durationMinutes*60000);
    showtimes.push({_id:`ST${String(i+1).padStart(3,'0')}`,movieId:movie._id,roomId:room._id,startAt,endAt,basePriceVnd:70000+(i%5)*10000,status:startAt>reference?'OPEN':'CLOSED'});
  }
  const showtimeSeats=showtimes.flatMap(s=>rooms.find(r=>r._id===s.roomId).seats.map(seat=>({_id:`${s._id}_${seat.code}`,showtimeId:s._id,seatCode:seat.code,status:'AVAILABLE',bookingId:null,holdExpiresAt:null})));
  const seatMap=new Map(showtimes.map(s=>[s._id,rooms.find(r=>r._id===s.roomId).seats.map(x=>x.code)])); const occupied=new Map(); const bookings=[];
  for(let i=0;i<200;i++){
    const confirmed=i<170, show=showtimes[(i*7+Math.floor(rng()*showtimes.length))%showtimes.length], customer=customers[(i*11+Math.floor(rng()*45))%45];
    const wanted=1+Math.floor(rng()*3), usedSeats=occupied.get(show._id)||new Set(), available=seatMap.get(show._id).filter(x=>!usedSeats.has(x)); const codes=[];
    for(let n=0;n<wanted;n++){const code=pick(available.filter(x=>!codes.includes(x)),rng); if(code)codes.push(code);} if(!codes.length) codes.push(seatMap.get(show._id)[0]);
    const id=`BK-DEMO-${String(i+1).padStart(4,'0')}`; if(confirmed) for(const code of codes)usedSeats.add(code); occupied.set(show._id,usedSeats);
    const earliest=Math.max(customer.createdAt.getTime()+DAY,show.startAt.getTime()-12*DAY); const latest=show.startAt.getTime()-3600000; const createdAt=new Date(earliest+Math.max(0,Math.floor(rng()*Math.max(1,latest-earliest))));
    const seats=codes.map(seatCode=>({seatCode,unitPriceVnd:show.basePriceVnd})); bookings.push({_id:id,customerId:customer._id,showtimeId:show._id,movieId:show.movieId,seats,totalAmountVnd:show.basePriceVnd*seats.length,status:confirmed?'CONFIRMED':'CANCELLED',payment:{method:'SIMULATED',status:confirmed?'SUCCESS':'FAILED',paidAt:confirmed?createdAt:null},createdAt});
  }
  const bookingBySeat=new Map(); for(const b of bookings.filter(x=>x.status==='CONFIRMED'))for(const x of b.seats)bookingBySeat.set(`${b.showtimeId}:${x.seatCode}`,b._id);
  for(const seat of showtimeSeats){const bookingId=bookingBySeat.get(`${seat.showtimeId}:${seat.seatCode}`);if(bookingId){seat.status='BOOKED';seat.bookingId=bookingId;}}
  return { customers,movies,rooms,showtimes,showtime_seats:showtimeSeats,bookings,meta:{seed,reference:reference.toISOString(),timeZone:'Asia/Ho_Chi_Minh'} };
}

export function validatePlan(p) {
  const errors=[]; const unique=(xs,label)=>{if(new Set(xs).size!==xs.length)errors.push(`${label} bị trùng`);};
  for(const [name,docs] of Object.entries(p).filter(([,v])=>Array.isArray(v)))unique(docs.map(x=>x._id),`${name}._id`);
  for(const r of p.rooms)unique(r.seats.map(x=>x.code),`${r._id}.seatCode`);
  const roomMap=new Map(p.rooms.map(x=>[x._id,x])), showMap=new Map(p.showtimes.map(x=>[x._id,x])), bookingMap=new Map(p.bookings.map(x=>[x._id,x]));
  for(const s of p.showtimes){if(!roomMap.has(s.roomId)||s.endAt<=s.startAt)errors.push(`Suất ${s._id} sai quan hệ/thời gian`);}
  for(let i=0;i<p.showtimes.length;i++)for(let j=i+1;j<p.showtimes.length;j++){const a=p.showtimes[i],b=p.showtimes[j];if(a.roomId===b.roomId&&a.startAt<b.endAt&&b.startAt<a.endAt)errors.push(`Chồng lịch ${a._id}/${b._id}`);}
  for(const b of p.bookings){if(!showMap.has(b.showtimeId)||b.totalAmountVnd!==b.seats.reduce((n,x)=>n+x.unitPriceVnd,0)||b.createdAt>=showMap.get(b.showtimeId).startAt)errors.push(`Booking ${b._id} sai`);}
  for(const s of p.showtime_seats){const show=showMap.get(s.showtimeId),room=show&&roomMap.get(show.roomId);if(!room?.seats.some(x=>x.code===s.seatCode))errors.push(`Ghế ${s._id} sai phòng`);if(s.status==='BOOKED'&&!bookingMap.has(s.bookingId))errors.push(`Ghế ${s._id} thiếu booking`);}
  if(errors.length)throw new Error(`Kế hoạch dữ liệu không hợp lệ:\n${errors.slice(0,20).join('\n')}`); return true;
}
