/* PICKGO v1.1: external booking -> shared match recruitment. */
(()=>{'use strict';
const root=document.getElementById('matches'); if(!root)return;
const $=id=>document.getElementById(id),bridge=()=>window.PICKGO_AUTH_BRIDGE;
let rows=[],busy=false,sequence=0,selectedId=null,deepLinkHandled=false,editing=null,rosterSequence=0,listLoading=false,loadError=false,reportBusy=false,createRequest=null,composerOwner=null;
const requestedMatch=new URLSearchParams(location.search).get('match');
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
function shareUrl(id){const u=new URL(location.pathname,location.origin);u.searchParams.set('tab','matches');u.searchParams.set('match',id);return u.href}
async function share(r){const url=shareUrl(r.id);try{
 if(navigator.share){await navigator.share({title:r.venue_name+' 경기 모집 | PICKGO',text:time(r.starts_at)+' · '+r.skill,url});return}
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);$('matchDetailNotice').textContent='모집 링크를 복사했습니다.';return}
 window.prompt('모집 링크를 복사하세요.',url);
}catch(e){if(e.name!=='AbortError')$('matchDetailNotice').textContent='공유에 실패했습니다. 다시 시도하세요.'}}
function clearRoster(){rosterSequence++;$('matchMembersList')?.replaceChildren();}
async function loadMembers(){const id=selectedId,r=rows.find(x=>x.id===id),me=bridge()?.getUser()?.id,db=bridge()?.getClient();clearRoster();const seq=rosterSequence;
 const info=$('matchMembersNotice'),refresh=$('matchMembersRefresh');if(!info||!refresh)return;
 refresh.hidden=!me||!(r?.is_host||r?.is_joined);
 if(!r||!me||!(r.is_host||r.is_joined)){info.textContent='참가 후 닉네임 명단을 확인할 수 있습니다.';return}
 info.textContent='참가자 명단을 불러오는 중…';
 try{const {data,error}=await db.rpc('pickgo_match_members',{p_id:id});if(seq!==rosterSequence||id!==selectedId||me!==bridge()?.getUser()?.id)return;if(error)throw error;
 const list=$('matchMembersList');for(const member of data||[]){const li=element('li',member.display_name||'PICKGO 회원');if(member.is_host)li.append(element('span','주최자','match-host-badge'));list.append(li)}
 info.textContent=(data||[]).length+'명 · 닉네임은 이 경기의 주최자와 참가자에게 표시됩니다.';
 }catch(e){if(seq!==rosterSequence||id!==selectedId||me!==bridge()?.getUser()?.id)return;void window.PICKGO_DIAGNOSTICS?.report('match_members',e,me);info.textContent=['PGRST202','42883'].includes(e.code)?'참가자 명단을 준비 중입니다. 잠시 후 다시 확인하세요.':e.code==='42501'?'이 경기의 주최자와 참가자만 명단을 볼 수 있습니다.':'명단을 불러오지 못했습니다. 다시 시도해 주세요.'}
}
$('matchMembersRefresh')?.addEventListener('click',()=>void loadMembers());
function updateDetail(){const dialog=$('matchDetailDialog');if(!dialog)return;const r=rows.find(x=>x.id===selectedId);if(!r){if(dialog.open)dialog.close();return}
 $('matchDetailTitle').textContent=r.venue_name;
 $('matchDetailTime').textContent=time(r.starts_at)+' ~ '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.ends_at));
 $('matchDetailMeta').textContent=r.skill+' · '+r.attendees+'/'+r.capacity+'명 (주최자 포함)';
 if($('matchUseState'))$('matchUseState').textContent=planLabel(r)+' · 경기 참가는 구장 예약이 아닙니다.';
 $('matchDetailNote').textContent=r.note||'별도 모집 안내가 없습니다.';
 $('matchDetailState').textContent=new Date(r.starts_at)<=new Date()?'지난 경기':r.status==='cancelled'?'취소된 모집':r.is_host?'내가 만든 경기':r.is_joined?'참가 중':r.attendees>=r.capacity?'모집 마감':'참가자를 모집하고 있어요';
 $('matchDetailVenue').href='/court.html?id='+encodeURIComponent(r.venue_id);
 const edit=$('matchDetailEdit');if(edit){edit.hidden=!r.is_host||r.status!=='open'||new Date(r.starts_at)<=new Date();edit.disabled=busy;edit.onclick=()=>beginEdit(r)}
 const btn=$('matchDetailAction');btn.textContent=r.is_host?'모집 취소':r.is_joined?'참가 취소':r.attendees>=r.capacity?'모집 마감':'참가하기';btn.disabled=busy||new Date(r.starts_at)<=new Date()||r.status==='cancelled'||(!r.is_joined&&r.attendees>=r.capacity);btn.onclick=()=>act(r.id,r.is_host?'cancel':r.is_joined?'leave':'join');
 $('matchDetailShare').hidden=r.status==='cancelled';$('matchDetailShare').onclick=()=>share(r);
}
function bookingOptions(){const select=$('matchBookingState');if(!select)return;const walk=select.querySelector?.('option[value="walk_in"]');if(walk)walk.disabled=!['court-42','court-43'].includes($('matchVenue').value);if(select.value==='walk_in'&&!['court-42','court-43'].includes($('matchVenue').value))select.value='planned';select.disabled=editing?.verification==='provider_verified'}
function resetEditor(){editing=null;createRequest=null;composerOwner=bridge()?.getUser()?.id;for(const id of ['matchVenue','matchDay','matchStart','matchEnd'])$(id).disabled=false;if($('matchReserved'))$('matchReserved').checked=false;$('matchForm').reset();if($('matchBookingState')){$('matchBookingState').value='planned';$('matchBookingState').disabled=false}bookingOptions();$('matchSubmit').textContent='모집 등록';$('matchEditCancel').hidden=true;$('matchEditHint').hidden=true;}
function beginEdit(r){if(busy||!r.is_host||r.status!=='open'||!login())return;
 resetEditor();editing={owner:bridge()?.getUser()?.id,id:r.id,venue_id:r.venue_id,starts_at:r.starts_at,ends_at:r.ends_at,capacity:r.capacity,skill:r.skill,note:r.note,booking_state:r.booking_state||null,verification:r.verification};
 const kst=stamp=>new Date(new Date(stamp).getTime()+9*3600000).toISOString();
 const start=kst(r.starts_at),end=kst(r.ends_at);
 venueOptions();$('matchVenue').value=r.venue_id;$('matchDay').value=start.slice(0,10);$('matchStart').value=start.slice(11,16);$('matchEnd').value=end.slice(11,16);$('matchCapacity').value=r.capacity;$('matchSkill').value=r.skill;$('matchNote').value=r.note;
 if($('matchBookingState'))$('matchBookingState').value=r.booking_state||'planned';bookingOptions();$('matchReserved').checked=false;$('matchSubmit').textContent='수정 저장';$('matchEditCancel').hidden=false;$('matchEditHint').hidden=false;
 $('matchDetailDialog').close();if($('matchComposeTitle'))$('matchComposeTitle').textContent='모집 수정';$('matchComposer').showModal();notice('모집 수정 중입니다. 변경한 구장·시간의 이용 조건을 확인하세요. 예약 상태도 이 화면에서 변경할 수 있습니다.');
}
$('matchEditCancel')?.addEventListener('click',()=>{if(busy)return;resetEditor();$('matchComposer').close();notice('수정을 취소했습니다. 모집은 그대로 유지됩니다.')});
function openDetail(id){selectedId=id;updateDetail();const dialog=$('matchDetailDialog');if(dialog&&!dialog.open&&rows.some(r=>r.id===id))dialog.showModal();void loadMembers()}
$('matchDetailClose')?.addEventListener('click',()=>$('matchDetailDialog').close());
$('matchDetailDialog')?.addEventListener('click',e=>{if(e.target===$('matchDetailDialog'))$('matchDetailDialog').close()});
$('matchDetailDialog')?.addEventListener('close',()=>{$('matchDetailNotice').textContent='';selectedId=null;clearRoster();$('matchReportForm')?.reset();if($('matchReportNotice'))$('matchReportNotice').textContent='';const u=new URL(location.href);if(u.searchParams.has('match')){u.searchParams.delete('match');history.replaceState(null,'',u)}});
function composeForSlot(slot){if(busy||!slot||!Number.isFinite(+new Date(slot.starts_at))||!Number.isFinite(+new Date(slot.ends_at))||!COURTS.some(v=>v.id===slot.venue_id)||new Date(slot.starts_at)<=new Date()||new Date(slot.ends_at)<=new Date(slot.starts_at)||new Date(slot.ends_at)-new Date(slot.starts_at)>8*3600000||!login())return false;const kst=value=>new Date(new Date(value).getTime()+9*3600000).toISOString();const start=kst(slot.starts_at),end=kst(slot.ends_at);if(start.slice(0,10)!==end.slice(0,10))return false;resetEditor();venueOptions();$('matchVenue').value=slot.venue_id;$('matchDay').value=start.slice(0,10);$('matchStart').value=start.slice(11,16);$('matchEnd').value=end.slice(11,16);bookingOptions();$('matchReserved').checked=false;if($('matchComposeTitle'))$('matchComposeTitle').textContent='경기 모집하기';window.PICKGO_NAVIGATE?.('matches');$('matchComposer').showModal();notice('선택한 구장·시간을 입력했습니다. 코트 이용 상태와 모집 인원을 확인하고 등록하세요.');return true}
function planLabel(row){if(row.verification==='provider_verified')return '예약 완료 · 시스템 확인';return {booked:'예약 완료 · 본인 확인',planned:'예약 예정 · 코트 확보 미확정',walk_in:'예약 없이 이용 · 현장 상황에 따름'}[row.booking_state]||'예약 상태 미등록'}
async function attachPlanInfo(list,db){try{const ids=list.map(r=>r.id).filter(validId);if(!ids.length)return list;const {data,error}=await db.rpc('pickgo_match_use_info',{p_ids:ids});if(error||!Array.isArray(data))return list;const map=new Map(data.map(r=>[r.match_id,r]));return list.map(r=>({...r,...map.get(r.id)}))}catch{return list}}
window.PICKGO_MATCHES={composeForSlot,open:resolveDetail,refresh:load,showMine:()=>{$('matchRegion').value='';$('matchMine').checked=true;clearFilters(false);render();void load()}};
const notice=(msg)=>{$('matchNotice').textContent=msg;if($('matchComposer').open&&$('matchComposeNotice'))$('matchComposeNotice').textContent=msg};
const element=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e};
const time=t=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
function venueOptions(){const select=$('matchVenue'),old=select.value;select.replaceChildren(element('option','구장을 선택하세요'));select.firstChild.value='';for(const v of COURTS){const o=element('option',v.region+' · '+v.name);o.value=v.id;select.append(o)}select.value=old;}
const filterValue=id=>$(id)?.value||'';
const isChecked=id=>!!$(id)?.checked;
function clearFilters(resetMine=true){for(const id of ['matchRegion','matchFilterDay','matchFilterSkill','matchSearch'])if($(id))$(id).value='';if($('matchSort'))$('matchSort').value='time';if($('matchOpenOnly'))$('matchOpenOnly').checked=false;if(resetMine)$('matchMine').checked=false;render()}
const searchText=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g,' ').trim();
const availableSeats=r=>r.status==='open'&&new Date(r.starts_at)>new Date()?Math.max(0,r.capacity-r.attendees):0;
function render(){const box=$('matchList');box.replaceChildren();box.setAttribute?.('aria-busy',String(listLoading));
const query=searchText(filterValue('matchSearch'));
const filtered=rows.filter(r=>(!query||query.split(' ').every(term=>searchText([r.venue_name,r.region,r.note].join(' ')).includes(term)))&&(!filterValue('matchRegion')||r.region===filterValue('matchRegion'))&&(!isChecked('matchMine')||r.is_host||r.is_joined)&&(!filterValue('matchFilterDay')||new Date(new Date(r.starts_at).getTime()+9*3600000).toISOString().slice(0,10)===filterValue('matchFilterDay'))&&(!filterValue('matchFilterSkill')||r.skill===filterValue('matchFilterSkill'))&&(!isChecked('matchOpenOnly')||(availableSeats(r)>0))).sort((a,b)=>(filterValue('matchSort')==='seats'?availableSeats(b)-availableSeats(a):0)||new Date(a.starts_at)-new Date(b.starts_at)||String(a.id).localeCompare(String(b.id)));
if($('matchResultCount'))$('matchResultCount').textContent=listLoading?'불러오는 중…':filtered.length+'개의 경기';
if(!filtered.length)box.append(element('p',listLoading?'경기 모집을 불러오는 중입니다.':loadError?'경기를 불러오지 못했습니다. 새로고침으로 다시 시도하세요.':isChecked('matchMine')&&!bridge()?.getUser()?'로그인하면 내가 만든 경기와 참가한 경기를 확인할 수 있어요.':'조건에 맞는 경기가 없습니다. 필터를 바꾸거나 새 경기를 모집해 보세요.','match-empty'));
for(const r of filtered){const card=element('article','','match-card');const closed=r.status==='cancelled'||r.attendees>=r.capacity||new Date(r.starts_at)<=new Date();card.append(element('span',r.status==='cancelled'?'취소됨':new Date(r.starts_at)<=new Date()?'지난 경기':r.is_host?'내가 만든 경기':r.is_joined?'참가 중':closed?'모집 마감':(r.capacity-r.attendees)+'자리 남음','match-status-pill'+(closed?' closed':'')),element('strong',r.venue_name),element('p',time(r.starts_at)+' ~ '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.ends_at))),element('p',r.skill+' · '+r.attendees+'/'+r.capacity+'명 (주최자 포함)'));
card.append(element('p',planLabel(r),'match-use-status'));
if(r.note)card.append(element('p',r.note));if(r.status==='cancelled'){card.append(element('span','모집 취소됨'));}else{const b=element('button',r.is_host?'모집 취소':r.is_joined?'참가 취소':r.attendees>=r.capacity?'모집 마감':'참가하기');b.type='button';b.disabled=busy||new Date(r.starts_at)<=new Date()||(!r.is_joined&&r.attendees>=r.capacity);b.addEventListener('click',()=>act(r.id,r.is_host?'cancel':r.is_joined?'leave':'join'));card.append(b)}const details=element('button','상세보기 · 공유');details.type='button';details.className='match-secondary';details.addEventListener('click',()=>openDetail(r.id));card.append(details);box.append(card)}
$('matchSubmit').disabled=busy;$('matchRefresh').disabled=listLoading;updateDetail();
}
async function resolveDetail(id){if(!validId(id)){notice('올바르지 않은 경기 링크입니다.');return}
 if(rows.some(r=>r.id===id)){openDetail(id);return}
 const db=bridge()?.getClient(),me=bridge()?.getUser()?.id;
 if(!db){notice('서버에 연결하지 못했습니다. 다시 시도하세요.');return}
 try{const {data,error}=await db.rpc('pickgo_match_get',{p_id:id});if(me!==bridge()?.getUser()?.id)return;if(error)throw error;
 const r=Array.isArray(data)?data[0]:null;if(!r){notice('이 경기는 취소·종료되었거나 현재 볼 수 없습니다.');return}const enriched=await attachPlanInfo([r],db);if(me!==bridge()?.getUser()?.id)return;rows=rows.filter(x=>x.id!==id).concat(enriched);render();openDetail(id);
 }catch(e){void window.PICKGO_DIAGNOSTICS?.report('match_detail',e,me);notice(errorMessage(e))}
}

function login(){if(bridge()?.getUser())return true;if($('matchComposer').open)$('matchComposer').close();window.PICKGO_AUTH_UI?.open('login');notice('로그인 후 이용해 주세요.');return false}
function errorMessage(e){if(['PGRST202','42883','42P01'].includes(e?.code))return '서비스에 연결할 수 없습니다. 잠시 후 다시 시도하세요.';return e?.message||'연결을 확인하고 다시 시도하세요.'}
async function load(){const seq=++sequence,db=bridge()?.getClient(),me=bridge()?.getUser()?.id;
 if(!db){loadError=true;notice('서버에 연결하지 못했습니다. 새로고침하세요.');render();return}
 listLoading=true;loadError=false;render();try{const result=await db.rpc('pickgo_match_list');if(seq!==sequence||me!==bridge()?.getUser()?.id)return;if(result.error)throw result.error;const enriched=await attachPlanInfo((result.data||[]).filter(row=>window.PICKGO_PUBLIC_SCOPE?.allows(row.venue_id)),db);if(seq!==sequence||me!==bridge()?.getUser()?.id)return;rows=enriched;notice('경기 시간은 한국시간입니다. 참가 신청은 구장 예약이 아닙니다.');listLoading=false;render();if(selectedId)void loadMembers();
 if(!deepLinkHandled&&validId(requestedMatch)){deepLinkHandled=true;await resolveDetail(requestedMatch)}
 }catch(e){if(seq!==sequence)return;void window.PICKGO_DIAGNOSTICS?.report('match_list',e,me);rows=[];loadError=true;notice(errorMessage(e))}finally{if(seq===sequence){listLoading=false;render()}}
}

async function act(id,action){if(busy||!login())return;const requestUser=bridge()?.getUser()?.id;if(action!=='join'&&!window.confirm(action==='cancel'?'이 경기 모집을 취소할까요? 참가자에게 취소 상태가 표시됩니다.':'참가를 취소할까요?'))return;busy=true;render();try{const {error}=await bridge().getClient().rpc('pickgo_match_action',{p_id:id,p_action:action});if(error)throw error;await load();window.PICKGO_INBOX?.refresh();window.PICKGO_MY_GAMES?.refreshIfOpen()}catch(e){void window.PICKGO_DIAGNOSTICS?.report('match_'+action,e,requestUser);notice(errorMessage(e))}finally{busy=false;render()}}
$('matchForm').addEventListener('submit',async e=>{e.preventDefault();if(busy||!login())return;
const day=$('matchDay').value,start=$('matchStart').value,end=$('matchEnd').value;
const startIso=day+'T'+start+':00+09:00',endIso=day+'T'+end+':00+09:00';
if(!day||!start||!end||!Number.isFinite(+new Date(startIso))||!Number.isFinite(+new Date(endIso))||new Date(startIso)<=new Date()||new Date(endIso)<=new Date(startIso)||new Date(endIso)-new Date(startIso)>8*3600000){notice('미래의 날짜와 시간을 선택하세요. 종료는 같은 날, 최대 8시간 이내입니다.');return}
const editingId=editing?.id,requestUser=bridge()?.getUser()?.id;
const bookingState=$('matchBookingState')?.value||'planned';
if(!COURTS.some(v=>v.id===$('matchVenue').value)||!['booked','planned','walk_in'].includes(bookingState)||(bookingState==='walk_in'&&!['court-42','court-43'].includes($('matchVenue').value))){notice('구장과 코트 이용 상태를 확인하세요.');return}
if(!$('matchReserved').checked){notice('구장·시간과 코트 이용 상태 확인에 체크해 주세요.');return}
if(editingId&&Number($('matchCapacity').value)<(rows.find(r=>r.id===editingId)?.attendees||0)){notice('현재 참가 인원보다 정원을 줄일 수 없습니다.');return}
busy=true;render();try{
 const args={p_venue_id:$('matchVenue').value,p_starts_at:startIso,p_ends_at:endIso,p_capacity:Number($('matchCapacity').value),p_skill:$('matchSkill').value,p_note:$('matchNote').value,p_reserved:$('matchReserved').checked};
 if(editingId){args.p_id=editingId;args.p_expected={venue_id:editing.venue_id,starts_at:editing.starts_at,ends_at:editing.ends_at,capacity:editing.capacity,skill:editing.skill,note:editing.note}}
 args.p_booking_state=bookingState;delete args.p_reserved;
 if(editingId){args.p_expected_booking_state=editing.booking_state}else{const payload=JSON.stringify(args);if(!createRequest||createRequest.payload!==payload)createRequest={payload,id:crypto.randomUUID()};args.p_request_id=createRequest.id}
 const {error}=await bridge().getClient().rpc(editingId?'pickgo_match_update_simple':'pickgo_match_create_simple',args);if(error)throw error;if(requestUser!==bridge()?.getUser()?.id)return;
 resetEditor();$('matchComposer').close();await load();window.PICKGO_INBOX?.refresh();window.PICKGO_MY_GAMES?.refreshIfOpen();notice(editingId?'모집을 수정했습니다. 참가자에게 앱 내 알림이 생성됩니다.':'경기 모집이 등록되었습니다. 주최자가 첫 참가자로 포함됩니다.');
}catch(err){if(requestUser!==bridge()?.getUser()?.id)return;void window.PICKGO_DIAGNOSTICS?.report(editingId?'match_update':'match_create',err,requestUser);notice(errorMessage(err))}finally{busy=false;render()}});

for(const id of ['matchFilterDay','matchFilterSkill','matchOpenOnly','matchSort'])$(id)?.addEventListener('change',render);
$('matchSearch')?.addEventListener('input',render);
$('matchClearFilters')?.addEventListener('click',()=>clearFilters());
$('matchComposeOpen')?.addEventListener('click',()=>{if(busy||!login())return;resetEditor();if($('matchComposeTitle'))$('matchComposeTitle').textContent='경기 모집하기';if($('matchComposeNotice'))$('matchComposeNotice').textContent='';$('matchComposer').showModal()});
$('matchComposeClose')?.addEventListener('click',()=>{if(!busy)$('matchComposer').close()});
$('matchComposer').addEventListener('cancel',e=>{if(busy)e.preventDefault()});
$('matchComposer').addEventListener('close',()=>{resetEditor();if($('matchComposeNotice'))$('matchComposeNotice').textContent=''});
$('matchRegion').addEventListener('change',render);$('matchMine').addEventListener('change',render);$('matchRefresh').addEventListener('click',load);
const regions=[...new Set(COURTS.map(v=>v.region))];for(const region of regions){const o=element('option',region);o.value=region;$('matchRegion').append(o)}
$('matchVenue').addEventListener('change',bookingOptions);venueOptions();const observer=new MutationObserver(venueOptions);const dbStatus=$('explore');if(dbStatus)observer.observe(dbStatus,{childList:true,subtree:true});
$('matchReportForm')?.addEventListener('submit',async e=>{e.preventDefault();if(reportBusy||!login()||!selectedId)return;const requestUser=bridge()?.getUser()?.id;const id=selectedId,text=$('matchReportText').value.trim(),info=$('matchReportNotice');if(text.length<5||text.length>500){info.textContent='5~500자로 작성하세요.';return}reportBusy=true;$('matchReportSubmit').disabled=true;info.textContent='신고를 접수하는 중…';try{const {error}=await bridge().getClient().rpc('pickgo_report_match',{p_id:id,p_reason:$('matchReportReason').value,p_details:text});if(error)throw error;info.textContent='신고를 접수했습니다. 운영자가 검토합니다.';$('matchReportForm').reset()}catch(err){void window.PICKGO_DIAGNOSTICS?.report('match_report',err,requestUser);info.textContent=errorMessage(err)}finally{reportBusy=false;$('matchReportSubmit').disabled=false}});
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());$('matchDay').min=today;$('matchDay').max=new Date(Date.now()+90*86400000+9*3600000).toISOString().slice(0,10);
const client=bridge()?.getClient();client?.auth.onAuthStateChange((event,session)=>{const reopenId=selectedId;sequence++;listLoading=false;clearRoster();if($('matchComposer').open&&session?.user?.id!==composerOwner){$('matchComposer').close();resetEditor()}rows=[];render();setTimeout(async()=>{await load();if(reopenId&&session?.user)await resolveDetail(reopenId)},0)});load();
})();
