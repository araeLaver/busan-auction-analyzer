const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const pool = require('../../config/database');

class CourtAuctionScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://www.courtauction.go.kr';
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false, // 일단 헤드리스 모드 끄고 테스트
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--window-size=1920,1080'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      ignoreHTTPSErrors: true
    });
    
    this.page = await this.browser.newPage();
    
    // 더 현실적인 User-Agent 설정
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // navigator.webdriver 플래그 제거
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Chrome 런타임 변수들 설정
    await this.page.evaluateOnNewDocument(() => {
      window.chrome = {
        runtime: {},
      };
    });
    
    // Permissions API 모킹
    await this.page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query;
      return window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    console.log('🚀 Puppeteer 초기화 완료 (스텔스 모드)');
  }

  async logScrapingStart(sourceSite) {
    const query = `
      INSERT INTO scraping_logs (source_site, status) 
      VALUES ($1, 'running') 
      RETURNING id
    `;
    const result = await pool.query(query, [sourceSite]);
    return result.rows[0].id;
  }

  async logScrapingEnd(logId, stats) {
    const query = `
      UPDATE scraping_logs 
      SET status = $2, 
          total_found = $3, 
          new_items = $4, 
          updated_items = $5,
          execution_time = EXTRACT(EPOCH FROM (NOW() - created_at))
      WHERE id = $1
    `;
    await pool.query(query, [
      logId, 
      'completed', 
      stats.totalFound, 
      stats.newItems, 
      stats.updatedItems
    ]);
  }

  async scrapeSeoulAuctions() {
    const logId = await this.logScrapingStart('courtauction');
    const stats = { totalFound: 0, newItems: 0, updatedItems: 0 };
    
    try {
      console.log('📍 서울중앙지법 경매 정보 스크래핑 시작...');
      
      await this.page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // 서울중앙지법 검색
      await this.searchSeoulCourt();
      
      // 물건 목록 수집
      const properties = await this.extractProperties();
      stats.totalFound = properties.length;
      
      console.log(`📊 총 ${properties.length}개 물건 발견`);
      
      // 데이터베이스 저장
      for (const property of properties) {
        try {
          const saved = await this.saveProperty(property);
          if (saved.isNew) {
            stats.newItems++;
          } else {
            stats.updatedItems++;
          }
        } catch (error) {
          console.error(`❌ 물건 저장 오류 (${property.caseNumber}):`, error.message);
        }
      }
      
      await this.logScrapingEnd(logId, stats);
      
      console.log(`✅ 스크래핑 완료: 신규 ${stats.newItems}개, 업데이트 ${stats.updatedItems}개`);
      return stats;
      
    } catch (error) {
      console.error('❌ 스크래핑 오류:', error);
      
      await pool.query(
        'UPDATE scraping_logs SET status = $2, error_message = $3 WHERE id = $1',
        [logId, 'failed', error.message]
      );
      
      throw error;
    }
  }

  async searchSeoulCourt() {
    try {
      console.log('🏛️ 법원경매정보 사이트 접속...');
      
      // 메인 페이지 이동
      await this.page.goto('https://www.courtauction.go.kr', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 자동 리다이렉트 대기
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('현재 URL:', this.page.url());
      
      // 부동산 탭 또는 링크 찾기
      try {
        // 다양한 부동산 관련 셀렉터 시도
        const realEstateSelectors = [
          'a[href*="RetrieveRealEstateAuctionDetail"]',
          'a[href*="RealEstate"]',
          'a[href*="부동산"]',
          '.menu-item:contains("부동산")',
          'a:contains("부동산")',
          '.tab-item:contains("부동산")'
        ];
        
        let clicked = false;
        for (const selector of realEstateSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 3000 });
            await this.page.click(selector);
            console.log(`✅ 부동산 메뉴 클릭 성공: ${selector}`);
            clicked = true;
            break;
          } catch (e) {
            console.log(`셀렉터 시도 실패: ${selector}`);
          }
        }
        
        if (!clicked) {
          console.log('⚠️ 부동산 메뉴를 찾을 수 없어 직접 URL로 이동');
          await this.page.goto('https://www.courtauction.go.kr/RetrieveRealEstateAuctionDetail.laf', {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 현재 페이지 상태 확인
        const content = await this.page.content();
        console.log('페이지 로드 완료, 검색 폼 찾는 중...');
        
      } catch (navError) {
        console.log('네비게이션 오류, 대체 URL로 시도:', navError.message);
        // 직접 부동산 경매 페이지로 이동
        await this.page.goto('https://www.courtauction.go.kr/RetrieveRealEstateAuctionDetail.laf', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      }

      // 서울중앙지법 검색 설정
      console.log('🏛️ 서울중앙지법 설정...');
      
      // 법원 선택 - 다양한 셀렉터 시도
      const courtSelectors = ['#srnID', 'select[name="srnID"]', '.court-select', 'select:contains("법원")'];
      let courtSelected = false;
      
      for (const selector of courtSelectors) {
        try {
          const courtSelect = await this.page.$(selector);
          if (courtSelect) {
            await this.page.select(selector, '서울중앙지방법원');
            console.log(`✅ 법원 선택 성공: ${selector}`);
            courtSelected = true;
            break;
          }
        } catch (e) {
          console.log(`법원 선택 시도 실패: ${selector}`);
        }
      }
      
      if (!courtSelected) {
        console.log('⚠️ 법원 선택 요소를 찾을 수 없음');
      }

      // 물건 유형 - 전체 선택
      try {
        const allTypeRadio = await this.page.$('input[name="rd2"][value=""]');
        if (allTypeRadio) {
          await this.page.click('input[name="rd2"][value=""]');
          console.log('✅ 전체 유형 선택');
        }
      } catch (e) {
        console.log('물건 유형 설정 실패');
      }

      // 검색 실행
      const searchSelectors = [
        'input[alt="검색"]',
        'button[type="submit"]', 
        '.search_btn',
        'input[type="submit"]',
        '.btn-search'
      ];
      
      let searchClicked = false;
      for (const selector of searchSelectors) {
        try {
          const searchBtn = await this.page.$(selector);
          if (searchBtn) {
            await searchBtn.click();
            console.log(`✅ 검색 버튼 클릭: ${selector}`);
            searchClicked = true;
            break;
          }
        } catch (e) {
          console.log(`검색 버튼 시도 실패: ${selector}`);
        }
      }
      
      if (!searchClicked) {
        console.log('⚠️ 검색 버튼을 찾을 수 없음');
      }

      // 결과 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('✅ 서울중앙지법 검색 완료');
      console.log('최종 URL:', this.page.url());
      
    } catch (error) {
      console.error('❌ 법원 검색 오류:', error);
      
      // 스크린샷 저장 (디버깅용)
      try {
        await this.page.screenshot({ path: 'debug-error.png', fullPage: true });
        console.log('📸 오류 스크린샷 저장: debug-error.png');
      } catch (screenshotError) {
        console.log('스크린샷 저장 실패');
      }
      
      throw error;
    }
  }

  async searchBusanCourt() {
    try {
      console.log('🏛️ 법원경매정보 사이트 접속...');
      
      // 메인 페이지 이동
      await this.page.goto('https://www.courtauction.go.kr', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 부동산 경매 메뉴 클릭
      await this.page.waitForSelector('a[href*="RetrieveRealEstateAuctionDetail"]', { timeout: 10000 });
      await this.page.click('a[href*="RetrieveRealEstateAuctionDetail"]');
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 부산지방법원 검색 설정
      console.log('🏛️ 부산지방법원 설정...');
      
      // 법원 선택
      const courtSelect = await this.page.$('#srnID');
      if (courtSelect) {
        await this.page.select('#srnID', '부산지방법원');
      }

      // 물건 유형 - 전체 선택 (더 많은 데이터 수집)
      const allTypeRadio = await this.page.$('input[name="rd2"][value=""]');
      if (allTypeRadio) {
        await this.page.click('input[name="rd2"][value=""]');
      }

      // 검색 실행
      const searchBtn = await this.page.$('input[alt="검색"], button[type="submit"], .search_btn');
      if (searchBtn) {
        await searchBtn.click();
      }

      // 결과 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('✅ 부산지방법원 검색 완료');
      
    } catch (error) {
      console.error('❌ 법원 검색 오류:', error);
      
      // 스크린샷 저장 (디버깅용)
      try {
        await this.page.screenshot({ path: 'debug-busan-error.png', fullPage: true });
        console.log('📸 오류 스크린샷 저장: debug-busan-error.png');
      } catch (screenshotError) {
        console.log('스크린샷 저장 실패');
      }
      
      throw error;
    }
  }

  async extractProperties() {
    const properties = [];
    
    try {
      // 결과 테이블 찾기
      const hasResults = await this.page.$('.Ltbl, .etc');
      
      if (!hasResults) {
        console.log('📭 검색 결과가 없습니다.');
        return properties;
      }

      // 페이지네이션 처리
      let pageNum = 1;
      let hasNextPage = true;
      
      while (hasNextPage && pageNum <= 10) { // 최대 10페이지
        console.log(`📄 ${pageNum} 페이지 처리 중...`);
        
        const pageProperties = await this.extractCurrentPageProperties();
        properties.push(...pageProperties);
        
        // 다음 페이지 확인
        hasNextPage = await this.goToNextPage();
        pageNum++;
        
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        }
      }
      
    } catch (error) {
      console.error('❌ 물건 목록 추출 오류:', error);
      throw error;
    }
    
    return properties;
  }

  async extractCurrentPageProperties() {
    const properties = [];
    
    try {
      // 페이지 HTML 가져오기
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      console.log('📄 페이지 내용 분석 중...');
      
      // 다양한 테이블 셀렉터 시도
      const tableSelectors = [
        'table.Ltbl tr',
        'table.etc tr', 
        'table tr',
        '.table_list tr',
        '.list_table tr'
      ];
      
      let foundRows = false;
      
      for (const selector of tableSelectors) {
        const rows = $(selector);
        
        if (rows.length > 1) { // 헤더 제외하고 데이터 행이 있으면
          console.log(`✅ 테이블 발견: ${selector} (${rows.length}개 행)`);
          
          rows.each((index, row) => {
            if (index === 0) return; // 헤더 스킵
            
            const $row = $(row);
            const cells = $row.find('td');
            
            console.log(`📝 행 ${index}: ${cells.length}개 셀`);
            
            if (cells.length >= 4) {
              // 기본 정보 추출 (셀 위치는 실제 사이트 구조에 따라 조정)
              const property = {
                caseNumber: this.cleanText(cells.eq(0).text()) || this.cleanText(cells.eq(1).text()),
                itemNumber: this.cleanText(cells.eq(1).text()) || '1',
                address: this.cleanText(cells.eq(2).text()) || this.cleanText(cells.eq(3).text()),
                propertyType: this.extractPropertyType(cells),
                appraisalValue: this.findPrice(cells, ['감정가', '감정', '평가']),
                minimumSalePrice: this.findPrice(cells, ['최저', '매각가', '시작가']),
                auctionDate: this.findDate(cells),
                failureCount: this.findNumber(cells, ['유찰', '회차']),
                status: this.findStatus(cells),
                sourceSite: 'courtauction',
                sourceUrl: this.page.url()
              };
              
              // 최소한 사건번호와 주소가 있어야 유효한 데이터
              if ((property.caseNumber && property.caseNumber.length > 5) || 
                  (property.address && property.address.length > 10)) {
                properties.push(property);
                console.log(`✅ 물건 추출: ${property.caseNumber} - ${property.address}`);
              }
            }
          });
          
          foundRows = true;
          break; // 첫 번째로 찾은 테이블 사용
        }
      }
      
      if (!foundRows) {
        console.log('⚠️ 테이블을 찾을 수 없습니다. 페이지 구조를 확인합니다...');
        
        // 페이지 구조 디버깅
        const allTables = $('table');
        console.log(`📋 전체 테이블 수: ${allTables.length}`);
        
        allTables.each((i, table) => {
          const $table = $(table);
          const rows = $table.find('tr');
          console.log(`테이블 ${i}: ${rows.length}개 행`);
        });
        
        // 텍스트에서 직접 패턴 매칭 시도
        const pageText = $('body').text();
        const patterns = [
          /\d{4}타경\d+/g,  // 사건번호 패턴
          /서울특별시.+/g,   // 서울 주소 패턴
        ];
        
        patterns.forEach((pattern, i) => {
          const matches = pageText.match(pattern);
          if (matches) {
            console.log(`패턴 ${i} 매칭: ${matches.length}개`);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ 페이지 추출 오류:', error);
      
      // 오류 발생 시 스크린샷 저장
      try {
        await this.page.screenshot({ path: 'debug-extract-error.png', fullPage: true });
        console.log('📸 추출 오류 스크린샷: debug-extract-error.png');
      } catch (e) {}
    }
    
    console.log(`📊 총 ${properties.length}개 물건 추출`);
    return properties;
  }

  // 헬퍼 메서드들
  extractPropertyType(cells) {
    const types = ['아파트', '오피스텔', '단독', '상가', '토지', '빌라'];
    
    for (let i = 0; i < cells.length; i++) {
      const cellText = this.cleanText(cells.eq(i).text());
      for (const type of types) {
        if (cellText.includes(type)) {
          return type;
        }
      }
    }
    return '기타';
  }

  findPrice(cells, keywords) {
    for (let i = 0; i < cells.length; i++) {
      const cellText = this.cleanText(cells.eq(i).text());
      
      // 키워드가 포함된 셀 또는 그 다음 셀에서 가격 찾기
      const hasKeyword = keywords.some(keyword => cellText.includes(keyword));
      
      if (hasKeyword || /\d+,\d+/.test(cellText)) {
        const price = this.parsePrice(cellText);
        if (price && price > 1000000) { // 100만원 이상만 유효
          return price;
        }
      }
    }
    return null;
  }

  findDate(cells) {
    for (let i = 0; i < cells.length; i++) {
      const cellText = this.cleanText(cells.eq(i).text());
      const date = this.parseDate(cellText);
      if (date) return date;
    }
    return null;
  }

  findNumber(cells, keywords) {
    for (let i = 0; i < cells.length; i++) {
      const cellText = this.cleanText(cells.eq(i).text());
      const hasKeyword = keywords.some(keyword => cellText.includes(keyword));
      
      if (hasKeyword) {
        const numbers = cellText.match(/\d+/);
        return numbers ? parseInt(numbers[0]) : 0;
      }
    }
    return 0;
  }

  findStatus(cells) {
    const statuses = ['신건', '유찰', '낙찰', '진행', '종료'];
    
    for (let i = 0; i < cells.length; i++) {
      const cellText = this.cleanText(cells.eq(i).text());
      for (const status of statuses) {
        if (cellText.includes(status)) {
          return status;
        }
      }
    }
    return '진행';
  }

  async goToNextPage() {
    try {
      const nextButton = await this.page.$('a:contains("다음")');
      if (nextButton) {
        await nextButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      }
      return false;
    } catch (error) {
      console.log('📄 다음 페이지 없음');
      return false;
    }
  }

  async saveProperty(property) {
    const client = await pool.connect();
    let isNew = false;
    
    try {
      await client.query('BEGIN');
      
      // 서울중앙지방법원 ID 조회
      const courtResult = await client.query(
        'SELECT id FROM courts WHERE name = $1',
        ['서울중앙지방법원']
      );
      
      const courtId = courtResult.rows[0]?.id || 1;
      
      // 기존 데이터 확인
      const existingResult = await client.query(
        'SELECT id FROM properties WHERE case_number = $1 AND item_number = $2 AND source_site = $3',
        [property.caseNumber, property.itemNumber, property.sourceSite]
      );
      
      if (existingResult.rows.length > 0) {
        // 업데이트
        const updateQuery = `
          UPDATE properties SET 
            address = $1,
            property_type = $2,
            appraisal_value = $3,
            minimum_sale_price = $4,
            auction_date = $5,
            current_status = $6,
            last_scraped_at = NOW(),
            updated_at = NOW()
          WHERE case_number = $7 AND item_number = $8 AND source_site = $9
        `;
        
        await client.query(updateQuery, [
          property.address,
          property.propertyType,
          property.appraisalValue,
          property.minimumSalePrice,
          property.auctionDate,
          this.mapStatus(property.status),
          property.caseNumber,
          property.itemNumber,
          property.sourceSite
        ]);
        
      } else {
        // 신규 삽입
        const insertQuery = `
          INSERT INTO properties (
            case_number, item_number, court_id, address, property_type,
            appraisal_value, minimum_sale_price, auction_date, 
            current_status, source_site, source_url, last_scraped_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        `;
        
        await client.query(insertQuery, [
          property.caseNumber,
          property.itemNumber,
          courtId,
          property.address,
          property.propertyType,
          property.appraisalValue,
          property.minimumSalePrice,
          property.auctionDate,
          this.mapStatus(property.status),
          property.sourceSite,
          property.sourceUrl
        ]);
        
        isNew = true;
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    return { isNew };
  }

  // 유틸리티 함수들
  cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
  }

  parsePrice(priceText) {
    if (!priceText) return null;
    const numbers = priceText.replace(/[^0-9]/g, '');
    return numbers ? parseInt(numbers) : null;
  }

  parseDate(dateText) {
    if (!dateText) return null;
    
    const match = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(match[1], match[2] - 1, match[3]);
    }
    
    const match2 = dateText.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (match2) {
      return new Date(match2[1], match2[2] - 1, match2[3]);
    }
    
    return null;
  }

  mapStatus(status) {
    if (!status) return 'active';
    
    const statusMap = {
      '신건': 'active',
      '유찰': 'failed', 
      '낙찰': 'sold',
      '취하': 'cancelled'
    };
    
    return statusMap[status] || 'active';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 브라우저 종료');
    }
  }
}

module.exports = CourtAuctionScraper;