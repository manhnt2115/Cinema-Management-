import './styles/product.css';
import {route,go} from './app/router.js';
import {ensureBase,renderHome,renderMovies,renderMovie,renderBooking,renderCheckout,renderSuccess,renderTickets} from './pages/customer.js';
import {renderAdmin,openAdmin,bindAdminEvents,syncAdminRoute} from './admin.js';

const app=document.querySelector('#app');
let adminReady=false;

function stateView(message,kind='loading-panel'){
  app.innerHTML=`<main class="page-section"><div class="${kind}">${message}</div></main>`;
}

async function render(){
  const current=route();
  if(current.name==='admin'){
    syncAdminRoute();
    app.innerHTML=renderAdmin();
    bindAdminEvents(render,()=>go('#/'));
    if(!adminReady){adminReady=true;await openAdmin(render);}
    return;
  }
  try{
    stateView('Đang chuẩn bị CineVue…');
    await ensureBase();
    if(current.name==='home')return renderHome(app,render);
    if(current.name==='movies')return renderMovies(app,render);
    if(current.name==='movie')return renderMovie(app,current.params.id,render);
    if(current.name==='booking')return renderBooking(app,current.params.id,render);
    if(current.name==='checkout')return renderCheckout(app,render);
    if(current.name==='booking-success')return renderSuccess(app,render);
    if(current.name==='tickets')return renderTickets(app,render);
    stateView('<h1>Không tìm thấy trang</h1><button class="primary-button" id="back-home">Về trang chủ</button>','error-panel');
    document.querySelector('#back-home').onclick=()=>go('#/');
  }catch(error){
    stateView(`<h2>Không thể tải ứng dụng</h2><p>${error.message}</p><button class="primary-button" id="retry-app">Thử lại</button>`,'error-panel');
    document.querySelector('#retry-app').onclick=()=>render();
  }
}

window.addEventListener('hashchange',render);
if(!location.hash)history.replaceState(null,'','#/');
render();
