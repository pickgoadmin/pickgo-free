/* PICKGO v1.0 administrator dashboard. Authorization is enforced by Supabase RLS. */
(()=>{'use strict';
 const PROJECT_URL='https://rgcailerllapibpvrsor.supabase.co';
 const PUBLIC_KEY='sb_publishable_lSJAMObgZLRAaQfJJPv6ag_CLZ6umFg';
 const $=id=>document.getElementById(id);
 const REGIONS=['\uC11C\uC6B8','\uACBD\uAE30','\uC778\uCC9C','\uAC15\uC6D0','\uB300\uC804','\uC138\uC885','\uCDA9\uBD81','\uCDA9\uB0A8','\uAD11\uC8FC','\uC804\uBD81','\uB300\uAD6C','\uBD80\uC0B0','\uC6B8\uC0B0','\uACBD\uBD81','\uACBD\uB0A8','\uC81C\uC8FC'];
 const TYPES=['\uBBF8\uD655\uC778','\uC2E4\uB0B4','\uC57C\uC678'];
 const STATUSES=['\uBB38\uC758','\uACF5\uC2DD\uC608\uC57D','\uACF5\uC2DD\uBB38\uC758','\uACF5\uACF5\uC608\uC57D\uAC80\uC0C9','\uB3D9\uD638\uD68C','\uC219\uBC15\uBB38\uC758'];
 const FIELDS=['id','name','region','address','court_type','booking_status','note','source_url','booking_url','booking_url_weekend','official_url','price_info','operating_hours','contact_phone','image_url','latitude','longitude','sort_order'];
 const URL_FIELDS=['source_url','booking_url','booking_url_weekend','official_url','image_url'];
 const NULLABLE=['note','source_url','booking_url','booking_url_weekend','official_url','price_info','operating_hours','contact_phone','image_url','latitude','longitude'];
 let client=null,venues=[],selected=null,creating=false,loggedIn=null,busy=false;
 const show=(id,on)=>{const el=$(id);if(el)el.hidden=!on};
 const message=(text,err=false)=>{const el=$('message');el.textContent=text;el.className='hint '+(err?'error':'ok')};
 const prettyErr=e=>e?.message||'Request failed. Check database settings, session and network.';
 const initSelect=(id,options)=>{const el=$(id);for(const s of options){const o=document.createElement('option');o.value=s;o.textContent=s;el.add(o)}};
 initSelect('region',REGIONS);initSelect('court_type',TYPES);initSelect('booking_status',STATUSES);
 function setBusy(v){busy=v;$('save').disabled=v;$('new').disabled=v;$('archive').disabled=v;$('delete').disabled=v}
 function pic(){const u=$('image_url').value.trim();const el=$('photoPreview');
   if(!u){el.hidden=true;el.removeAttribute('src');return}
   try{const parsed=new URL(u);if(parsed.protocol!=='https:')throw Error('HTTPS only');el.src=parsed.href;el.hidden=false;el.onerror=()=>{el.hidden=true}}catch{el.hidden=true;el.removeAttribute('src')}
 }
 $('image_url').addEventListener('change',pic);
 function clearForm(){selected=null;creating=true;show('formEmpty',false);show('venueForm',true);$('venueForm').reset();
   const ids=venues.map(v=>Number((v.id||'').replace(/^court-/,''))).filter(Number.isFinite);
   const next=Math.max(41,...ids)+1;
   $('id').value='court-'+String(next).padStart(2,'0');$('id').readOnly=false;
   $('sort_order').value=String(next);$('court_type').value=TYPES[0];$('booking_status').value=STATUSES[0];
   $('is_published').checked=true;$('formTitle').textContent='New court / '+$('id').value;
   show('preview',false);show('delete',false);show('archive',false);pic();}
 function fillForm(row){selected=row.id;creating=false;show('formEmpty',false);show('venueForm',true);
  for(const field of FIELDS){let el=$(field);if(el)el.value=row[field]??''}
  $('id').readOnly=true;$('is_published').checked=row.is_published!==false;
  $('formTitle').textContent=row.name;
  $('preview').href='/court.html?id='+encodeURIComponent(row.id);
  show('preview',row.is_published!==false);show('delete',true);show('archive',row.is_published!==false);pic();renderList();}
 function renderList(){const q=$('query').value.trim().toLocaleLowerCase('ko');const rows=venues.filter(v=>(v.name+' '+v.region+' '+v.id+' '+v.address).toLocaleLowerCase('ko').includes(q));
  $('count').textContent='('+venues.length+')';const root=$('venueList');root.replaceChildren();
  if(!rows.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No matching courts.';root.append(empty);return}
  for(const row of rows){const btn=document.createElement('button');btn.type='button';btn.className='item'+(selected===row.id?' sel':'');
   const name=document.createElement('strong');name.textContent=row.name;
   if(!row.is_published){const tag=document.createElement('span');tag.className='badge off';tag.textContent='Hidden';name.append(tag)}
   const desc=document.createElement('small');desc.textContent=row.id+' | '+row.region+' | '+row.address;
   btn.append(name,desc);btn.addEventListener('click',()=>fillForm(row));root.append(btn)} }
 async function list(){const {data,error}=await client.from('pickgo_venues').select('*').order('sort_order',{ascending:true}).order('id',{ascending:true}).limit(500);
   if(error)throw error;venues=data||[];renderList();}
 async function hasAdmin(){const {data:{user},error:authErr}=await client.auth.getUser();if(authErr||!user){loggedIn=null;return 'login'}
  loggedIn=user;$('account').textContent=user.email||user.id;
  const {data,error}=await client.from('pickgo_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(error)throw error;return data?'admin':'denied'; }
 async function boot(){
  show('loading',true);show('workspace',false);show('authPanel',false);show('denied',false);
  try{const mode=await hasAdmin();show('loading',false);show('logout',mode!=='login');
   if(mode==='login'){show('authPanel',true);return}
   if(mode==='denied'){show('denied',true);return}
   await list();show('workspace',true);show('venueForm',false);show('formEmpty',true);message('Admin access confirmed. Venue data loaded.');
  }catch(e){show('loading',false);show('denied',true);message(prettyErr(e),true)}
 }
 async function save(e){e.preventDefault();if(busy)return;setBusy(true);
  try{
   const row={};for(const field of FIELDS){const el=$(field);if(!el)continue;const val=el.value.trim();
    row[field]=NULLABLE.includes(field)&&!val?null:val;
   }
   row.latitude=row.latitude===null?null:Number(row.latitude);
   row.longitude=row.longitude===null?null:Number(row.longitude);
   row.sort_order=Number(row.sort_order)||1000;
   row.is_published=$('is_published').checked;
   for(const key of URL_FIELDS){if(!row[key])continue;const u=new URL(row[key]);if(u.protocol!=='https:')throw Error('Only HTTPS URLs are allowed: '+key)}
   if(!row.name||!row.address)throw Error('Name and address are required.');
   let res=creating?await client.from('pickgo_venues').insert(row).select('id').single():await client.from('pickgo_venues').update(row).eq('id',selected).select('id').single();
   if(res.error)throw res.error;await list();const saved=venues.find(v=>v.id===res.data.id);if(saved)fillForm(saved);
   message('Saved: '+res.data.id+'. Public visitors will see changes after refresh.');
  }catch(err){message(prettyErr(err),true)}finally{setBusy(false)}
 }
 async function unpublish(){if(!selected||busy)return;if(!confirm('Hide this court from all public listings?'))return;
  setBusy(true);try{const {error}=await client.from('pickgo_venues').update({is_published:false}).eq('id',selected);
   if(error)throw error;await list();const v=venues.find(x=>x.id===selected);if(v)fillForm(v);message('Court is now unpublished.')
  }catch(e){message(prettyErr(e),true)}finally{setBusy(false)}
 }
 async function deleteCourt(){if(!selected||busy)return;const v=venues.find(x=>x.id===selected);
  const typed=prompt('Permanently delete '+(v?.name||selected)+'? Enter its court ID to confirm:');
  if(typed!==selected)return;setBusy(true);
  try{const {error}=await client.from('pickgo_venues').delete().eq('id',selected);if(error)throw error;
   await list();selected=null;show('venueForm',false);show('formEmpty',true);message('Permanently deleted: '+typed);
  }catch(e){message(prettyErr(e),true)}finally{setBusy(false)}
 }
 $('query').addEventListener('input',renderList);$('new').onclick=clearForm;$('venueForm').addEventListener('submit',save);
 $('archive').onclick=unpublish;$('delete').onclick=deleteCourt;
 $('authForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('email').value.trim(),password=$('password').value;
  try{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await boot()}catch(err){message(prettyErr(err),true)}
 });
 $('google').onclick=async()=>{try{const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/admin.html'}});if(error)throw error}catch(e){message(prettyErr(e),true)}};
 $('logout').onclick=async()=>{await client.auth.signOut();loggedIn=null;await boot()};$('retry').onclick=()=>void boot();
 if(!window.supabase?.createClient){$('loading').textContent='Failed to load Supabase library. Check network connection.';return}
 client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY);
 client.auth.onAuthStateChange(()=>{setTimeout(()=>{if(!busy)void boot()},0)});
 void boot();
})();
