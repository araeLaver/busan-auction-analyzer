const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function fetchTodayAuctions() {
  console.log('🔍 오늘 부산 법원경매 물건 가져오기...');
  console.log(`📅 날짜: ${new Date().toLocaleDateString('ko-KR')}`);
  
  const browser = await puppeteer.launch({ 
    headless: true,  // 백그라운드 실행
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. 법원경매 사이트 접속
    console.log('🌐 법원경매정보 사이트 접속...');
    await page.goto('https://www.courtauction.go.kr', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // 2. 물건검색 페이지로 이동 (직접 URL)
    console.log('🔍 물건검색 페이지로 이동...');
    await page.goto('https://www.courtauction.go.kr/RetrieveRealEstMulDetailList.laf', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. 부산지방법원 선택
    console.log('🏛️ 부산지방법원 선택...');
    
    // 법원 선택 드롭다운 찾기
    const courtSelectExists = await page.$('select[name="jiwonNm"]');
    if (courtSelectExists) {
      await page.select('select[name="jiwonNm"]', '부산지방법원');
      console.log('✅ 부산지방법원 선택 완료');
    }
    
    // 4. 검색 실행
    console.log('🔍 검색 실행...');
    const searchButton = await page.$('a.btn_blue'); // 검색 버튼
    if (searchButton) {
      await searchButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 5. 검색 결과 파싱
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const properties = [];
    
    // 테이블에서 물건 정보 추출
    $('table tbody tr').each((index, element) => {
      if (index > 10) return; // 처음 10개만
      
      const property = {
        사건번호: $(element).find('td:nth-child(2)').text().trim(),
        물건번호: $(element).find('td:nth-child(3)').text().trim(),
        소재지: $(element).find('td:nth-child(4)').text().trim(),
        물건종류: $(element).find('td:nth-child(5)').text().trim(),
        감정가: $(element).find('td:nth-child(6)').text().trim(),
        최저매각가: $(element).find('td:nth-child(7)').text().trim(),
        매각기일: $(element).find('td:nth-child(8)').text().trim(),
        상태: $(element).find('td:nth-child(9)').text().trim()
      };
      
      if (property.사건번호) {
        properties.push(property);
      }
    });
    
    // 결과가 없으면 페이지 구조 확인
    if (properties.length === 0) {
      console.log('⚠️ 테이블에서 데이터를 찾을 수 없습니다. 페이지 구조 확인...');
      
      // 다른 방식으로 데이터 찾기
      const allText = $('body').text();
      if (allText.includes('부산')) {
        console.log('✅ 페이지에 "부산" 텍스트 발견');
      }
      
      // 스크린샷 저장
      await page.screenshot({ 
        path: 'busan-auction-result.png', 
        fullPage: false 
      });
      console.log('📸 결과 페이지 스크린샷: busan-auction-result.png');
    }
    
    // 6. 결과 출력
    console.log(`\n📊 오늘의 부산 법원경매 물건 (${properties.length}건)`);
    console.log('='.repeat(80));
    
    properties.forEach((property, index) => {
      console.log(`\n[물건 ${index + 1}]`);
      console.log(`📋 사건번호: ${property.사건번호}`);
      console.log(`📍 소재지: ${property.소재지}`);
      console.log(`🏢 종류: ${property.물건종류}`);
      console.log(`💰 감정가: ${property.감정가}`);
      console.log(`💵 최저매각가: ${property.최저매각가}`);
      console.log(`📅 매각기일: ${property.매각기일}`);
      console.log(`✅ 상태: ${property.상태}`);
    });
    
    if (properties.length === 0) {
      console.log('\n⚠️ 검색 결과가 없습니다. 다음을 확인해주세요:');
      console.log('1. 오늘 새로 등록된 물건이 없을 수 있습니다');
      console.log('2. 사이트 구조가 변경되었을 수 있습니다');
      console.log('3. 스크린샷을 확인해보세요: busan-auction-result.png');
    }
    
    return properties;
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    
    // 오류 시 스크린샷
    await page.screenshot({ path: 'error-fetch.png' });
    console.log('📸 오류 스크린샷: error-fetch.png');
    
  } finally {
    await browser.close();
    console.log('\n🔒 브라우저 종료');
  }
}

// 실행
fetchTodayAuctions().then(properties => {
  console.log(`\n✅ 총 ${properties ? properties.length : 0}건의 물건 수집 완료`);
}).catch(error => {
  console.error('❌ 실행 오류:', error);
});