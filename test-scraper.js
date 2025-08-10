const CourtAuctionScraper = require('./src/scraper/CourtAuctionScraper');

async function testScraper() {
  const scraper = new CourtAuctionScraper();
  
  try {
    console.log('🚀 법원경매 스크래핑 테스트 시작...');
    
    await scraper.initialize();
    
    // 서울중앙지방법원 검색
    await scraper.searchSeoulCourt();
    
    // 현재 페이지에서 물건 추출
    const properties = await scraper.extractCurrentPageProperties();
    
    console.log(`\n📊 추출 결과:`);
    console.log(`- 총 물건 수: ${properties.length}개`);
    
    properties.forEach((property, index) => {
      console.log(`\n${index + 1}. ${property.caseNumber || '사건번호없음'}`);
      console.log(`   주소: ${property.address || '주소없음'}`);
      console.log(`   유형: ${property.propertyType || '유형없음'}`);
      console.log(`   감정가: ${property.appraisalValue ? property.appraisalValue.toLocaleString() + '원' : '미확인'}`);
      console.log(`   최저가: ${property.minimumSalePrice ? property.minimumSalePrice.toLocaleString() + '원' : '미확인'}`);
      console.log(`   입찰일: ${property.auctionDate || '미확인'}`);
    });
    
    await scraper.close();
    console.log('\n✅ 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error);
    await scraper.close();
    process.exit(1);
  }
}

testScraper();