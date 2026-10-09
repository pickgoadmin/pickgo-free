/* PICKGO 1.0.1: admin-only review for official-page suggestions.
   Browser never publishes automatically. Supabase RPC checks administrator privileges,
   stale row versions and writes an immutable evidence log in one transaction. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const FIELDS={contact_phone:'전화번호',operating_hours:'운영시간',price_info:'이용 요금',official_url:'공식 안내 URL',booking_url:'예약 URL',booking_url_weekend:'주말 예약 URL'};
 let client=null, items=[], rows=new Map(), checked=new Set(),busy=false, status=[];
 const message=(msg,error=false)=>{const el=$('reviewMessage');if(!el)return;el.textContent=msg;el.className='hint '+(error?'error':'ok')};
 const safeURL=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname&&s.length<=2000}catch{return false}};
 const normalizeDomain=url=>new URL(url).hostname.toLowerCase().replace(/^www\./,'');
 const sameHost=(a,b)=>{try{return normalizeDomain(a)===normalizeDomain(b)}catch{return false}};
 function valid(x){return x&&/^court-\d{2,6}$/.test(x.id||'')&&FIELDS[x.field]&&typeof x.value==='string'&&x.value.trim().length>0&&x.value.length<=500&&safeURL(x.source_url)&&(x.field.endsWith('_url')?safeURL(x.value):true)&&(!x.collected_at||!Number.isNaN(Date.parse(x.collected_at)))}
 const text=(t,cls)=>{const el=document.createElement('span');el.textContent=t||'';if(cls)el.className=cls;return el};
 async function loadRows(){const {data,error}=await client.from('pickgo_venues').select('id,name,address,official_url,contact_phone,operating_hours,price_info,booking_url,booking_url_weekend,updated_at,is_published').order('id',{ascending:true}).limit(500);if(error)throw error;rows=new Map((data||[]).map(v=>[v.id,v]));}
 async function fetchFile(){const response=await fetch('/venue_candidates.json?ts='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('후보 파일을 불러오지 못했습니다 ('+response.status+')');const data=await response.json();return data}
 async function fetchStatus(){try{const r=await fetch('/venue_source_status.json?ts='+Date.now(),{cache:'no-store'});if(r.ok){const doc=await r.json();return Array.isArray(doc.venues)?doc.venues:[]}}catch{}return []}
 function filter(data){if(!data||data.schema_version!==1||!Array.isArray(data.candidates)||data.candidates.length>1000)throw Error('지원되지 않는 제안서 형식입니다.');const seen=new Set();return data.candidates.filter(valid).filter(x=>{const key=x.id+'|'+x.field;if(seen.has(key))return false;seen.add(key);return true})}
 function availability(){const total=rows.size, official=[...rows.values()].filter(x=>safeURL(x.official_url)).length;const lacking=[...rows.values()].filter(x=>!x.contact_phone||!x.operating_hours||!x.price_info).length;const counts={missing:status.filter(x=>x.state==='missing_official_url').length,errors:status.filter(x=>x.state==='fetch_failed').length};$('sourceSummary').textContent=`DB 구장 ${total}개 · 공식 홈페이지 등록 ${official}개 · 전화번호/시간/요금 중 미완성 ${lacking}개 · 검토 후보 ${items.length}개`+(status.length?` · 출처 부족 ${counts.missing}개 · 수집 실패 ${counts.errors}개`:'');}
 function render(){const root=$('reviewItems');if(!root)return;root.replaceChildren();let visible=0;
  for(const suggestion of items){const venue=rows.get(suggestion.id);if(!venue||!venue.is_published)continue;
   if(!safeURL(venue.official_url)||!sameHost(venue.official_url,suggestion.source_url))continue;
   if(venue[suggestion.field])continue; // Never automatically replace manually maintained content.
   const key=suggestion.id+'|'+suggestion.field;visible++;
   const outer=document.createElement('div');outer.style.cssText='border:1px solid var(--line);padding:13px;border-radius:12px;background:#f9fbf7;display:grid;gap:7px';
   const heading=document.createElement('label');heading.style.cssText='display:flex;gap:9px;align-items:center;font-weight:800';const cb=document.createElement('input');cb.type='checkbox';cb.checked=checked.has(key);cb.setAttribute('aria-label',venue.name+' '+FIELDS[suggestion.field]+' 제안 선택');cb.addEventListener('change',()=>{cb.checked?checked.add(key):checked.delete(key);syncCount()});heading.append(cb,text(venue.name+' · '+FIELDS[suggestion.field]));outer.append(heading);
   const details=document.createElement('div');details.className='muted';details.textContent='현재: (미등록)   →   제안: '+suggestion.value;outer.append(details);
   const link=document.createElement('a');link.href=suggestion.source_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='원문 확인 ↗';link.style.color='#2c6b3c';outer.append(link);
   const small=document.createElement('small');small.className='muted';small.textContent='자동 추출 · 수집일: '+(suggestion.collected_at?new Date(suggestion.collected_at).toLocaleString('ko-KR'):'미제공')+' · 관리자 승인 전 비공개';outer.append(small);root.append(outer);
  }
  if(!visible){const empty=document.createElement('p');empty.className='empty';empty.textContent='검토할 자동 수집 후보가 없습니다. 공식 출처를 등록하고 GitHub Actions에서 수집을 실행하거나 검토용 JSON을 가져오세요.';root.append(empty)}
  availability();syncCount();}
 function syncCount(){$('approveSelected').disabled=busy||!checked.size;$('approveSelected').textContent=busy?'적용 중…':`선택한 변경 승인 (${checked.size})`}
 async function reload(){if(!client)return;message('후보를 불러오는 중…');try{const [doc,stats]=await Promise.all([fetchFile(),fetchStatus()]);status=stats;await loadRows();items=filter(doc);checked.clear();render();message(`검토 후보 ${items.length}개를 읽었습니다. 실제 승인 전 원문을 확인하세요.`)}catch(e){message(e.message||'후보 조회 실패',true)}}
 async function approve(){if(busy||!client)return;const selected=items.filter(x=>checked.has(x.id+'|'+x.field));if(!selected.length)return;
  if(!confirm(`선택한 정보 ${selected.length}건을 DB에 반영하시겠습니까? 각 항목의 원문을 확인했는지 검토해 주세요.`))return;
  busy=true;syncCount();let done=0,unchanged=0,fail=[];
  for(const proposal of selected){const venue=rows.get(proposal.id);const key=proposal.id+'|'+proposal.field;
   if(!venue||!valid(proposal)||!sameHost(venue.official_url||'',proposal.source_url)){fail.push(key+' 출처 확인 필요');continue}
   try{
    // Check server row immediately before write; optimistic lock is enforced again by RPC.
    const {data,error:readErr}=await client.from('pickgo_venues').select('id,official_url,updated_at,'+proposal.field).eq('id',proposal.id).single();if(readErr)throw readErr;
    if(data[proposal.field]){fail.push(key+' 이미 입력됨');continue}
    if(!sameHost(data.official_url||'',proposal.source_url))throw Error('등록된 공식 출처와 다릅니다');
    const {data:answer,error}=await client.rpc('pickgo_approve_venue_suggestion',{p_venue_id:proposal.id,p_field:proposal.field,p_value:proposal.value.trim(),p_source_url:proposal.source_url,p_expected_updated_at:data.updated_at,p_collected_at:proposal.collected_at||null});if(error)throw error;
    if(answer?.applied)done++;else unchanged++;
    checked.delete(key);
   }catch(e){fail.push(key+' '+(e.message||'error'))}
  }
  busy=false;await loadRows();render();message(`완료 ${done}건 · 기존값 동일 ${unchanged}건 · 실패 ${fail.length}건`+(fail.length?' / '+fail.slice(0,3).join('; '):''),!!fail.length)}
 function csvTemplate(){const blob=new Blob([JSON.stringify({schema_version:1,candidates:[]},null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.download='PICKGO_구장_정보_검토_양식.json';a.href=URL.createObjectURL(blob);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
 $('reviewReload').addEventListener('click',()=>void reload());$('downloadCandidates').addEventListener('click',csvTemplate);
 $('candidateUpload').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1_000_000)throw Error('1MB 이하 JSON 파일만 가능합니다');const doc=JSON.parse(await file.text());items=filter(doc);checked.clear();await loadRows();render();message('외부 JSON 후보 '+items.length+'개를 불러왔습니다. 검토 후 승인하세요.')}catch(err){message(err.message,true)}finally{e.target.value=''}});
 $('approveSelected').addEventListener('click',()=>void approve());$('clearSelection').addEventListener('click',()=>{checked.clear();render()});
 window.addEventListener('pickgo:admin-ready',e=>{client=e.detail?.client;if(client)void reload()});
})();
