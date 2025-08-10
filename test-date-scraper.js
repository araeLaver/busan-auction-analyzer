const CourtAuctionDateScraper = require('./src/scraper/CourtAuctionDateScraper');

async function testDateScraper() {
  const scraper = new CourtAuctionDateScraper();
  
  try {
    console.log('🚀 법원경매 기일별 검색 테스트 시작...');
    
    await scraper.initialize();
    
    // 오늘부터 30일간의 경매 물건 검색
    const properties = await scraper.scrapeByDate();
    
    console.log(`\n📊 최종 결과:`);
    console.log(`- 총 물건 수: ${properties.length}개\n`);
    
    if (properties.length > 0) {
      properties.slice(0, 10).forEach((property, index) => {
        console.log(`${index + 1}. ${property.caseNumber || '사건번호없음'}`);
        console.log(`   📍 주소: ${property.address || '주소정보없음'}`);
        console.log(`   🏠 유형: ${property.propertyType || '유형없음'}`);
        console.log(`   💰 감정가: ${property.appraisalValue ? property.appraisalValue.toLocaleString() + '원' : '미확인'}`);
        console.log(`   💵 최저가: ${property.minimumSalePrice ? property.minimumSalePrice.toLocaleString() + '원' : '미확인'}`);
        console.log(`   📅 입찰일: ${property.auctionDate || '미확인'}`);
        console.log(`   🔄 유찰: ${property.failureCount}회\n`);
      });
      
      if (properties.length > 10) {
        console.log(`... 외 ${properties.length - 10}개 물건 더 있음`);
      }
    } else {
      console.log('❌ 추출된 물건이 없습니다. 페이지 구조를 확인해주세요.');
    }
    
    console.log('\n✅ 테스트 완료 - 브라우저가 10초 후 자동 종료됩니다');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error);
    
    console.log('\n🔧 문제 해결 방법:');
    console.log('1. 브라우저에서 사이트가 제대로 로드되는지 확인');
    console.log('2. 검색 조건이 올바르게 설정되는지 확인');
    console.log('3. 결과 테이블의 구조 변경 여부 확인');
    
  } finally {
    await scraper.close();
  }
}

// 실행
testDateScraper().catch(console.error);