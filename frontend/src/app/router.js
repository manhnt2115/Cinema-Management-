const patterns=[
  ['home',/^#\/?$/],['movies',/^#\/movies$/],['movie',/^#\/movies\/([^/]+)$/],
  ['booking',/^#\/booking\/([^/]+)$/],['tickets',/^#\/my-tickets$/],['ticket',/^#\/my-tickets\/([^/]+)$/],
  ['checkout',/^#\/checkout$/],['booking-success',/^#\/booking-success$/],
  ['admin',/^#\/admin(?:\/([^/]+))?$/]
];
export function route(){const hash=location.hash||'#/';if(hash==='#admin')return{name:'admin',params:{page:'dashboard'}};for(const[name,re]of patterns){const match=hash.match(re);if(match)return{name,params:{id:match[1],page:match[1]}};}return{name:'not-found',params:{}};}
export function go(path){if(location.hash===path){window.dispatchEvent(new HashChangeEvent('hashchange'));return;}location.hash=path.replace(/^#/,'');}
