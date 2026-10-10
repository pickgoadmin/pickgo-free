(()=>{'use strict';const $=id=>document.getElementById(id),config=window.PICKGO_PUBLIC_CONFIG||{};
function connectivity(){$('appConnectivity').hidden=navigator.onLine!==false;$('appConnectivity').textContent='오프라인입니다. 저장된 구장 정보는 볼 수 있지만, 참가·모집·알림은 인터넷 연결이 필요합니다.'}
window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);connectivity();
const dialog=$('serviceInfoDialog');document.querySelectorAll('[data-service-info]').forEach(b=>b.addEventListener('click',()=>{if(!dialog.open)dialog.showModal()}));$('serviceInfoClose').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function link(id,url){try{const parsed=new URL(url);if(parsed.protocol!=='https:')return;$(id).href=parsed.href;$(id).hidden=false}catch{}}
link('privacyLink',config.privacyPolicyUrl);link('termsLink',config.termsUrl);
if(/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(config.supportEmail||'')){$('supportLink').href='mailto:'+config.supportEmail;$('supportLink').hidden=false}
})();
