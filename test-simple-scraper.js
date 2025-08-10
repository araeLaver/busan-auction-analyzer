const puppeteer = require('puppeteer');

async function simpleScrapeTest() {
  const browser = await puppeteer.launch({ 
    headless: false,  // 브라우저 창 보이게 설정 (디버깅용)
    slowMo: 1000,     // 동작 느리게
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 법원경매정보 사이트 테스트 접속...');
    
    // 1단계: 메인 페이지 접속
    await page.goto('https://www.courtauction.go.kr', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('✅ 메인 페이지 로드 완료');
    
    // 페이지 제목 확인
    const title = await page.title();
    console.log(`📄 페이지 제목: ${title}`);
    
    // 5초 대기 (페이지 완전 로딩)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2단계: 부동산 메뉴 찾기
    console.log('🏠 부동산 경매 메뉴 찾는 중...');
    
    // 여러 가능한 셀렉터로 메뉴 찾기
    const menuSelectors = [
      'a:contains("부동산")',
      'a[href*="RealEstate"]', 
      'a[href*="realEstate"]',
      '.menu a',
      '#menu a'
    ];
    
    let menuFound = false;
    
    for (const selector of menuSelectors) {
      try {
        const elements = await page.$$(selector);
        console.log(`셀렉터 "${selector}": ${elements.length}개 요소 발견`);
        
        if (elements.length > 0) {
          // 텍스트 내용 확인
          for (let i = 0; i < Math.min(5, elements.length); i++) {
            const text = await page.evaluate(el => el.textContent, elements[i]);
            const href = await page.evaluate(el => el.href, elements[i]);
            console.log(`  - 요소 ${i}: "${text}" (${href})`);
            
            if (text.includes('부동산') || href.includes('RealEstate')) {
              console.log(`✅ 부동산 메뉴 발견: ${text}`);
              await elements[i].click();
              menuFound = true;
              break;
            }
          }
        }
        
        if (menuFound) break;
      } catch (error) {
        console.log(`셀렉터 "${selector}" 실패: ${error.message}`);
      }
    }
    
    if (!menuFound) {
      console.log('⚠️ 부동산 메뉴를 찾을 수 없습니다. 페이지 내용을 확인합니다...');
      
      // 페이지의 모든 링크 출력
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.slice(0, 20).map(link => ({
          text: link.textContent.trim(),
          href: link.href
        })).filter(link => link.text.length > 0);
      });
      
      console.log('📋 페이지의 주요 링크들:');
      allLinks.forEach((link, i) => {
        console.log(`  ${i + 1}. ${link.text} (${link.href})`);
      });
    }
    
    // 페이지 스크린샷 저장
    await page.screenshot({ 
      path: 'courtauction-debug.png', 
      fullPage: true 
    });
    console.log('📸 스크린샷 저장: courtauction-debug.png');
    
    // 10초 대기 (수동 확인용)
    console.log('⏳ 10초 대기 (브라우저에서 페이지 확인 가능)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error);
    
    try {
      await page.screenshot({ path: 'error-screenshot.png' });
      console.log('📸 오류 스크린샷: error-screenshot.png');
    } catch (e) {}
  } finally {
    await browser.close();
    console.log('🔒 브라우저 종료');
  }
}

simpleScrapeTest();