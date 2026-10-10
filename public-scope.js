/* Public API facilities only. No credentials or inferred free time windows. */
(()=>{'use strict';
 let ids=new Set(['court-01']);
 window.PICKGO_PUBLIC_SCOPE=Object.freeze({
  allows:id=>ids.has(id),
  ids:()=>[...ids],
  async refresh(db){
   const {data,error}=await db.from('pickgo_public_api_facilities').select('venue_id');
   if(error||!Array.isArray(data))throw error||Error('Invalid API facility registry');
   ids=new Set(data.map(v=>v.venue_id).filter(id=>/^court-\d+$/.test(id)));
  }
 });
})();
