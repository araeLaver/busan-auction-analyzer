const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const pool = require('../../config/database');

/**
 * 고급 법원경매 스크래퍼 - Anti-Detection & 성능 최적화
 * 
 * 주요 기능:
 * - Anti-detection 기술 적용
 * - 스텔스 모드 브라우저 설정
 * - 동적 딜레이 및 행동 패턴 시뮬레이션
 * - 병렬 처리 최적화
 * - 에러 복구 메커니즘
 * - 상세 로깅 및 모니터링
 */
class AdvancedCourtAuctionScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://www.courtauction.go.kr';
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    this.retryCount = 0;
    this.maxRetries = 3;
    this.sessionStart = Date.now();
  }

  /**
   * 브라우저 초기화 - 강화된 Anti-detection 설정
   */
  async initialize() {
    try {
      console.log('🚀 고급 스크래퍼 초기화 중...');
      
      this.browser = await puppeteer.launch({
        headless: 'new', // 새로운 헤드리스 모드
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-back-forward-cache',
          '--disable-ipc-flooding-protection',
          '--disable-blink-features=AutomationControlled',
          '--no-default-browser-check',
          '--mute-audio',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--disable-translate',
          '--disable-notifications',
          '--disable-permissions-api',
          '--hide-scrollbars',
          '--window-size=1920,1080',
          '--start-maximized',
          // 추가 스텔스 모드
          '--disable-blink-features=WebGLDebugRendererInfo',
          '--disable-webgl',
          '--disable-threaded-compositing',
          '--disable-partial-raster',
          '--disable-canvas-aa',
          '--disable-2d-canvas-clip-aa',
          '--disable-gl-drawing-for-tests'
        ],
        ignoreDefaultArgs: [
          '--enable-automation',
          '--enable-blink-features=IdleDetection',
          '--password-store=basic'
        ],
        ignoreHTTPSErrors: true,
        devtools: false,
        slowMo: this.getRandomDelay(10, 30) // 랜덤 슬로우 모션
      });
      
      this.page = await this.browser.newPage();
      
      // 뷰포트 설정 - 일반적인 해상도 사용
      await this.page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });
      
      // 랜덤 User-Agent 설정
      const randomUA = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await this.page.setUserAgent(randomUA);
      console.log(`🎭 User-Agent 설정: ${randomUA.substring(0, 50)}...`);
      
      // 추가 헤더 설정
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // 권한 설정
      await this.page.context().overridePermissions(this.baseUrl, [
        'geolocation',
        'notifications'
      ]);
      
      // JavaScript 환경 설정 - 탐지 방지
      await this.page.evaluateOnNewDocument(() => {
        // webdriver 플래그 제거
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Chrome 객체 추가
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
        };
        
        // Plugin 정보 추가
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Language 정보 설정
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ko-KR', 'ko', 'en-US', 'en']
        });
        
        // 시간대 설정
        Date.prototype.getTimezoneOffset = function() {
          return -540; // KST (UTC+9)
        };
        
        // WebGL 정보 숨기기
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Open Source Technology Center';
          }
          if (parameter === 37446) {
            return 'Mesa DRI Intel(R) Ivybridge Mobile ';
          }
          return getParameter.call(this, parameter);
        };
        
        // Permissions API 오버라이드
        if (navigator.permissions && navigator.permissions.query) {
          const originalQuery = navigator.permissions.query;
          navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
        }
        
        // 마우스 이벤트 시뮬레이션을 위한 준비
        window.simulateHumanBehavior = true;
      });
      
      // 이미지 및 CSS 로딩 최적화
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url();
        
        // 불필요한 리소스 차단
        if (resourceType === 'image' || resourceType === 'stylesheet' || 
            resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else if (resourceType === 'script' && 
                   (url.includes('analytics') || url.includes('ads') || 
                    url.includes('tracking') || url.includes('gtm'))) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // 페이지 로드 타임아웃 설정
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      console.log('✅ 고급 스크래퍼 초기화 완료');
      
    } catch (error) {
      console.error('❌ 브라우저 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 인간적인 행동 패턴 시뮬레이션
   */
  async simulateHumanBehavior() {
    // 랜덤 마우스 움직임
    await this.page.mouse.move(
      Math.random() * 1920, 
      Math.random() * 1080,
      { steps: Math.floor(Math.random() * 10) + 5 }
    );
    
    // 랜덤 스크롤
    await this.page.evaluate(() => {
      window.scrollBy(0, Math.random() * 500 - 250);
    });
    
    // 랜덤 딜레이
    await this.sleep(this.getRandomDelay(100, 500));
  }

  /**
   * 랜덤 딜레이 생성
   */
  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 스크래핑 로그 시작
   */
  async logScrapingStart(sourceSite) {
    const query = `
      INSERT INTO scraping_logs (source_site, status) 
      VALUES ($1, 'running') 
      RETURNING id
    `;
    const result = await pool.query(query, [sourceSite]);
    return result.rows[0].id;
  }

  /**
   * 스크래핑 로그 종료
   */
  async logScrapingEnd(logId, stats, error = null) {
    const executionTime = Math.floor((Date.now() - this.sessionStart) / 1000);
    
    const query = `
      UPDATE scraping_logs 
      SET status = $2, 
          total_found = $3, 
          new_items = $4, 
          updated_items = $5,
          error_count = $6,
          error_message = $7,
          execution_time = $8
      WHERE id = $1
    `;
    
    await pool.query(query, [
      logId, 
      error ? 'failed' : 'completed', 
      stats.totalFound, 
      stats.newItems, 
      stats.updatedItems,
      error ? stats.errorCount || 1 : 0,
      error ? error.message : null,
      executionTime
    ]);
  }

  /**
   * 부산지방법원 스크래핑 (메인 함수)
   */
  async scrapeBusanAuctions() {
    const logId = await this.logScrapingStart('courtauction_busan');
    const stats = { totalFound: 0, newItems: 0, updatedItems: 0, errorCount: 0 };
    
    try {
      console.log('🏛️ 부산지방법원 경매 정보 스크래핑 시작...');
      
      // 사이트 접속 및 검색
      await this.navigateToSite();
      await this.searchBusanCourt();
      
      // 물건 목록 수집 (페이지네이션 포함)
      const properties = await this.extractAllProperties();
      stats.totalFound = properties.length;
      
      console.log(`📊 총 ${properties.length}개 물건 발견`);
      
      // 병렬 처리로 데이터베이스 저장
      const savePromises = properties.map(async (property) => {
        try {
          const saved = await this.saveProperty(property);
          if (saved.isNew) {
            stats.newItems++;
          } else {
            stats.updatedItems++;
          }
        } catch (error) {
          stats.errorCount++;
          console.error(`❌ 물건 저장 오류 (${property.caseNumber}):`, error.message);
        }
      });
      
      await Promise.allSettled(savePromises);
      
      await this.logScrapingEnd(logId, stats);
      
      console.log(`✅ 스크래핑 완료: 신규 ${stats.newItems}개, 업데이트 ${stats.updatedItems}개, 오류 ${stats.errorCount}개`);
      return stats;
      
    } catch (error) {
      console.error('❌ 스크래핑 오류:', error);
      await this.logScrapingEnd(logId, stats, error);
      throw error;
    }
  }

  /**
   * 사이트 접속
   */
  async navigateToSite() {
    let attempt = 0;
    
    while (attempt < this.maxRetries) {
      try {
        console.log(`🌐 법원경매정보 사이트 접속 시도 ${attempt + 1}/${this.maxRetries}...`);
        
        await this.page.goto(this.baseUrl, { 
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000 
        });
        
        // 인간적 행동 시뮬레이션
        await this.simulateHumanBehavior();
        
        // 페이지 로드 확인
        const title = await this.page.title();
        console.log(`📄 페이지 제목: ${title}`);
        
        if (title.includes('법원경매')) {
          console.log('✅ 사이트 접속 성공');
          return;
        }
        
        throw new Error('페이지 로드 실패');
        
      } catch (error) {
        attempt++;
        console.warn(`⚠️ 접속 시도 ${attempt} 실패:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = this.getRandomDelay(2000, 5000);
          console.log(`🔄 ${delay}ms 대기 후 재시도...`);
          await this.sleep(delay);
        } else {
          throw new Error(`사이트 접속 실패 (${this.maxRetries}회 시도)`);
        }
      }
    }
  }

  /**
   * 부산지방법원 검색 설정
   */
  async searchBusanCourt() {
    try {
      console.log('🔍 부산지방법원 검색 설정 중...');
      
      // 부동산 경매 메뉴로 이동
      const realEstateUrl = `${this.baseUrl}/RetrieveRealEstateAuctionDetail.laf`;
      await this.page.goto(realEstateUrl, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });
      
      // 페이지 로드 대기
      await this.sleep(this.getRandomDelay(1000, 3000));
      
      // 인간적 행동 시뮬레이션
      await this.simulateHumanBehavior();
      
      // 법원 선택 (부산지방법원)
      await this.selectCourt('부산지방법원');
      
      // 물건 유형 설정 (전체)
      await this.setPropertyType();
      
      // 매각기일 설정 (오늘부터 3개월)
      await this.setAuctionDateRange();
      
      // 검색 실행
      await this.executeSearch();
      
      console.log('✅ 부산지방법원 검색 설정 완료');
      
    } catch (error) {
      console.error('❌ 검색 설정 오류:', error);
      
      // 디버깅용 스크린샷
      await this.saveDebugScreenshot('search-error');
      throw error;
    }
  }

  /**
   * 법원 선택
   */
  async selectCourt(courtName) {
    const selectors = [
      '#srnID',
      'select[name="srnID"]',
      '.court-select',
      'select[title*="법원"]'
    ];
    
    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          await this.page.select(selector, courtName);
          console.log(`✅ 법원 선택 성공: ${courtName}`);
          await this.sleep(this.getRandomDelay(500, 1000));
          return;
        }
      } catch (error) {
        continue;
      }
    }
    
    console.warn('⚠️ 법원 선택 요소를 찾을 수 없음');
  }

  /**
   * 물건 유형 설정
   */
  async setPropertyType() {
    try {
      // 전체 유형 선택
      const allTypeSelectors = [
        'input[name="rd2"][value=""]',
        'input[value="전체"]',
        '.property-type-all'
      ];
      
      for (const selector of allTypeSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          await element.click();
          console.log('✅ 전체 물건 유형 선택');
          await this.sleep(this.getRandomDelay(200, 500));
          return;
        }
      }
    } catch (error) {
      console.warn('⚠️ 물건 유형 설정 실패:', error.message);
    }
  }

  /**
   * 매각기일 범위 설정
   */
  async setAuctionDateRange() {
    try {
      const today = new Date();
      const threeMonthsLater = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
      
      const startDate = today.toISOString().split('T')[0].replace(/-/g, '.');
      const endDate = threeMonthsLater.toISOString().split('T')[0].replace(/-/g, '.');
      
      // 시작일 설정
      const startDateSelectors = [
        'input[name="startDate"]',
        '#startDate',
        '.start-date'
      ];
      
      for (const selector of startDateSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          await element.click({ clickCount: 3 });
          await element.type(startDate);
          break;
        }
      }
      
      // 종료일 설정
      const endDateSelectors = [
        'input[name="endDate"]',
        '#endDate',
        '.end-date'
      ];
      
      for (const selector of endDateSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          await element.click({ clickCount: 3 });
          await element.type(endDate);
          break;
        }
      }
      
      console.log(`📅 매각기일 범위 설정: ${startDate} ~ ${endDate}`);
      
    } catch (error) {
      console.warn('⚠️ 매각기일 설정 실패:', error.message);
    }
  }

  /**
   * 검색 실행
   */
  async executeSearch() {
    const searchSelectors = [
      'input[alt="검색"]',
      'button[type="submit"]', 
      '.search_btn',
      'input[type="submit"]',
      '.btn-search',
      'img[alt="검색"]'
    ];
    
    for (const selector of searchSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          await element.click();
          console.log(`✅ 검색 실행: ${selector}`);
          
          // 검색 결과 로딩 대기
          await this.page.waitForNavigation({
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
          });
          
          await this.sleep(this.getRandomDelay(2000, 4000));
          return;
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('검색 버튼을 찾을 수 없음');
  }

  /**
   * 모든 페이지의 물건 정보 추출
   */
  async extractAllProperties() {
    const allProperties = [];
    let currentPage = 1;
    const maxPages = 50; // 최대 페이지 제한
    
    try {
      while (currentPage <= maxPages) {
        console.log(`📄 ${currentPage} 페이지 처리 중...`);
        
        // 현재 페이지 물건 추출
        const pageProperties = await this.extractCurrentPageProperties();
        
        if (pageProperties.length === 0) {
          console.log('📭 더 이상 물건이 없습니다.');
          break;
        }
        
        allProperties.push(...pageProperties);
        console.log(`📊 ${currentPage} 페이지: ${pageProperties.length}개 물건 추출 (누적: ${allProperties.length}개)`);
        
        // 다음 페이지로 이동
        const hasNextPage = await this.goToNextPage();
        if (!hasNextPage) {
          console.log('📄 마지막 페이지 도달');
          break;
        }
        
        currentPage++;
        
        // 페이지 간 대기 (인간적 행동)
        await this.sleep(this.getRandomDelay(1500, 3500));
        await this.simulateHumanBehavior();
      }
      
    } catch (error) {
      console.error('❌ 물건 추출 중 오류:', error);
      throw error;
    }
    
    return allProperties;
  }

  /**
   * 현재 페이지 물건 정보 추출
   */
  async extractCurrentPageProperties() {
    const properties = [];
    
    try {
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      // 다양한 테이블 셀렉터 시도
      const tableSelectors = [
        'table.Ltbl tbody tr',
        'table.etc tbody tr',
        'table tbody tr',
        '.table_list tbody tr',
        '.list_table tbody tr',
        'tr.list-row',
        'tr[bgcolor]'
      ];
      
      let extractedCount = 0;
      
      for (const selector of tableSelectors) {
        const rows = $(selector);
        
        if (rows.length > 0) {
          console.log(`📋 테이블 발견: ${rows.length}개 행`);
          
          rows.each((index, row) => {
            try {
              const property = this.parsePropertyRow($, $(row));
              if (this.isValidProperty(property)) {
                properties.push(property);
                extractedCount++;
              }
            } catch (error) {
              console.warn(`⚠️ 행 ${index} 파싱 오류:`, error.message);
            }
          });
          
          if (extractedCount > 0) {
            break; // 첫 번째로 성공한 테이블 사용
          }
        }
      }
      
      // 테이블을 찾지 못한 경우 텍스트 패턴 매칭 시도
      if (extractedCount === 0) {
        console.log('📝 테이블 파싱 실패, 텍스트 패턴 매칭 시도...');
        const textProperties = await this.extractFromText($);
        properties.push(...textProperties);
      }
      
    } catch (error) {
      console.error('❌ 페이지 내용 추출 오류:', error);
      
      // 디버깅용 스크린샷
      await this.saveDebugScreenshot(`extract-error-page`);
    }
    
    return properties;
  }

  /**
   * 테이블 행에서 물건 정보 파싱
   */
  parsePropertyRow($, row) {
    const cells = row.find('td');
    if (cells.length < 4) return null;
    
    const property = {
      caseNumber: this.cleanText(cells.eq(0).text() || cells.eq(1).text()),
      itemNumber: this.extractItemNumber(cells),
      address: this.extractAddress(cells),
      propertyType: this.extractPropertyType(cells),
      buildingName: this.extractBuildingName(cells),
      appraisalValue: this.extractPrice(cells, ['감정가', '감정', '평가가']),
      minimumSalePrice: this.extractPrice(cells, ['최저매각가', '최저가', '시작가']),
      auctionDate: this.extractAuctionDate(cells),
      auctionTime: this.extractAuctionTime(cells),
      failureCount: this.extractFailureCount(cells),
      buildingArea: this.extractArea(cells, ['건물면적', '면적']),
      landArea: this.extractArea(cells, ['토지면적']),
      status: this.extractStatus(cells),
      tenantStatus: this.extractTenantStatus(cells),
      specialNotes: this.extractSpecialNotes(cells),
      sourceSite: 'courtauction_busan',
      sourceUrl: this.page.url(),
      scrapedAt: new Date()
    };
    
    return property;
  }

  /**
   * 물건 정보 유효성 검증
   */
  isValidProperty(property) {
    if (!property) return false;
    
    // 필수 필드 체크
    const hasCaseNumber = property.caseNumber && property.caseNumber.length > 5;
    const hasAddress = property.address && property.address.length > 10;
    const hasValidPrice = property.appraisalValue > 1000000 || property.minimumSalePrice > 1000000;
    
    return hasCaseNumber || hasAddress || hasValidPrice;
  }

  /**
   * 다음 페이지로 이동
   */
  async goToNextPage() {
    try {
      const nextSelectors = [
        'a[title="다음페이지"]',
        'a:contains("다음")',
        '.next-page',
        'a[href*="page"]:last-child',
        'img[alt="다음페이지"]'
      ];
      
      for (const selector of nextSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          const isDisabled = await this.page.evaluate((el) => {
            return el.style.display === 'none' || 
                   el.disabled || 
                   el.getAttribute('href') === '#' ||
                   el.classList.contains('disabled');
          }, element);
          
          if (!isDisabled) {
            await element.click();
            
            // 페이지 로딩 대기
            await this.page.waitForNavigation({
              waitUntil: ['networkidle0', 'domcontentloaded'],
              timeout: 30000
            });
            
            return true;
          }
        }
      }
      
      return false;
      
    } catch (error) {
      console.log('📄 다음 페이지 없음 또는 이동 실패');
      return false;
    }
  }

  /**
   * 디버깅용 스크린샷 저장
   */
  async saveDebugScreenshot(filename) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `debug-${filename}-${timestamp}.png`;
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        quality: 80,
        type: 'png'
      });
      console.log(`📸 디버깅 스크린샷 저장: ${screenshotPath}`);
    } catch (error) {
      console.warn('⚠️ 스크린샷 저장 실패:', error.message);
    }
  }

  // 데이터 추출 헬퍼 메서드들
  extractItemNumber(cells) {
    for (let i = 0; i < cells.length; i++) {
      const text = this.cleanText(cells.eq(i).text());
      const match = text.match(/^\d+$/);
      if (match && parseInt(match[0]) < 100) {
        return match[0];
      }
    }
    return '1';
  }

  extractAddress(cells) {
    for (let i = 0; i < cells.length; i++) {
      const text = this.cleanText(cells.eq(i).text());
      if (text.includes('부산') && text.length > 10) {
        return text;
      }
    }
    return '';
  }

  extractPropertyType(cells) {
    const types = ['아파트', '오피스텔', '단독주택', '빌라', '연립', '상가', '토지', '공장', '창고'];
    
    for (let i = 0; i < cells.length; i++) {
      const text = this.cleanText(cells.eq(i).text());
      for (const type of types) {
        if (text.includes(type)) {
          return type;
        }
      }
    }
    return '기타';
  }

  extractPrice(cells, keywords) {
    for (let i = 0; i < cells.length; i++) {
      const text = this.cleanText(cells.eq(i).text());
      const hasKeyword = keywords.some(keyword => text.includes(keyword));
      
      if (hasKeyword || /[\d,]+원?/.test(text)) {
        const price = this.parsePrice(text);
        if (price && price > 100000) {
          return price;
        }
      }
    }
    return null;
  }

  extractAuctionDate(cells) {
    for (let i = 0; i < cells.length; i++) {
      const text = this.cleanText(cells.eq(i).text());
      const date = this.parseDate(text);
      if (date) return date;
    }
    return null;
  }

  extractFailureCount(cells) {
    for (let i = 0; i < cells.length; i++) {
      const text = this.cleanText(cells.eq(i).text());
      if (text.includes('유찰')) {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
    }
    return 0;
  }

  // 물건 저장 (기존 로직과 동일하되 부산지방법원용으로 수정)
  async saveProperty(property) {
    const client = await pool.connect();
    let isNew = false;
    
    try {
      await client.query('BEGIN');
      
      // 부산지방법원 ID 조회
      const courtResult = await client.query(
        'SELECT id FROM courts WHERE name LIKE $1',
        ['%부산%']
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
            building_name = $3,
            appraisal_value = $4,
            minimum_sale_price = $5,
            auction_date = $6,
            auction_time = $7,
            failure_count = $8,
            building_area = $9,
            land_area = $10,
            tenant_status = $11,
            special_notes = $12,
            current_status = $13,
            last_scraped_at = NOW(),
            updated_at = NOW()
          WHERE case_number = $14 AND item_number = $15 AND source_site = $16
        `;
        
        await client.query(updateQuery, [
          property.address,
          property.propertyType,
          property.buildingName,
          property.appraisalValue,
          property.minimumSalePrice,
          property.auctionDate,
          property.auctionTime,
          property.failureCount,
          property.buildingArea,
          property.landArea,
          property.tenantStatus,
          property.specialNotes,
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
            building_name, appraisal_value, minimum_sale_price, 
            auction_date, auction_time, failure_count, building_area,
            land_area, tenant_status, special_notes, current_status,
            source_site, source_url, last_scraped_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        `;
        
        await client.query(insertQuery, [
          property.caseNumber,
          property.itemNumber,
          courtId,
          property.address,
          property.propertyType,
          property.buildingName,
          property.appraisalValue,
          property.minimumSalePrice,
          property.auctionDate,
          property.auctionTime,
          property.failureCount,
          property.buildingArea,
          property.landArea,
          property.tenantStatus,
          property.specialNotes,
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
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
  }

  parsePrice(text) {
    if (!text) return null;
    const numbers = text.replace(/[^\d]/g, '');
    return numbers ? parseInt(numbers) : null;
  }

  parseDate(text) {
    if (!text) return null;
    
    const patterns = [
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{4})\.(\d{2})\.(\d{2})/,
      /(\d{4})\/(\d{2})\/(\d{2})/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
    }
    
    return null;
  }

  mapStatus(status) {
    if (!status) return 'active';
    
    const statusMap = {
      '신건': 'active',
      '진행': 'active', 
      '유찰': 'failed',
      '낙찰': 'sold',
      '취하': 'cancelled',
      '종료': 'completed'
    };
    
    return statusMap[status] || 'active';
  }

  /**
   * 브라우저 종료
   */
  async close() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log('🔒 브라우저 안전하게 종료');
    } catch (error) {
      console.error('❌ 브라우저 종료 오류:', error);
    }
  }
}

module.exports = AdvancedCourtAuctionScraper;