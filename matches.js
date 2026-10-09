/* PICKGO v1.1: external booking -> shared match recruitment. */
(()=>{'use strict';
const root=document.getElementById('matches'); if(!root)return;
const $=id=>document.getElementById(id),bridge=()=>window.PICKGO_AUTH_BRIDGE;
let rows=[],busy=false,sequence=0;
const notice=(msg)=>{$('matchNotice').textContent=msg};
const element=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e};
const time=t=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
function venueOptions(){const select=$('matchVenue'),old=select.value;select.replaceChildren(element('option','구장을 선택하세요'));select.firstChild.value='';for(const v of COURTS){const o=element('option',v.region+' · '+v.name);o.value=v.id;select.append(o)}select.value=old;}
function render(){const box=$('matchList');box.replaceChildren();const filtered=rows.filter(r=>(!$('matchRegion').value||r.region===$('matchRegion').value)&&(!$('matchMine').checked||r.is_host||r.is_joined));
if(!filtered.length)box.append(element('p','표시할 모집이 없습니다. 예약한 경기의 동료를 모집해 보세요.','match-empty'));
for(const r of filtered){const card=element('article','','match-card');card.append(element('strong',r.venue_name),element('p',time(r.starts_at)+' ~ '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.ends_at))),element('p',r.skill+' · '+r.attendees+'/'+r.capacity+'명 (주최자 포함)'));
if(r.note)card.append(element('p',r.note));if(r.status==='cancelled'){card.append(element('span','모집 취소됨'));}else{const b=element('button',r.is_host?'모집 취소':r.is_joined?'참가 취소':r.attendees>=r.capacity?'모집 마감':'참가하기');b.type='button';b.disabled=busy||(!r.is_joined&&r.attendees>=r.capacity);b.addEventListener('click',()=>act(r.id,r.is_host?'cancel':r.is_joined?'leave':'join'));card.append(b)}box.append(card)}
$('matchSubmit').disabled=busy;
}
function login(){if(bridge()?.getUser())return true;window.PICKGO_AUTH_UI?.open('login');notice('로그인 후 이용해 주세요.');return false}
function errorMessage(e){if(['PGRST202','42883','42P01'].includes(e?.code))return '경기 모집 DB 설정이 필요합니다. v1.1 SQL을 실행한 후 새로고침하세요.';return e?.message||'연결을 확인하고 다시 시도하세요.'}
async function load(){const seq=++sequence,db=bridge()?.getClient();if(!db){notice('서버에 연결하지 못했습니다. 새로고침하세요.');return}try{const result=await db.rpc('pickgo_match_list');if(seq!==sequence)return;if(result.error)throw result.error;rows=result.data||[];notice('경기 시간은 한국시간입니다. 참가 신청은 구장 예약이 아닙니다.');render()}catch(e){if(seq!==sequence)return;rows=[];render();notice(errorMessage(e))}}
async function act(id,action){if(busy||!login())return;if(action!=='join'&&!window.confirm(action==='cancel'?'이 경기 모집을 취소할까요? 참가자에게 취소 상태가 표시됩니다.':'참가를 취소할까요?'))return;busy=true;render();try{const {error}=await bridge().getClient().rpc('pickgo_match_action',{p_id:id,p_action:action});if(error)throw error;await load()}catch(e){notice(errorMessage(e))}finally{busy=false;render()}}
$('matchForm').addEventListener('submit',async e=>{e.preventDefault();if(busy||!login())return;
const day=$('matchDay').value,start=$('matchStart').value,end=$('matchEnd').value;
const startIso=day+'T'+start+':00+09:00',endIso=day+'T'+end+':00+09:00';
if(!day||!start||!end||new Date(startIso)<=new Date()||new Date(endIso)<=new Date(startIso)||new Date(endIso)-new Date(startIso)>8*3600000){notice('미래의 날짜와 시간을 선택하세요. 종료는 같은 날, 최대 8시간 이내입니다.');return}
busy=true;render();try{const {error}=await bridge().getClient().rpc('pickgo_match_create',{p_venue_id:$('matchVenue').value,p_starts_at:startIso,p_ends_at:endIso,p_capacity:Number($('matchCapacity').value),p_skill:$('matchSkill').value,p_note:$('matchNote').value,p_reserved:$('matchReserved').checked});if(error)throw error;$('matchForm').reset();$('matchComposer').open=false;await load();notice('경기 모집이 등록되었습니다. 주최자가 첫 참가자로 포함됩니다.')}catch(err){notice(errorMessage(err))}finally{busy=false;render()}});
$('matchRegion').addEventListener('change',render);$('matchMine').addEventListener('change',render);$('matchRefresh').addEventListener('click',load);
const regions=[...new Set(COURTS.map(v=>v.region))];for(const region of regions){const o=element('option',region);o.value=region;$('matchRegion').append(o)}
venueOptions();const observer=new MutationObserver(venueOptions);const dbStatus=$('explore');if(dbStatus)observer.observe(dbStatus,{childList:true,subtree:true});
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());$('matchDay').min=today;
const client=bridge()?.getClient();client?.auth.onAuthStateChange(()=>{rows=[];render();setTimeout(load,0)});load();
})();
