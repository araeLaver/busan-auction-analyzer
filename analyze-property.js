const SinglePropertyScraper = require('./src/scraper/SinglePropertyScraper');

async function analyzeProperty() {
  // 명령행 인자에서 URL 가져오기
  const url = process.argv[2];
  
  if (!url) {
    console.log('\n❌ URL이 제공되지 않았습니다.');
    console.log('\n사용법:');
    console.log('  node analyze-property.js <경매물건_URL>');
    console.log('\n예시:');
    console.log('  node analyze-property.js "https://www.courtauction.go.kr/pta/pta_detail.jsp?..."');
    console.log('\n💡 팁: URL에 공백이나 특수문자가 있으면 따옴표로 감싸주세요.');
    process.exit(1);
  }

  const scraper = new SinglePropertyScraper();
  
  try {
    console.log('🚀 개별 경매물건 분석 시작');
    console.log('=' .repeat(60));
    console.log(`📍 분석 URL: ${url}`);
    console.log('=' .repeat(60));
    
    // 브라우저 보이게 설정 (headless: false)
    await scraper.initialize(false);
    
    // URL에서 물건 정보 추출 및 분석
    const analysisResult = await scraper.analyzePropertyFromUrl(url);
    
    // 결과 출력
    displayAnalysisResult(analysisResult);
    
    // JSON 파일로 저장
    const savedFile = await scraper.saveAnalysisToJSON(analysisResult);
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 분석 완료!');
    if (savedFile) {
      console.log(`💾 결과 파일: ${savedFile}`);
    }
    console.log('📸 스크린샷: property-analysis.png');
    console.log('\n⏰ 브라우저가 10초 후 자동 종료됩니다...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('\n❌ 분석 오류:', error.message);
    console.log('\n가능한 원인:');
    console.log('1. 잘못된 URL 형식');
    console.log('2. 페이지 접근 불가');
    console.log('3. 페이지 구조 변경');
    console.log('4. 네트워크 연결 문제');
    console.log('\n📸 오류 스크린샷을 확인해주세요: property-analysis.png');
  } finally {
    await scraper.close();
  }
}

function displayAnalysisResult(result) {
  console.log('\n' + '=' .repeat(60));
  console.log('📊 경매물건 분석 결과');
  console.log('=' .repeat(60));
  
  // 기본 정보
  console.log('\n📋 기본 정보');
  console.log('-' .repeat(30));
  console.log(`🏛️ 법원: ${result.court || '정보없음'}`);
  console.log(`📄 사건번호: ${result.caseNumber || '정보없음'}`);
  console.log(`🏠 물건유형: ${result.propertyType || '정보없음'}`);
  console.log(`📍 소재지: ${result.address || '정보없음'}`);
  if (result.buildingName) {
    console.log(`🏢 건물명: ${result.buildingName}`);
  }
  
  // 면적 정보
  if (result.landArea || result.buildingArea) {
    console.log('\n📐 면적 정보');
    console.log('-' .repeat(30));
    if (result.landArea) console.log(`🌍 토지면적: ${result.landArea}`);
    if (result.buildingArea) console.log(`🏗️ 건물면적: ${result.buildingArea}`);
  }
  
  // 가격 정보
  console.log('\n💰 가격 정보');
  console.log('-' .repeat(30));
  console.log(`💎 감정가: ${result.appraisalValue || '정보없음'}`);
  console.log(`💵 최저매각가: ${result.minimumSalePrice || '정보없음'}`);
  if (result.bidDeposit) {
    console.log(`🏦 입찰보증금: ${result.bidDeposit}`);
  }
  
  // 입찰 정보
  if (result.auctionDate || result.auctionTime) {
    console.log('\n📅 입찰 정보');
    console.log('-' .repeat(30));
    if (result.auctionDate) console.log(`📆 매각기일: ${result.auctionDate}`);
    if (result.auctionTime) console.log(`⏰ 매각시간: ${result.auctionTime}`);
    if (result.courtRoom) console.log(`🏛️ 법정: ${result.courtRoom}`);
  }
  
  // 추가 정보
  if (result.tenantStatus || result.managementCost || result.specialNotes) {
    console.log('\n📝 추가 정보');
    console.log('-' .repeat(30));
    if (result.tenantStatus) console.log(`👥 임차인: ${result.tenantStatus}`);
    if (result.managementCost) console.log(`💳 관리비: ${result.managementCost}`);
    if (result.specialNotes) console.log(`📌 특이사항: ${result.specialNotes}`);
  }
  
  // 투자 분석 결과
  if (result.analysis) {
    const analysis = result.analysis;
    
    console.log('\n' + '=' .repeat(60));
    console.log('📈 투자 분석 결과');
    console.log('=' .repeat(60));
    
    // 종합 점수
    console.log('\n🎯 종합 평가');
    console.log('-' .repeat(30));
    console.log(`📊 종합 투자점수: ${analysis.investmentScore}점 (100점 만점)`);
    console.log(`💹 할인율: ${analysis.discountRate}%`);
    console.log(`⚠️ 위험도: ${analysis.riskLevel.toUpperCase()}`);
    console.log(`🎲 낙찰 예상확률: ${analysis.successProbability}%`);
    console.log(`💡 투자 추천도: ${analysis.recommendation}`);
    
    // 상세 점수
    console.log('\n📊 상세 점수');
    console.log('-' .repeat(30));
    console.log(`💰 수익성: ${analysis.profitabilityScore}점`);
    console.log(`🛡️ 안전성: ${analysis.riskScore}점`);
    console.log(`🔄 유동성: ${analysis.liquidityScore}점`);
    console.log(`📍 입지성: ${analysis.locationScore}점`);
    
    // 예상 가격
    if (analysis.expectedFinalPrice > 0) {
      console.log('\n💸 가격 예측');
      console.log('-' .repeat(30));
      console.log(`🎯 예상 낙찰가: ${analysis.expectedFinalPrice.toLocaleString()}원`);
    }
    
    // 장점
    if (analysis.pros && analysis.pros.length > 0) {
      console.log('\n✅ 투자 장점');
      console.log('-' .repeat(30));
      analysis.pros.forEach((pro, index) => {
        console.log(`  ${index + 1}. ${pro}`);
      });
    }
    
    // 단점
    if (analysis.cons && analysis.cons.length > 0) {
      console.log('\n⚠️ 투자 위험요소');
      console.log('-' .repeat(30));
      analysis.cons.forEach((con, index) => {
        console.log(`  ${index + 1}. ${con}`);
      });
    }
    
    // 시장 분석
    if (analysis.marketComparison) {
      console.log('\n📈 시장 분석');
      console.log('-' .repeat(30));
      console.log(`💹 시세 비교: ${analysis.marketComparison}`);
    }
    
    if (analysis.areaAnalysis) {
      console.log(`🗺️ 지역 분석: ${analysis.areaAnalysis}`);
    }
    
    // 투자 가이드
    console.log('\n💡 투자 가이드');
    console.log('-' .repeat(30));
    
    if (analysis.investmentScore >= 80) {
      console.log('🟢 매우 우수한 투자 기회입니다.');
      console.log('   - 적극적인 투자 검토를 권장합니다.');
    } else if (analysis.investmentScore >= 70) {
      console.log('🟡 양호한 투자 조건입니다.');
      console.log('   - 세부 조건 확인 후 투자 결정하세요.');
    } else if (analysis.investmentScore >= 60) {
      console.log('🟠 보통 수준의 투자 기회입니다.');
      console.log('   - 신중한 검토와 전문가 상담을 권장합니다.');
    } else if (analysis.investmentScore >= 50) {
      console.log('🔴 투자 위험이 높습니다.');
      console.log('   - 충분한 사전 조사 없이는 투자를 권하지 않습니다.');
    } else {
      console.log('⛔ 투자 부적합 물건입니다.');
      console.log('   - 투자를 권하지 않습니다.');
    }
  }
  
  // 이미지 정보
  if (result.images && result.images.length > 0) {
    console.log('\n📸 첨부 이미지');
    console.log('-' .repeat(30));
    console.log(`🖼️ 총 ${result.images.length}개 이미지 발견`);
    result.images.slice(0, 3).forEach((img, index) => {
      console.log(`  ${index + 1}. ${img.alt || '이미지'} (${img.url.substring(0, 50)}...)`);
    });
  }
  
  console.log('\n' + '=' .repeat(60));
}

// 도움말 표시 함수
function showUsage() {
  console.log('\n🏠 개별 경매물건 분석 도구');
  console.log('=' .repeat(50));
  console.log('\n사용법:');
  console.log('  node analyze-property.js <URL>');
  console.log('\n지원하는 사이트:');
  console.log('  • 법원경매정보 (courtauction.go.kr)');
  console.log('  • 기타 경매 관련 사이트');
  console.log('\n예시:');
  console.log('  node analyze-property.js "https://www.courtauction.go.kr/pta/pta_detail.jsp?seq=12345"');
  console.log('\n기능:');
  console.log('  ✅ 기본 물건 정보 추출');
  console.log('  ✅ 투자 분석 (점수, 위험도, 수익성)');
  console.log('  ✅ 장단점 분석');
  console.log('  ✅ 시장 비교 분석');
  console.log('  ✅ 투자 추천도 평가');
  console.log('  ✅ JSON 파일로 결과 저장');
  console.log('\n💡 팁:');
  console.log('  • URL에 특수문자가 있으면 따옴표로 감싸주세요');
  console.log('  • 결과는 JSON 파일로 자동 저장됩니다');
  console.log('  • 스크린샷이 자동 생성됩니다');
}

// 인자 확인 및 실행
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
} else {
  analyzeProperty().catch(console.error);
}