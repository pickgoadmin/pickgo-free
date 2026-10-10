/* PICKGO v1.1: external booking -> shared match recruitment. */
(()=>{'use strict';
const root=document.getElementById('matches'); if(!root)return;
const $=id=>document.getElementById(id),bridge=()=>window.PICKGO_AUTH_BRIDGE;
let rows=[],busy=false,sequence=0,selectedId=null,deepLinkHandled=false,editing=null;
const requestedMatch=new URLSearchParams(location.search).get('match');
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
function shareUrl(id){const u=new URL(location.pathname,location.origin);u.searchParams.set('tab','matches');u.searchParams.set('match',id);return u.href}
async function share(r){const url=shareUrl(r.id);try{
 if(navigator.share){await navigator.share({title:r.venue_name+' 경기 모집 | PICKGO',text:time(r.starts_at)+' · '+r.skill,url});return}
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);$('matchDetailNotice').textContent='모집 링크를 복사했습니다.';return}
 window.prompt('모집 링크를 복사하세요.',url);
}catch(e){if(e.name!=='AbortError')$('matchDetailNotice').textContent='공유에 실패했습니다. 다시 시도하세요.'}}
function updateDetail(){const dialog=$('matchDetailDialog');if(!dialog)return;const r=rows.find(x=>x.id===selectedId);if(!r){if(dialog.open)dialog.close();return}
 $('matchDetailTitle').textContent=r.venue_name;
 $('matchDetailTime').textContent=time(r.starts_at)+' ~ '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.ends_at));
 $('matchDetailMeta').textContent=r.skill+' · '+r.attendees+'/'+r.capacity+'명 (주최자 포함)';
 $('matchDetailNote').textContent=r.note||'별도 모집 안내가 없습니다.';
 $('matchDetailState').textContent=r.status==='cancelled'?'취소된 모집':r.is_host?'내가 만든 경기':r.is_joined?'참가 중':r.attendees>=r.capacity?'모집 마감':'참가자를 모집하고 있어요';
 $('matchDetailVenue').href='/court.html?id='+encodeURIComponent(r.venue_id);
 const edit=$('matchDetailEdit');if(edit){edit.hidden=!r.is_host||r.status!=='open';edit.disabled=busy;edit.onclick=()=>beginEdit(r)}
 const btn=$('matchDetailAction');btn.textContent=r.is_host?'모집 취소':r.is_joined?'참가 취소':r.attendees>=r.capacity?'모집 마감':'참가하기';btn.disabled=busy||r.status==='cancelled'||(!r.is_joined&&r.attendees>=r.capacity);btn.onclick=()=>act(r.id,r.is_host?'cancel':r.is_joined?'leave':'join');
 $('matchDetailShare').hidden=r.status==='cancelled';$('matchDetailShare').onclick=()=>share(r);
}
function resetEditor(){editing=null;$('matchForm').reset();$('matchSubmit').textContent='모집 등록';$('matchEditCancel').hidden=true;$('matchEditHint').hidden=true;}
function beginEdit(r){if(busy||!r.is_host||r.status!=='open'||!login())return;
 editing={owner:bridge()?.getUser()?.id,id:r.id,venue_id:r.venue_id,starts_at:r.starts_at,ends_at:r.ends_at,capacity:r.capacity,skill:r.skill,note:r.note};
 const kst=stamp=>new Date(new Date(stamp).getTime()+9*3600000).toISOString();
 const start=kst(r.starts_at),end=kst(r.ends_at);
 venueOptions();$('matchVenue').value=r.venue_id;$('matchDay').value=start.slice(0,10);$('matchStart').value=start.slice(11,16);$('matchEnd').value=end.slice(11,16);$('matchCapacity').value=r.capacity;$('matchSkill').value=r.skill;$('matchNote').value=r.note;
 $('matchReserved').checked=false;$('matchSubmit').textContent='수정 저장';$('matchEditCancel').hidden=false;$('matchEditHint').hidden=false;
 $('matchDetailDialog').close();$('matchComposer').open=true;$('matchComposer').scrollIntoView({behavior:'smooth',block:'start'});notice('모집 수정 중입니다. 변경한 구장·시간 예약을 확인하고 저장하세요.');
}
$('matchEditCancel')?.addEventListener('click',()=>{if(busy)return;resetEditor();$('matchComposer').open=false;notice('수정을 취소했습니다. 모집은 그대로 유지됩니다.')});
function openDetail(id){selectedId=id;updateDetail();const dialog=$('matchDetailDialog');if(dialog&&!dialog.open&&rows.some(r=>r.id===id))dialog.showModal()}
$('matchDetailClose')?.addEventListener('click',()=>$('matchDetailDialog').close());
$('matchDetailDialog')?.addEventListener('click',e=>{if(e.target===$('matchDetailDialog'))$('matchDetailDialog').close()});
$('matchDetailDialog')?.addEventListener('close',()=>{$('matchDetailNotice').textContent='';selectedId=null;const u=new URL(location.href);if(u.searchParams.has('match')){u.searchParams.delete('match');history.replaceState(null,'',u)}});
window.PICKGO_MATCHES={showMine:()=>{$('matchRegion').value='';$('matchMine').checked=true;render();void load()}};
const notice=(msg)=>{$('matchNotice').textContent=msg};
const element=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e};
const time=t=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
function venueOptions(){const select=$('matchVenue'),old=select.value;select.replaceChildren(element('option','구장을 선택하세요'));select.firstChild.value='';for(const v of COURTS){const o=element('option',v.region+' · '+v.name);o.value=v.id;select.append(o)}select.value=old;}
function render(){const box=$('matchList');box.replaceChildren();const filtered=rows.filter(r=>(!$('matchRegion').value||r.region===$('matchRegion').value)&&(!$('matchMine').checked||r.is_host||r.is_joined));
if(!filtered.length)box.append(element('p','표시할 모집이 없습니다. 예약한 경기의 동료를 모집해 보세요.','match-empty'));
for(const r of filtered){const card=element('article','','match-card');card.append(element('strong',r.venue_name),element('p',time(r.starts_at)+' ~ '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.ends_at))),element('p',r.skill+' · '+r.attendees+'/'+r.capacity+'명 (주최자 포함)'));
if(r.note)card.append(element('p',r.note));if(r.status==='cancelled'){card.append(element('span','모집 취소됨'));}else{const b=element('button',r.is_host?'모집 취소':r.is_joined?'참가 취소':r.attendees>=r.capacity?'모집 마감':'참가하기');b.type='button';b.disabled=busy||(!r.is_joined&&r.attendees>=r.capacity);b.addEventListener('click',()=>act(r.id,r.is_host?'cancel':r.is_joined?'leave':'join'));card.append(b)}const details=element('button','상세보기 · 공유');details.type='button';details.className='match-secondary';details.addEventListener('click',()=>openDetail(r.id));card.append(details);box.append(card)}
$('matchSubmit').disabled=busy;updateDetail();
}
function login(){if(bridge()?.getUser())return true;window.PICKGO_AUTH_UI?.open('login');notice('로그인 후 이용해 주세요.');return false}
function errorMessage(e){if(['PGRST202','42883','42P01'].includes(e?.code))return '경기 모집 DB 설정이 필요합니다. 모집은 v1.1 SQL, 수정은 v1.3 SQL을 실행하고 새로고침하세요.';return e?.message||'연결을 확인하고 다시 시도하세요.'}
async function load(){const seq=++sequence,db=bridge()?.getClient();if(!db){notice('서버에 연결하지 못했습니다. 새로고침하세요.');return}try{const result=await db.rpc('pickgo_match_list');if(seq!==sequence)return;if(result.error)throw result.error;rows=result.data||[];notice('경기 시간은 한국시간입니다. 참가 신청은 구장 예약이 아닙니다.');render();if(!deepLinkHandled&&validId(requestedMatch)){deepLinkHandled=true;if(rows.some(r=>r.id===requestedMatch))openDetail(requestedMatch);else notice('현재 조회 가능한 경기 목록에 없는 링크입니다. 모집이 취소·종료되었거나 목록 범위를 벗어났을 수 있습니다.')}}catch(e){if(seq!==sequence)return;rows=[];render();notice(errorMessage(e))}}
async function act(id,action){if(busy||!login())return;if(action!=='join'&&!window.confirm(action==='cancel'?'이 경기 모집을 취소할까요? 참가자에게 취소 상태가 표시됩니다.':'참가를 취소할까요?'))return;busy=true;render();try{const {error}=await bridge().getClient().rpc('pickgo_match_action',{p_id:id,p_action:action});if(error)throw error;await load()}catch(e){notice(errorMessage(e))}finally{busy=false;render()}}
$('matchForm').addEventListener('submit',async e=>{e.preventDefault();if(busy||!login())return;
const day=$('matchDay').value,start=$('matchStart').value,end=$('matchEnd').value;
const startIso=day+'T'+start+':00+09:00',endIso=day+'T'+end+':00+09:00';
if(!day||!start||!end||new Date(startIso)<=new Date()||new Date(endIso)<=new Date(startIso)||new Date(endIso)-new Date(startIso)>8*3600000){notice('미래의 날짜와 시간을 선택하세요. 종료는 같은 날, 최대 8시간 이내입니다.');return}
const editingId=editing?.id;
if(editingId&&Number($('matchCapacity').value)<(rows.find(r=>r.id===editingId)?.attendees||0)){notice('현재 참가 인원보다 정원을 줄일 수 없습니다.');return}
busy=true;render();try{
 const args={p_venue_id:$('matchVenue').value,p_starts_at:startIso,p_ends_at:endIso,p_capacity:Number($('matchCapacity').value),p_skill:$('matchSkill').value,p_note:$('matchNote').value,p_reserved:$('matchReserved').checked};
 if(editingId){args.p_id=editingId;args.p_expected={venue_id:editing.venue_id,starts_at:editing.starts_at,ends_at:editing.ends_at,capacity:editing.capacity,skill:editing.skill,note:editing.note}}
 const {error}=await bridge().getClient().rpc(editingId?'pickgo_match_update':'pickgo_match_create',args);if(error)throw error;
 resetEditor();$('matchComposer').open=false;await load();notice(editingId?'모집을 수정했습니다. 참가자에게 변경 내용을 직접 알려 주세요.':'경기 모집이 등록되었습니다. 주최자가 첫 참가자로 포함됩니다.');
}catch(err){notice(errorMessage(err))}finally{busy=false;render()}});

$('matchRegion').addEventListener('change',render);$('matchMine').addEventListener('change',render);$('matchRefresh').addEventListener('click',load);
const regions=[...new Set(COURTS.map(v=>v.region))];for(const region of regions){const o=element('option',region);o.value=region;$('matchRegion').append(o)}
venueOptions();const observer=new MutationObserver(venueOptions);const dbStatus=$('explore');if(dbStatus)observer.observe(dbStatus,{childList:true,subtree:true});
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());$('matchDay').min=today;
const client=bridge()?.getClient();client?.auth.onAuthStateChange((event,session)=>{if(editing&&session?.user?.id!==editing.owner)resetEditor();rows=[];render();setTimeout(load,0)});load();
})();
