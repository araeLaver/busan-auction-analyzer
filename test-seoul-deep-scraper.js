const CourtAuctionDeepScraper = require('./src/scraper/CourtAuctionDeepScraper');

async function testSeoulDeepScraper() {
  const scraper = new CourtAuctionDeepScraper();
  
  try {
    console.log('🚀 서울중앙지방법원 심층 스크래핑 테스트 시작...');
    console.log('=' .repeat(60));
    
    // 브라우저 보이게 설정 (headless: false)
    await scraper.initialize(false);
    
    // 서울중앙지방법원 경매 물건 스크래핑
    const properties = await scraper.scrapeSeoulCourt();
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 스크래핑 완료 요약');
    console.log('=' .repeat(60));
    console.log(`✅ 총 수집된 물건: ${properties.length}개\n`);
    
    if (properties.length > 0) {
      // 담당계별 통계
      const departmentStats = {};
      properties.forEach(prop => {
        if (!departmentStats[prop.department]) {
          departmentStats[prop.department] = 0;
        }
        departmentStats[prop.department]++;
      });
      
      console.log('📌 담당계별 물건 수:');
      Object.entries(departmentStats).forEach(([dept, count]) => {
        console.log(`   ${dept}: ${count}개`);
      });
      
      // 물건 유형별 통계
      const typeStats = {};
      properties.forEach(prop => {
        const type = prop.propertyType || '기타';
        if (!typeStats[type]) {
          typeStats[type] = 0;
        }
        typeStats[type]++;
      });
      
      console.log('\n🏠 물건 유형별 분포:');
      Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}개`);
      });
      
      // 가격대별 통계
      const priceRanges = {
        '1억 미만': 0,
        '1억-5억': 0,
        '5억-10억': 0,
        '10억-30억': 0,
        '30억 이상': 0,
        '가격정보없음': 0
      };
      
      properties.forEach(prop => {
        const price = prop.minimumSalePrice;
        if (!price) {
          priceRanges['가격정보없음']++;
        } else if (price < 100000000) {
          priceRanges['1억 미만']++;
        } else if (price < 500000000) {
          priceRanges['1억-5억']++;
        } else if (price < 1000000000) {
          priceRanges['5억-10억']++;
        } else if (price < 3000000000) {
          priceRanges['10억-30억']++;
        } else {
          priceRanges['30억 이상']++;
        }
      });
      
      console.log('\n💰 가격대별 분포:');
      Object.entries(priceRanges).forEach(([range, count]) => {
        if (count > 0) {
          console.log(`   ${range}: ${count}개`);
        }
      });
      
      // 상위 10개 물건 상세 출력
      console.log('\n' + '=' .repeat(60));
      console.log('📋 수집된 물건 샘플 (상위 10개)');
      console.log('=' .repeat(60));
      
      properties.slice(0, 10).forEach((property, index) => {
        console.log(`\n${index + 1}. [${property.department}] ${property.caseNumber}`);
        console.log(`   📍 주소: ${property.address || '주소정보없음'}`);
        console.log(`   🏠 유형: ${property.propertyType || '미분류'}`);
        if (property.buildingName) {
          console.log(`   🏢 건물명: ${property.buildingName}`);
        }
        if (property.area) {
          console.log(`   📐 면적: ${property.area}`);
        }
        console.log(`   💰 감정가: ${property.appraisalValue ? property.appraisalValue.toLocaleString() + '원' : '정보없음'}`);
        console.log(`   💵 최저가: ${property.minimumSalePrice ? property.minimumSalePrice.toLocaleString() + '원' : '정보없음'}`);
        console.log(`   📅 매각일: ${property.auctionDate} ${property.auctionTime}`);
        console.log(`   🏛️ 법정: ${property.courtRoom || '미정'}`);
        if (property.failureCount > 0) {
          console.log(`   ⚠️ 유찰: ${property.failureCount}회`);
        }
        if (property.tenantStatus) {
          console.log(`   👥 임차인: ${property.tenantStatus}`);
        }
      });
      
      if (properties.length > 10) {
        console.log(`\n... 외 ${properties.length - 10}개 물건 더 있음`);
      }
      
      // 파일로 저장
      console.log('\n' + '=' .repeat(60));
      console.log('💾 데이터 저장 중...');
      
      await scraper.saveToJSON();
      await scraper.saveToCSV();
      
      console.log('✅ 파일 저장 완료!');
      console.log('   - seoul-court-properties.json');
      console.log('   - seoul-court-properties.csv');
      
    } else {
      console.log('❌ 수집된 물건이 없습니다.');
      console.log('\n가능한 원인:');
      console.log('1. 검색 조건이 잘못 설정됨');
      console.log('2. 해당 기간에 매각 물건이 없음');
      console.log('3. 페이지 구조 변경');
      console.log('\n스크린샷을 확인해주세요: search-results.png');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 테스트 완료!');
    console.log('브라우저가 10초 후 자동 종료됩니다...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('\n❌ 테스트 오류:', error);
    console.log('\n오류 스크린샷을 확인해주세요:');
    console.log('- seoul-court-error.png');
    console.log('- search-results.png');
    
  } finally {
    await scraper.close();
  }
}

// 실행
console.log('📢 서울중앙지방법원 심층 스크래핑 테스트');
console.log('이 테스트는 다음 작업을 수행합니다:');
console.log('1. 기일별 검색 페이지 접속');
console.log('2. 서울중앙지방법원 선택 및 검색');
console.log('3. 매각기일별 담당계 확인');
console.log('4. 각 담당계 상세 페이지 진입');
console.log('5. 모든 물건 정보 수집');
console.log('6. JSON/CSV 파일로 저장\n');

testSeoulDeepScraper().catch(console.error);