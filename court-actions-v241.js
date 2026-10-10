/* One consistent action order for every public court. */
(()=>{'use strict';
 const safe=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
 window.PICKGO_COURT_ACTIONS=venue=>{
  const official=safe(venue.officialUrl)||safe(venue.source);
  const weekday=safe(venue.bookingUrl)||official;
  const weekend=safe(venue.bookingUrlWeekend)||weekday;
  return {official,weekday,weekend,guideOnly:!safe(venue.bookingUrl)};
 };
})();
