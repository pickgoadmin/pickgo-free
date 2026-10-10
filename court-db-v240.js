/* PICKGO v1.0 venue detail hydrator. No logged-in session or private key required. */
(()=>{'use strict';
 const id=new URL(location.href).searchParams.get('id');
 if(!id||!/^court-[0-9]{2,6}$/.test(id))return;
 const url='https://rgcailerllapibpvrsor.supabase.co';
 const key='sb_publishable_lSJAMObgZLRAaQfJJPv6ag_CLZ6umFg';
 const $=x=>document.getElementById(x);
 const safe=(v)=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
 const generic=['https://yeyak.seoul.go.kr/web/main.do?locale=ko','https://yeyak.seoul.go.kr/','https://pickleballkorea.com/venues'];
 async function hydrate(){
  if(!window.supabase?.createClient)return;
  try{
   const client=window.supabase.createClient(url,key);
   await window.PICKGO_PUBLIC_SCOPE.refresh(client);
   if(!window.PICKGO_PUBLIC_SCOPE.allows(id)){$('detailCard').hidden=true;$('notFound').hidden=false;document.title='PICKGO | Not found';return}
   const {data,error}=await client.from('pickgo_venues').select('*').eq('id',id).eq('is_published',true).maybeSingle();
   if(error)throw error;
   if(!data){$('detailCard').hidden=true;$('notFound').hidden=false;document.title='PICKGO | Not found';return}
   $('detailCard').hidden=false;$('notFound').hidden=true;
   document.title=data.name+' | PICKGO';
   document.querySelector('meta[name="description"]').content=data.name+' - '+data.address;
   document.querySelector('meta[property="og:title"]').content=data.name+' | PICKGO';
   document.querySelector('meta[property="og:description"]').content=data.address;
   $('name').textContent=data.name;$('address').textContent=data.address;
   $('region').textContent=data.region;$('type').textContent=data.court_type;
   $('status').textContent=data.booking_status==='공식예약'?'공식 예약 안내':'이용 안내 확인';
   $('note').textContent=data.note||'이용 조건은 공식 안내에서 확인하세요.';
   const map='https://map.naver.com/p/search/'+encodeURIComponent(data.name+' '+data.address);
   $('map').href=map;
   $('official').href=safe(data.official_url)||map;
   $('official').textContent=safe(data.official_url)?'공식 시설 안내 열기 ↗':'네이버 지도에서 확인 ↗';
   const book=safe(data.booking_url);
   $('book').hidden=!book||generic.includes(book)||book===$('official').href;
   if(!$('book').hidden)$('book').href=book;
   const img=$('venuePhoto');const photo=safe(data.image_url);
   if(photo){img.src=photo;img.alt=data.name;img.hidden=false;img.onerror=()=>{img.hidden=true;img.removeAttribute('src')}}
   else{img.hidden=true;img.removeAttribute('src')}
   const extra=$('venueExtras');let has=false;
   for(const [id,value,prefix] of [['extraPrice',data.price_info,'요금'],['extraHours',data.operating_hours,'운영'],['extraPhone',data.contact_phone,'문의']]){
    const node=$(id);node.hidden=!value;if(value){node.textContent=prefix+': '+value;has=true}
   }
   extra.hidden=!has;
  }catch(e){console.warn('Court data unavailable; using original bundled information:',e?.message||e)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void hydrate(),{once:true});else void hydrate();
})();
