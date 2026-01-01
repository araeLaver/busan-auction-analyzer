const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class CourtAuctionDateScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ153F00.xml';
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false, // 디버깅용으로 브라우저 보이게 설정
      slowMo: 500,     // 동작 속도 조절
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    this.page = await this.browser.newPage();
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // 추가 헤더 설정
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.courtauction.go.kr/'
    });
    
    console.log('🚀 법원경매 기일별 검색 스크래퍼 초기화 완료');
  }

  async scrapeByDate(targetDate = null) {
    try {
      console.log('📅 기일별 검색 페이지 접속...');
      
      // 기일별 검색 페이지로 직접 이동
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('✅ 페이지 로드 완료');
      
      // WebSquare 프레임워크 로딩 대기
      await this.page.waitForTimeout(5000);
      
      // 페이지 구조 분석
      await this.analyzePage();
      
      // 검색 조건 설정
      await this.setSearchConditions(targetDate);
      
      // 검색 실행
      await this.executeSearch();
      
      // 결과 추출
      const properties = await this.extractSearchResults();
      
      return properties;
      
    } catch (error) {
      console.error('❌ 기일별 검색 오류:', error);
      
      try {
        await this.page.screenshot({ 
          path: 'court-date-search-error.png', 
          fullPage: true 
        });
        console.log('📸 오류 스크린샷 저장: court-date-search-error.png');
      } catch (e) {}
      
      throw error;
    }
  }

  async analyzePage() {
    console.log('🔍 페이지 구조 분석 중...');
    
    try {
      // 페이지 제목 확인
      const title = await this.page.title();
      console.log(`📄 페이지 제목: ${title}`);
      
      // iframe 확인
      const iframes = await this.page.$$('iframe');
      console.log(`🖼️ iframe 개수: ${iframes.length}`);
      
      if (iframes.length > 0) {
        for (let i = 0; i < iframes.length; i++) {
          try {
            const frame = await iframes[i].contentFrame();
            if (frame) {
              const frameTitle = await frame.title();
              const frameUrl = await frame.url();
              console.log(`  iframe ${i}: ${frameTitle} (${frameUrl})`);
            }
          } catch (e) {
            console.log(`  iframe ${i}: 접근 불가`);
          }
        }
      }
      
      // 주요 폼 요소들 찾기
      const formElements = await this.page.evaluate(() => {
        const elements = {
          inputs: Array.from(document.querySelectorAll('input')).length,
          selects: Array.from(document.querySelectorAll('select')).length,
          buttons: Array.from(document.querySelectorAll('button')).length,
          forms: Array.from(document.querySelectorAll('form')).length
        };
        
        // 특정 ID나 클래스 찾기
        const specificElements = [
          'form', 'searchForm', 'searchBtn', 'search',
          'court', 'date', 'dateFrom', 'dateTo',
          'region', 'area', 'type'
        ];
        
        specificElements.forEach(id => {
          const byId = document.getElementById(id);
          const byClass = document.getElementsByClassName(id);
          if (byId) elements[`id_${id}`] = true;
          if (byClass.length > 0) elements[`class_${id}`] = byClass.length;
        });
        
        return elements;
      });
      
      console.log('📋 폼 요소 분석:', formElements);
      
      // WebSquare 관련 요소 확인
      const websquareElements = await this.page.evaluate(() => {
        const wsElements = {};
        
        // WebSquare 프레임워크 관련 요소들
        if (window.WebSquare) wsElements.webSquareLoaded = true;
        if (window.scwin) wsElements.scwinLoaded = true;
        
        // data-* 속성을 가진 요소들 (WebSquare에서 자주 사용)
        const dataElements = Array.from(document.querySelectorAll('[data-label], [data-col], [data-bind]'));
        wsElements.dataElementCount = dataElements.length;
        
        return wsElements;
      });
      
      console.log('🌐 WebSquare 요소:', websquareElements);
      
    } catch (error) {
      console.error('페이지 분석 오류:', error);
    }
  }

  async setSearchConditions(targetDate) {
    console.log('⚙️ 검색 조건 설정 중...');
    
    try {
      // 날짜 설정 (기본값: 오늘부터 30일 후까지)
      const today = targetDate ? new Date(targetDate) : new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 30);
      
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const fromDate = formatDate(today);
      const toDate = formatDate(futureDate);
      
      console.log(`📅 검색 기간: ${fromDate} ~ ${toDate}`);
      
      // 다양한 날짜 입력 필드 셀렉터 시도
      const dateSelectors = [
        'input[name*="date"]',
        'input[id*="date"]', 
        'input[class*="date"]',
        'input[type="date"]',
        '#dateFrom, #dateTo',
        '#fromDate, #toDate',
        '.date-input'
      ];
      
      for (const selector of dateSelectors) {
        try {
          const dateInputs = await this.page.$$(selector);
          
          if (dateInputs.length >= 2) {
            console.log(`📅 날짜 입력 필드 발견: ${selector} (${dateInputs.length}개)`);
            
            // 첫 번째는 시작일, 두 번째는 종료일로 설정
            await this.page.evaluate((el, value) => {
              el.value = value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputs[0], fromDate);
            
            await this.page.evaluate((el, value) => {
              el.value = value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputs[1], toDate);
            
            break;
          } else if (dateInputs.length === 1) {
            console.log(`📅 날짜 입력 필드 하나 발견: ${selector}`);
            await this.page.evaluate((el, value) => {
              el.value = value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputs[0], fromDate);
          }
        } catch (e) {
          console.log(`날짜 설정 실패 (${selector}): ${e.message}`);
        }
      }
      
      // 서울 지역 설정
      const regionSelectors = [
        'select[name*="court"]',
        'select[id*="court"]',
        'select[name*="region"]',
        '#court', '#region', '#area'
      ];
      
      for (const selector of regionSelectors) {
        try {
          const regionSelect = await this.page.$(selector);
          if (regionSelect) {
            console.log(`🏛️ 지역 선택 필드 발견: ${selector}`);
            
            // 서울 관련 옵션 찾기
            const options = await this.page.evaluate(select => {
              return Array.from(select.options).map(option => ({
                value: option.value,
                text: option.text
              }));
            }, regionSelect);
            
            console.log('지역 옵션들:', options.slice(0, 5));
            
            // 서울 관련 옵션 선택
            const seoulOption = options.find(option => 
              option.text.includes('서울중앙') || option.text.includes('서울') || option.value.includes('seoul')
            );
            
            if (seoulOption) {
              await this.page.select(selector, seoulOption.value);
              console.log(`✅ 서울 지역 선택: ${seoulOption.text}`);
            }
            
            break;
          }
        } catch (e) {
          console.log(`지역 설정 실패 (${selector}): ${e.message}`);
        }
      }
      
    } catch (error) {
      console.error('검색 조건 설정 오류:', error);
    }
  }

  async executeSearch() {
    console.log('🔍 검색 실행 중...');
    
    try {
      // 검색 버튼 찾기 및 클릭
      const searchSelectors = [
        'button[type="submit"]',
        'input[type="submit"]', 
        'button:contains("검색")',
        'input[value*="검색"]',
        '#searchBtn', '#search', '.search-btn',
        '.btn-search'
      ];
      
      let searchExecuted = false;
      
      for (const selector of searchSelectors) {
        try {
          const searchBtn = await this.page.$(selector);
          if (searchBtn) {
            console.log(`🔍 검색 버튼 발견: ${selector}`);
            
            await searchBtn.click();
            console.log('✅ 검색 버튼 클릭');
            
            searchExecuted = true;
            break;
          }
        } catch (e) {
          console.log(`검색 버튼 클릭 실패 (${selector}): ${e.message}`);
        }
      }
      
      if (!searchExecuted) {
        console.log('⚠️ 검색 버튼을 찾을 수 없습니다. Enter 키로 시도...');
        await this.page.keyboard.press('Enter');
      }
      
      // 검색 결과 로딩 대기
      await this.page.waitForTimeout(5000);
      
      console.log('✅ 검색 실행 완료');
      
    } catch (error) {
      console.error('검색 실행 오류:', error);
      throw error;
    }
  }

  async extractSearchResults() {
    console.log('📊 검색 결과 추출 중...');
    
    try {
      // 결과 테이블 찾기
      const tableSelectors = [
        'table',
        '.table', '.list-table', '.result-table',
        '#resultTable', '#listTable',
        '[data-table]', '[role="table"]'
      ];
      
      const properties = [];
      
      for (const selector of tableSelectors) {
        try {
          const tables = await this.page.$$(selector);
          
          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            
            // 테이블 행 수 확인
            const rowCount = await this.page.evaluate(table => {
              const rows = table.querySelectorAll('tr');
              return rows.length;
            }, table);
            
            console.log(`📋 테이블 ${i} (${selector}): ${rowCount}개 행`);
            
            if (rowCount > 1) { // 헤더 + 데이터 행이 있어야 함
              const tableData = await this.page.evaluate(table => {
                const rows = Array.from(table.querySelectorAll('tr'));
                return rows.map((row, index) => {
                  const cells = Array.from(row.querySelectorAll('td, th'));
                  return {
                    index,
                    cells: cells.map(cell => cell.textContent.trim())
                  };
                });
              }, table);
              
              console.log(`테이블 데이터 샘플:`, tableData.slice(0, 3));
              
              // 경매 정보로 보이는 테이블 판단
              const hasAuctionData = tableData.some(row => 
                row.cells.some(cell => 
                  cell.includes('타경') || cell.includes('서울') || 
                  cell.includes('원') || cell.includes('아파트')
                )
              );
              
              if (hasAuctionData) {
                console.log('✅ 경매 정보 테이블 발견');
                
                // 데이터 행만 추출 (첫 번째 행은 보통 헤더)
                const dataRows = tableData.slice(1);
                
                dataRows.forEach((row, index) => {
                  if (row.cells.length >= 4) {
                    const property = this.parsePropertyFromCells(row.cells);
                    if (property.isValid) {
                      properties.push(property);
                      console.log(`📝 물건 ${index + 1}: ${property.caseNumber} - ${property.address}`);
                    }
                  }
                });
                
                break; // 첫 번째 유효한 테이블만 사용
              }
            }
          }
          
          if (properties.length > 0) break;
          
        } catch (e) {
          console.log(`테이블 추출 실패 (${selector}): ${e.message}`);
        }
      }
      
      console.log(`📊 총 ${properties.length}개 물건 추출 완료`);
      return properties;
      
    } catch (error) {
      console.error('검색 결과 추출 오류:', error);
      return [];
    }
  }

  parsePropertyFromCells(cells) {
    const property = {
      caseNumber: '',
      itemNumber: '1',
      address: '',
      propertyType: '',
      appraisalValue: null,
      minimumSalePrice: null,
      auctionDate: null,
      failureCount: 0,
      status: 'active',
      isValid: false
    };
    
    try {
      // 각 셀에서 정보 추출
      cells.forEach((cell, index) => {
        const text = cell.trim();
        
        // 사건번호 패턴 (예: 2024타경12345)
        if (/\d{4}타경\d+/.test(text)) {
          property.caseNumber = text;
        }
        
        // 주소 패턴 (서울특별시로 시작하는 긴 텍스트)
        if (text.includes('서울특별시') && text.length > 10) {
          property.address = text;
        }
        
        // 물건 유형
        if (['아파트', '오피스텔', '단독주택', '상가', '토지'].some(type => text.includes(type))) {
          property.propertyType = text;
        }
        
        // 가격 (원 단위 숫자)
        if (/[\d,]+원/.test(text)) {
          const price = parseInt(text.replace(/[^0-9]/g, ''));
          if (price > 10000000) { // 1천만원 이상
            if (!property.appraisalValue) {
              property.appraisalValue = price;
            } else if (!property.minimumSalePrice) {
              property.minimumSalePrice = price;
            }
          }
        }
        
        // 날짜 패턴 (YYYY-MM-DD 또는 YYYY.MM.DD)
        if (/\d{4}[-.]\d{1,2}[-.]\d{1,2}/.test(text)) {
          property.auctionDate = text;
        }
        
        // 유찰 횟수
        if (text.includes('회') && /\d+회/.test(text)) {
          const match = text.match(/(\d+)회/);
          if (match) {
            property.failureCount = parseInt(match[1]);
          }
        }
      });
      
      // 유효성 검증
      property.isValid = !!(property.caseNumber || (property.address && property.address.length > 15));
      
    } catch (error) {
      console.error('셀 파싱 오류:', error);
    }
    
    return property;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 브라우저 종료');
    }
  }
}

module.exports = CourtAuctionDateScraper;