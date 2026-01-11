const pool = require('../config/database');
const AdvancedCourtAuctionScraper = require('../src/scraper/AdvancedCourtAuctionScraper');
const AIInvestmentAnalyzer = require('../src/analyzer/AIInvestmentAnalyzer');
const CacheService = require('../src/services/CacheService');

async function runIntegrationTest() {
  console.log('🚀 통합 테스트 시작...');
  const testCaseNumber = '2099타경12345';
  
  try {
    // 1. DB 연결 확인
    console.log('1️⃣ DB 연결 테스트...');
    const client = await pool.connect();
    client.release();
    console.log('✅ DB 연결 성공');

    // 2. 스크래퍼 저장 로직 테스트 (브라우저 실행 없이 저장 로직만 검증)
    console.log('2️⃣ 스크래퍼 저장 로직 테스트...');
    const scraper = new AdvancedCourtAuctionScraper();
    
    const testProperty = {
      caseNumber: testCaseNumber,
      itemNumber: '1',
      address: '부산광역시 테스트구 테스트동 123-45',
      propertyType: '아파트',
      buildingName: '테스트아파트',
      appraisalValue: 500000000,
      minimumSalePrice: 400000000,
      auctionDate: new Date(Date.now() + 86400000), // 내일
      auctionTime: '10:00',
      failureCount: 1,
      buildingArea: '84.5',
      landArea: '30.0',
      status: '신건',
      tenantStatus: '없음',
      specialNotes: '통합 테스트용 데이터',
      sourceSite: 'courtauction_busan',
      sourceUrl: 'http://test.com'
    };

    const saveResult = await scraper.saveProperty(testProperty);
    console.log(`✅ 데이터 저장 성공 (isNew: ${saveResult.isNew})`);

    // 저장된 ID 조회
    const result = await pool.query('SELECT id FROM properties WHERE case_number = $1', [testCaseNumber]);
    const propertyId = result.rows[0].id;

    // 3. AI 분석 실행 테스트
    console.log('3️⃣ AI 분석 엔진 테스트...');
    const analyzer = new AIInvestmentAnalyzer();
    // 학습 모델 초기화 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await analyzer.analyzeProperty(propertyId);
    console.log('✅ AI 분석 완료');

    // 분석 결과 검증
    const analysisResult = await pool.query('SELECT * FROM analysis_results WHERE property_id = $1', [propertyId]);
    if (analysisResult.rows.length > 0) {
      console.log(`   - 투자 점수: ${analysisResult.rows[0].investment_score}점`);
      console.log(`   - 예상 낙찰가: ${analysisResult.rows[0].estimated_final_price}원`);
    } else {
      throw new Error('분석 결과가 저장되지 않았습니다.');
    }

    // 4. 서비스 계층(CacheService) 조회 테스트
    console.log('4️⃣ 서비스 조회 테스트...');
    const cacheService = new CacheService();
    const cachedProperty = await cacheService.getPropertyDetail(propertyId);
    
    if (cachedProperty && cachedProperty.case_number === testCaseNumber) {
      console.log('✅ 서비스 조회 성공');
      console.log(`   - URL 생성 확인: ${cachedProperty.court_auction_url}`);
    } else {
      throw new Error('서비스 계층에서 데이터를 찾을 수 없습니다.');
    }

    // 5. 데이터 정리
    console.log('5️⃣ 테스트 데이터 정리...');
    await pool.query('DELETE FROM properties WHERE id = $1', [propertyId]);
    // analysis_results는 CASCADE로 삭제됨
    console.log('✅ 데이터 삭제 완료');

    console.log('✨ 모든 통합 테스트 통과!');

  } catch (error) {
    console.error('❌ 통합 테스트 실패:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runIntegrationTest();
