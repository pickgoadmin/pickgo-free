/* Verified public facilities and public programs only. No credentials or inferred free time windows. */
(()=>{'use strict';
 let ids=new Set(['court-01', 'court-08', 'court-09', 'court-42', 'court-43', 'court-33', 'court-44', 'court-45', 'court-46']);
 window.PICKGO_PUBLIC_SCOPE=Object.freeze({
  allows:id=>ids.has(id),
  ids:()=>[...ids],
  async refresh(db){
   const {data,error}=await db.from('pickgo_public_facilities').select('venue_id');
   if(error||!Array.isArray(data))throw error||Error('Invalid public facility registry');
   ids=new Set(data.map(v=>v.venue_id).filter(id=>/^court-\d+$/.test(id)));
  }
 });
})();
