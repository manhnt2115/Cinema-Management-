import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { acceptanceGuard } from '../../database/tests/acceptance-guard.js';
const {client,db,base}=await acceptanceGuard({write:true});
const root=process.env.ACCEPTANCE_EVIDENCE_DIR;assert(root);await mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const p=await browser.newPage({viewport:{width:1440,height:900}});
const records=[],errors=[];const record=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);records.push({name,actual,expected,pass:true});};
const web=process.env.TEST_WEB_BASE_URL||'http://127.0.0.1:5173/';
p.on('pageerror',e=>errors.push(e.message));
await p.route('**/api/**',route=>{const u=new URL(route.request().url());if(!u.pathname.startsWith('/api/'))return route.continue();return ['localhost','127.0.0.1'].includes(u.hostname)&&u.port===new URL(base).port?route.continue():route.abort();});
try{
 const show=await db.collection('showtimes').findOne({startAt:{$gt:new Date()},status:'OPEN'});
 const seat=await db.collection('showtime_seats').findOne({showtimeId:show._id,status:'AVAILABLE'});
 const before=await db.collection('bookings').countDocuments({});
 await p.goto(web+'#/booking/'+show._id);await p.locator('[data-seat]').first().waitFor();
 await p.locator('.profile-button').click();await p.locator('[data-profile=CUS046]').click();
 await p.locator(`[data-seat="${seat.seatCode}"]`).click();await p.locator('#continue-booking').click();await p.locator('#pay-button').waitFor();
 await p.locator('[data-go^="#/booking/"]').click();await p.locator('[data-seat]').first().waitFor();
 record('Quay lại chọn ghế không tạo booking',await db.collection('bookings').countDocuments({}),before);
 await p.locator(`[data-seat="${seat.seatCode}"]`).click();await p.locator('#continue-booking').click();await p.locator('#pay-button').waitFor();
 const response=p.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/bookings'));
 await p.locator('#pay-button').click();const r=await response;record('Một ghế qua UI trả 201',r.status(),201);
 const b=await r.json();await p.waitForURL('**/#/booking-success');
 const saved=await db.collection('bookings').findOne({_id:b._id});
 record('BSON và giá một ghế đúng',[saved.customerId,saved.showtimeId,saved.seats.length,saved.totalAmountVnd,saved.payment.method,saved.payment.status,saved.createdAt instanceof Date],['CUS046',show._id,1,show.basePriceVnd,'SIMULATED','SUCCESS',true]);
 await p.getByRole('link',{name:'Chi tiết vé',exact:true}).click();await p.locator('#cancel-ticket').waitFor();
 await p.screenshot({path:root+'/one-seat-ticket.png'});
 await p.locator('#cancel-ticket').click();await p.locator('.app-dialog [value=cancel]').click();
 record('Đóng xác nhận hủy không ghi', (await db.collection('bookings').findOne({_id:b._id})).status,'CONFIRMED');
 await p.locator('#cancel-ticket').click();await p.locator('.app-dialog [value=confirm]').click();
 await p.getByText('Đã hủy',{exact:true}).waitFor();
 const cancelled=await db.collection('bookings').findOne({_id:b._id});
 const released=await db.collection('showtime_seats').findOne({_id:seat._id});
 record('Hủy UI bảo toàn tổng tiền, hoàn tiền và giải phóng ghế',[cancelled.status,cancelled.totalAmountVnd,cancelled.cancellation.refund.status,released.status,released.bookingId],['CANCELLED',show.basePriceVnd,'SUCCESS','AVAILABLE',null]);
 await p.goto(web+'#/booking-success');await p.waitForURL('**/#/my-tickets');
 record('Không hiển thị thành công cũ sau hủy',new URL(p.url()).hash,'#/my-tickets');
 // Switch history while the previous customer's request is deliberately late.
 await p.route('**/api/customers/CUS046/bookings/details',async route=>{const r=await route.fetch();await new Promise(r=>setTimeout(r,900));await route.fulfill({response:r});});
 await p.goto(web+'#/my-tickets');await p.locator('.profile-button').click();await p.locator('[data-profile=CUS050]').click();
 await p.locator('#ticket-filters').waitFor();await new Promise(r=>setTimeout(r,1100));
 record('Lịch sử khách cũ không ghi đè khách mới',(await p.locator('.page-heading').innerText()).includes('50'),true);
 await p.unroute('**/api/customers/CUS046/bookings/details');
 // Simulated transport failure, then a real successful retry.
 await p.route('**/api/schedule',route=>route.abort());await p.goto(web+'#/schedule');
 await p.locator('#retry-page').waitFor();record('Mất API có lỗi và nút thử lại',await p.locator('#retry-page').isVisible(),true);
 await p.screenshot({path:root+'/network-error.png'});await p.unroute('**/api/schedule');
 await p.locator('#retry-page').click();await p.locator('#schedule-filters').waitFor();record('Thử lại phục hồi dữ liệu thật',await p.locator('#schedule-filters').isVisible(),true);
 await p.evaluate(()=>sessionStorage.setItem('cinevue.checkout','invalid-json'));await p.goto(web+'#/checkout');
 await p.getByRole('heading',{name:'Chưa có ghế được chọn'}).waitFor();record('Draft hỏng không làm crash checkout',errors,[]);
 console.log(JSON.stringify({passed:records.length,failed:0}));
}catch(e){records.push({pass:false,error:e.stack});await p.screenshot({path:root+'/actions-failure.png'});throw e;}
finally{await writeFile(root+'/actions-results.json',JSON.stringify({records,errors},null,2));await browser.close();await client.close();}
