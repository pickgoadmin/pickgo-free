/* User-scoped inbox. Never stores private notifications in local storage. */
(()=>{'use strict';
const $=id=>document.getElementById(id),bridge=()=>window.PICKGO_AUTH_BRIDGE;
let sequence=0,items=[];
const label=s=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s));
function clear(){items=[];$('notificationList').replaceChildren();$('notificationBadge').hidden=true}
function render(){const box=$('notificationList');box.replaceChildren();const unread=items.filter(n=>!n.read_at).length;$('notificationBadge').hidden=!unread;$('notificationBadge').textContent=String(unread);
 if(!items.length){const p=document.createElement('p');p.className='account-subnote';p.textContent='아직 알림이 없습니다. 경기 변경과 참가 현황을 여기서 확인하세요.';box.append(p);return}
 for(const n of items){const button=document.createElement('button');button.type='button';button.className='notification-item'+(!n.read_at?' unread':'');const text=document.createElement('span');text.className='notification-message';text.textContent=n.message;const date=document.createElement('small');date.textContent=label(n.created_at)+(!n.read_at?' · 새 알림':'');button.append(text,date);button.addEventListener('click',()=>open(n,button));box.append(button)}
}
async function refresh(){const seq=++sequence,db=bridge()?.getClient(),uid=bridge()?.getUser()?.id;
 if($('notificationsLogin'))$('notificationsLogin').hidden=!!uid;if(!uid||!db){clear();$('notificationsStatus').textContent='로그인하면 내 알림을 확인할 수 있습니다.';return}
 $('notificationsStatus').textContent='알림을 불러오는 중…';try{const {data,error}=await db.rpc('pickgo_my_notifications');if(seq!==sequence||uid!==bridge()?.getUser()?.id)return;if(error)throw error;items=data||[];render();$('notificationsStatus').textContent='최근 알림 최대 100개 표시'}catch(e){if(seq!==sequence||uid!==bridge()?.getUser()?.id)return;clear();$('notificationsStatus').textContent=['PGRST202','42883'].includes(e.code)?'알림 기능을 준비 중입니다. 잠시 후 다시 확인하세요.':'알림을 불러오지 못했습니다. 새로고침으로 다시 시도하세요.'}}
async function open(n,button){const uid=bridge()?.getUser()?.id,db=bridge()?.getClient();if(!uid||!db)return;button.disabled=true;try{const {data,error}=await db.rpc('pickgo_read_notification',{p_id:n.id});if(uid!==bridge()?.getUser()?.id)return;if(error)throw error;if(!data)throw Error('Unavailable');n.read_at=new Date().toISOString();render();$('notificationsDialog')?.close();if(n.match_id){window.PICKGO_NAVIGATE?.('matches');await window.PICKGO_MATCHES?.open(n.match_id)}}catch(e){if(uid===bridge()?.getUser()?.id)$('notificationsStatus').textContent='알림을 열지 못했습니다. 다시 시도하세요.'}finally{button.disabled=false}}
$('topNotifications')?.addEventListener('click',()=>{const dialog=$('notificationsDialog');if(dialog&&!dialog.open)dialog.showModal();void refresh()});
$('notificationsClose')?.addEventListener('click',()=>$('notificationsDialog').close());
$('notificationsLogin')?.addEventListener('click',()=>{$('notificationsDialog').close();window.PICKGO_AUTH_UI?.open('login')});
$('notificationsRefresh').addEventListener('click',()=>void refresh());window.PICKGO_INBOX={refresh};
bridge()?.getClient()?.auth.onAuthStateChange(()=>{sequence++;clear();setTimeout(()=>void refresh(),0)});
window.addEventListener('focus',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});void refresh();
})();
