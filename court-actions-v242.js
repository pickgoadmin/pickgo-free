/* Show court reservation actions only for verified booking destinations. */
(()=>{'use strict';
 const safe=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
 const methods={
  'court-01':['온라인 코트 예약','평일·주말 예약 페이지에서 이용일과 접수 조건을 확인하세요.'],
  'court-08':['온라인 코트 예약','평일·주말 모두 같은 예약 페이지에서 이용일과 운영 조건을 확인하세요.'],
  'court-09':['월별 대관 접수 안내','서울시 공공서비스예약의 월별 접수 공고를 확인하세요. 현재 접수 중인 예약 링크는 확인되지 않았습니다.'],
  'court-42':['무료 선착순 이용','무료 선착순 이용 시설입니다. 방문 전 피클볼 운영 요일과 회차를 확인하세요.'],
  'court-43':['이용권 발권 후 입장','일·월 이용권 발권 후 입장합니다. 피클볼 운영 일정은 공식 안내에서, 대관은 담당자에게 확인하세요.'],
  'court-33':['피클볼 강습 안내','피클볼 강습 프로그램을 운영합니다. 강습 접수와 자유 이용·대관 가능 여부는 센터에 확인하세요.'],
  'court-44':['피클볼 수강 신청 안내','피클볼 강습 수강 신청 시설입니다. 개별 코트 시간 예약은 확인되지 않았습니다.'],
  'court-45':['피클볼 프로그램 안내','피클볼 프로그램을 운영합니다. 강습 일정과 자유 이용·대관 조건은 센터에 확인하세요.'],
  'court-46':['단체 대관 문의','단체 이용은 대관이 필요합니다. 신청 방법과 이용 조건은 공식 안내 또는 운영 담당자에게 확인하세요.']
 };
 window.PICKGO_COURT_ACTIONS=venue=>{
  const official=safe(venue.officialUrl)||safe(venue.source);
  const verified=['court-01','court-08'].includes(venue.id);
  const weekday=verified?safe(venue.bookingUrl):'';
  const weekend=weekday?(safe(venue.bookingUrlWeekend)||weekday):'';
  const [method,hint]=methods[venue.id]||['이용 안내 확인','이용 방법은 공식 안내 또는 시설 담당자에게 확인하세요.'];
  return {official,weekday,weekend,method,hint,guideOnly:!weekday};
 };
})();
