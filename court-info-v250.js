/* Reviewed guide snapshot; refreshes never turn the review date into a live reservation check. */
(()=>{'use strict';
 const profiles={"court-01":{"id":"court-01","name":"광나루한강공원 피클볼장","address":"서울특별시 강동구 선사로 83-106","officialUrl":"https://hangang.seoul.go.kr/www/bbsPost/17/653/detail.do?mid=604","priceInfo":"평일 4,000원 / 주말 5,200원 (1시간)","operatingHours":"","contactPhone":"","checkedOn":"2026-10-10"},"court-08":{"id":"court-08","name":"서울숲 배드민턴장2 피클볼 코트","address":"서울특별시 성동구 뚝섬로 273 (성수동1가)","officialUrl":"https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260630100736476282&locale=ko","priceInfo":"무료","operatingHours":"","contactPhone":"02-460-2983 / 주말·공휴일 02-460-2998","checkedOn":"2026-10-10"},"court-09":{"id":"court-09","name":"서대문구 다목적체육시설 피클볼","address":"서울특별시 서대문구 거북골로 34 명지대학교 MCC관 1층","officialUrl":"https://sdm.go.kr/news/news/notice.do?mode=view&sdmBoardConfSeq=106&sdmBoardSeq=307763","priceInfo":"월별 공고 확인","operatingHours":"","contactPhone":"02-330-8826 / 02-3140-8320","checkedOn":"2026-10-10"},"court-42":{"id":"court-42","name":"산내 다목적 실내체육관","address":"경기도 파주시 · 산내 다목적 실내체육관 (상세 위치는 지도 확인)","officialUrl":"https://www.paju.go.kr/www/paticipation/paticipation_04/paticipation_04_13/paticipation_04_13_02.jsp","priceInfo":"무료","operatingHours":"피클볼 월·목·토 / 09:30~21:30 중 운영 회차 확인","contactPhone":"","checkedOn":"2026-10-10"},"court-43":{"id":"court-43","name":"오치복합커뮤니티센터","address":"광주광역시 북구 서하로194번길 6","officialUrl":"https://www.gbfmc.or.kr/menu.es?mid=a10401090000","priceInfo":"일·월 이용권 요금 공식 안내 확인","operatingHours":"","contactPhone":"","checkedOn":"2026-10-10"},"court-33":{"id":"court-33","name":"운암복합문화체육센터","address":"광주광역시 북구 북문대로98번길 20","officialUrl":"https://www.gbfmc.or.kr/menu.es?mid=a10401080000","priceInfo":"강좌별 공식 안내 확인","operatingHours":"","contactPhone":"","checkedOn":"2026-10-10"},"court-44":{"id":"court-44","name":"광진구민체육센터","address":"서울특별시 광진구 구천면로 14 (광장동)","officialUrl":"https://booking.gwangjin.or.kr/fmcs/49","priceInfo":"강좌별 공식 안내 확인","operatingHours":"","contactPhone":"02-2049-4800","checkedOn":"2026-10-10"},"court-45":{"id":"court-45","name":"영등포 제2스포츠센터","address":"서울특별시 영등포구 국회대로 615","officialUrl":"https://spc2.y-sisul.or.kr/?s_center=2","priceInfo":"프로그램별 공식 안내 확인","operatingHours":"","contactPhone":"02-2630-2900","checkedOn":"2026-10-10"},"court-46":{"id":"court-46","name":"하하캠퍼스 피클볼·테니스장","address":"부산광역시 금정구 기찰로102번길 56-7 부산가톨릭대학교 신학교정","officialUrl":"https://www.busan.go.kr/hahacampus/majungmul02","priceInfo":"이용·대관 요금 공식 안내 확인","operatingHours":"","contactPhone":"051-519-0351 / 051-519-0440","checkedOn":"2026-10-10"}};
 window.PICKGO_COURT_INFO={
  get:id=>profiles[id]||null,
  details:venue=>{
   const snapshot=profiles[venue.id]||{};
   return {
    price:venue.priceInfo||snapshot.priceInfo||'공식 안내에서 확인',
    hours:venue.operatingHours||snapshot.operatingHours||'시설별 운영 일정 확인 필요',
    phone:venue.contactPhone||snapshot.contactPhone||'공식 홈페이지 문의처 확인',
    checked:snapshot.checkedOn?snapshot.checkedOn.replaceAll('-','.'):'확인 날짜 미등록'
   };
  }
 };
})();
