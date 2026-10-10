/* PICKGO v1.0: published venues are loaded from Supabase after original v0.9.1 UI initializes.
   Only bundled verified public API facilities remain available if DB tables do not exist or the network is offline. */
(()=>{'use strict';
 const toHttps=(url)=>{try{let u=new URL(url);return u.protocol==='https:'?u.href:''}catch{return ''}};
 const mapVenue=(v)=>({
  id:v.id, name:v.name, region:v.region, address:v.address,
  type:v.court_type||'\uBBF8\uD655\uC778',
  bookingStatus:v.booking_status||'\uBB38\uC758',
  note:v.note||'', source:toHttps(v.source_url), bookingUrl:toHttps(v.booking_url),
  bookingUrlWeekend:toHttps(v.booking_url_weekend),
  officialUrl:toHttps(v.official_url), imageUrl:toHttps(v.image_url),
  operatingHours:v.operating_hours||'', contactPhone:v.contact_phone||'',
  priceInfo:v.price_info||'',
  lat:v.latitude==null?undefined:Number(v.latitude),
  lng:v.longitude==null?undefined:Number(v.longitude),
  locationAccuracy:v.location_accuracy||'', locationSource:v.location_source||''
 });
 const note=(text)=>{let host=document.querySelector('.resulthead');if(!host)return;
   let el=document.getElementById('pickgoDbStatus');if(!el){el=document.createElement('small');el.id='pickgoDbStatus';el.className='pickgo-db-status';host.querySelector('div')?.append(el)}el.textContent=text;
 };
 async function load(){
  const bridge=window.PICKGO_AUTH_BRIDGE;
  const client=bridge?.getClient?.();
  if(!client){note('\uAE30\uBCF8 \uAD6C\uC7A5 \uBAA9\uB85D \uD45C\uC2DC \uC911');return false}
  try{
   await window.PICKGO_PUBLIC_SCOPE.refresh(client);
   const ids=window.PICKGO_PUBLIC_SCOPE.ids();
   COURTS=COURTS.filter(v=>window.PICKGO_PUBLIC_SCOPE.allows(v.id));
   render();
   if(!ids.length){note('공개 API 시설이 아직 없습니다.');return true}
   const {data,error}=await client.from('pickgo_venues')
    .select('id,name,region,address,court_type,booking_status,note,source_url,booking_url,booking_url_weekend,official_url,price_info,operating_hours,contact_phone,image_url,latitude,longitude,location_accuracy,location_source,sort_order')
    .eq('is_published',true).in('id',ids).order('sort_order',{ascending:true}).order('id',{ascending:true}).limit(500);
   if(error)throw error;
   if(!Array.isArray(data))throw Error('Unexpected venues payload')
   const clean=data.filter(v=>window.PICKGO_PUBLIC_SCOPE.allows(v.id)&&v.name&&v.address).map(mapVenue);
   
   COURTS=clean;
   render();
   document.getElementById('verifiedCount').textContent=COURTS.filter(v=>v.bookingStatus==='\uACF5\uC2DD\uC608\uC57D'&&v.bookingUrl).length;
   note('\uAD6C\uC7A5 \uC815\uBCF4: Supabase \uB3D9\uAE30\uD654');
   return true;
  }catch(e){console.warn('PICKGO v1.0 catalog fallback:',e?.message||e);note('\uC624\uD504\uB77C\uC778/DB \uBBF8\uC5F0\uACB0: 공공 API 구장 \uD45C\uC2DC');return false}
 }

 async function syncAdminLink(){
  const link=document.getElementById('adminPanelLink');if(!link)return;
  const bridge=window.PICKGO_AUTH_BRIDGE,db=bridge?.getClient?.(),user=bridge?.getUser?.();
  if(!db||!user){link.hidden=true;return}
  try{const {data,error}=await db.from('pickgo_admins').select('user_id').eq('user_id',user.id).maybeSingle();link.hidden=!!error||!data}
  catch{link.hidden=true}
 }
 const client=window.PICKGO_AUTH_BRIDGE?.getClient?.();
 client?.auth?.onAuthStateChange?.(()=>setTimeout(()=>void syncAdminLink(),0));
 void syncAdminLink();
 window.PICKGO_RELOAD_VENUES=load;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void load(),{once:true});else void load();
})();
