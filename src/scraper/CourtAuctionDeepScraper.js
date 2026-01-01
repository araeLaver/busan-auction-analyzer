const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const pool = require('../../config/database'); // Database connection pool

class CourtAuctionDeepScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ153F00.xml';
    this.sessionStart = Date.now(); // 스크래핑 시작 시간 기록
  }

  async initialize(headless = true) {
    this.browser = await puppeteer.launch({
      headless: headless,
      slowMo: 300,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--window-size=1920,1080'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    this.page = await this.browser.newPage();
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // 콘솔 메시지 출력
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 브라우저 콘솔 오류:', msg.text());
      }
    });
    
    console.log('🚀 법원경매 심층 스크래퍼 초기화 완료');
  }

  async scrapeSeoulCourt(targetDate = null) {
    const logId = await this.logScrapingStart('courtauction_deep_seoul');
    const stats = { totalFound: 0, newItems: 0, updatedItems: 0, errorCount: 0 };

    try {
      console.log('📅 기일별 검색 페이지 접속...');
      
      // 기일별 검색 페이지로 이동
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('✅ 페이지 로드 완료');
      await this.page.waitForTimeout(3000);
      
      // 1단계: 검색 조건 설정
      await this.setSearchConditions(targetDate);
      
      // 2단계: 검색 실행
      await this.executeSearch();
      
      // 3단계: 매각기일 목록 수집
      const auctionSchedules = await this.collectAuctionSchedules();
      stats.totalFound = auctionSchedules.length; // 총 스케줄 수로 초기화

      console.log(`📋 총 ${auctionSchedules.length}개 매각기일 발견`);
      
      // 4단계: 각 담당계별로 상세 페이지 진입 및 데이터베이스 저장
      for (const schedule of auctionSchedules) {
        console.log(`\n🔍 담당계 진입: ${schedule.court} - ${schedule.department} (${schedule.date})`);
        const result = await this.scrapeDetailsByDepartment(schedule);
        stats.newItems += result.newItems;
        stats.updatedItems += result.updatedItems;
        stats.errorCount += result.errorCount;
      }
      
      await this.logScrapingEnd(logId, stats);
      console.log(`\n✅ 스크래핑 완료: 신규 ${stats.newItems}개, 업데이트 ${stats.updatedItems}개, 오류 ${stats.errorCount}개`);
      return stats;
      
    } catch (error) {
      console.error('❌ 스크래핑 오류:', error);
      await this.page.screenshot({ path: 'seoul-court-error.png', fullPage: true });
      await this.logScrapingEnd(logId, stats, error); // 오류 발생 시 로그
      throw error;
    }
  }

  async setSearchConditions(targetDate) {
    console.log('⚙️ 검색 조건 설정 중...');
    
    try {
      // 날짜 설정
      const today = targetDate ? new Date(targetDate) : new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 30);
      
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`; // YYYYMMDD 형식
      };
      
      const fromDate = formatDate(today);
      const toDate = formatDate(futureDate);
      
      console.log(`📅 검색 기간: ${fromDate} ~ ${toDate}`);
      
      // 기일입찰 선택
      const bidTypeSelectors = [
        'input[type="radio"][value="기일입찰"]',
        'input[type="radio"][id*="date"]',
        'input[name="bidType"][value="date"]',
        '#bidTypeDate'
      ];
      
      for (const selector of bidTypeSelectors) {
        try {
          const radio = await this.page.$(selector);
          if (radio) {
            await radio.click();
            console.log('✅ 기일입찰 선택');
            break;
          }
        } catch (e) {}
      }
      
      // 서울중앙지방법원 선택
      console.log('🏛️ 서울중앙지방법원 선택 시도...');
      
      // 법원 선택 드롭다운 찾기
      const courtSelectors = [
        'select[name*="court"]',
        'select[id*="court"]',
        '#courtSelect',
        '#srnID',
        '.court-select'
      ];
      
      for (const selector of courtSelectors) {
        try {
          const courtSelect = await this.page.$(selector);
          if (courtSelect) {
            // 옵션 목록 확인
            const options = await this.page.evaluate(select => {
              return Array.from(select.options).map(option => ({
                value: option.value,
                text: option.text
              }));
            }, courtSelect);
            
            console.log('법원 옵션:', options.filter(o => o.text.includes('서울')));
            
            // 서울중앙지방법원 선택
            const seoulOption = options.find(option => 
              option.text.includes('서울중앙') || 
              option.text === '서울중앙지방법원'
            );
            
            if (seoulOption) {
              await this.page.select(selector, seoulOption.value);
              console.log(`✅ 서울중앙지방법원 선택: ${seoulOption.text}`);
              break;
            }
          }
        } catch (e) {
          console.log(`법원 선택 실패 (${selector}): ${e.message}`);
        }
      }
      
      // 날짜 입력 필드 설정
      const dateInputs = await this.page.$$('input[type="text"][id*="date"], input[class*="date"]');
      if (dateInputs.length >= 2) {
        await dateInputs[0].click();
        await this.page.keyboard.type(fromDate);
        
        await dateInputs[1].click();
        await this.page.keyboard.type(toDate);
        
        console.log('✅ 날짜 범위 입력 완료');
      }
      
      await this.page.waitForTimeout(1000);
      
    } catch (error) {
      console.error('검색 조건 설정 오류:', error);
      throw error;
    }
  }

  async executeSearch() {
    console.log('🔍 검색 실행 중...');
    
    try {
      // 검색 버튼 클릭
      const searchButton = await this.page.$('button[type="submit"], input[type="submit"], #searchBtn, .btn-search');
      if (searchButton) {
        await searchButton.click();
        console.log('✅ 검색 버튼 클릭');
      } else {
        // Enter 키로 검색
        await this.page.keyboard.press('Enter');
        console.log('✅ Enter 키로 검색');
      }
      
      // 결과 로딩 대기
      await this.page.waitForTimeout(5000);
      
      // 스크린샷 저장 (디버깅용)
      await this.page.screenshot({ path: 'search-results.png', fullPage: true });
      console.log('📸 검색 결과 스크린샷: search-results.png');
      
    } catch (error) {
      console.error('검색 실행 오류:', error);
      throw error;
    }
  }

  async collectAuctionSchedules() {
    console.log('📋 매각기일 목록 수집 중...');
    
    const schedules = [];
    
    try {
      // 결과 테이블에서 매각기일 정보 추출
      const tableData = await this.page.evaluate(() => {
        const rows = [];
        
        // 다양한 테이블 셀렉터 시도
        const tables = document.querySelectorAll('table, .table, .list-table');
        
        for (const table of tables) {
          const tableRows = table.querySelectorAll('tr');
          
          if (tableRows.length > 1) {
            for (let i = 1; i < tableRows.length; i++) {
              const cells = tableRows[i].querySelectorAll('td');
              if (cells.length >= 3) {
                const rowData = {
                  cells: Array.from(cells).map(cell => cell.textContent.trim()),
                  links: Array.from(cells).map(cell => {
                    const link = cell.querySelector('a');
                    return link ? {
                      href: link.href,
                      onclick: link.getAttribute('onclick'),
                      text: link.textContent.trim()
                    } : null;
                  })
                };
                rows.push(rowData);
              }
            }
          }
        }
        
        return rows;
      });
      
      console.log(`📊 ${tableData.length}개 행 발견`);
      
      // 매각기일 정보 파싱
      tableData.forEach((row, index) => {
        const schedule = {
          index: index,
          court: '',
          department: '',
          date: '',
          time: '',
          room: '',
          caseCount: 0,
          link: null
        };
        
        // 각 셀에서 정보 추출
        row.cells.forEach((cell, cellIndex) => {
          // 법원명
          if (cell.includes('서울중앙지방법원')) {
            schedule.court = '서울중앙지방법원';
          }
          
          // 담당계 (예: 21계, 22계 등)
          const deptMatch = cell.match(/(\d+)계/);
          if (deptMatch) {
            schedule.department = deptMatch[0];
          }
          
          // 날짜 (YYYY-MM-DD 또는 YYYY.MM.DD)
          const dateMatch = cell.match(/\d{4}[-.\s]\d{1,2}[-.\s]\d{1,2}/);
          if (dateMatch) {
            schedule.date = dateMatch[0];
          }
          
          // 시간 (HH:MM)
          const timeMatch = cell.match(/\d{1,2}:\d{2}/);
          if (timeMatch) {
            schedule.time = timeMatch[0];
          }
          
          // 법정 (예: 301호)
          const roomMatch = cell.match(/\d+호/);
          if (roomMatch) {
            schedule.room = roomMatch[0];
          }
          
          // 사건 수
          const countMatch = cell.match(/(\d+)건/);
          if (countMatch) {
            schedule.caseCount = parseInt(countMatch[1]);
          }
        });
        
        // 링크 정보 추출
        const linkInfo = row.links.find(link => link && link.href);
        if (linkInfo) {
          schedule.link = linkInfo;
        }
        
        // 유효한 스케줄만 추가
        if (schedule.department && schedule.date) {
          schedules.push(schedule);
          console.log(`📅 매각기일: ${schedule.court} ${schedule.department} - ${schedule.date} ${schedule.time} (${schedule.caseCount}건)`);
        }
      });
      
    } catch (error) {
      console.error('매각기일 수집 오류:', error);
    }
    
    return schedules;
  }

  async scrapeDetailsByDepartment(schedule) {
    console.log(`📂 ${schedule.department} 상세 페이지 진입 시도...`);
    
    const stats = { newItems: 0, updatedItems: 0, errorCount: 0 }; // Initialize stats for this department
    try {
      // 링크가 있으면 클릭
      if (schedule.link) {
        // onclick 이벤트가 있는 경우
        if (schedule.link.onclick) {
          await this.page.evaluate(onclick => {
            eval(onclick);
          }, schedule.link.onclick);
        } 
        // href가 있는 경우
        else if (schedule.link.href && !schedule.link.href.includes('#')) {
          await this.page.goto(schedule.link.href, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
        }
        // 텍스트로 링크 찾아 클릭
        else {
          const linkElement = await this.page.$(`a:contains("${schedule.department}")`);
          if (linkElement) {
            await linkElement.click();
          }
        }
        
        await this.page.waitForTimeout(3000);
        
        // 상세 물건 목록 추출
        const departmentStats = await this.extractDetailProperties(schedule);
        
        stats.newItems = departmentStats.newItems;
        stats.updatedItems = departmentStats.updatedItems;
        stats.errorCount = departmentStats.errorCount;
        
        console.log(`✅ ${schedule.department}: 신규 ${stats.newItems}개, 업데이트 ${stats.updatedItems}개, 오류 ${stats.errorCount}개 물건 처리`);
        
        // 목록 페이지로 돌아가기
        await this.page.goBack();
        await this.page.waitForTimeout(2000);
        
      } else {
        console.log(`⚠️ ${schedule.department}: 링크 정보 없음`);
      }
      
    } catch (error) {
      console.error(`${schedule.department} 상세 페이지 오류:`, error);
      stats.errorCount++; // 부서 처리 중 오류 발생
    }
    return stats; // Return stats for this department
  }

  async extractDetailProperties(schedule) {
    console.log('🏠 물건 상세 정보 추출 중...');
    
    const stats = { newItems: 0, updatedItems: 0, errorCount: 0 };
    
    try {
      // 상세 페이지의 물건 목록 테이블 찾기
      const propertyData = await this.page.evaluate(() => {
        const items = [];
        
        // 물건 정보가 있는 테이블 찾기
        const tables = document.querySelectorAll('table');
        
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            
            if (cells.length >= 5) {
              const item = {
                cells: Array.from(cells).map(cell => cell.textContent.trim()),
                html: rows[i].innerHTML
              };
              
              // 사건번호가 있는 행만 추가
              const hasCaseNumber = item.cells.some(cell => /\d{4}타경\d+/.test(cell));
              if (hasCaseNumber) {
                items.push(item);
              }
            }
          }
        }
        
        return items;
      });
      
      console.log(`📋 ${propertyData.length}개 물건 행 발견`);
      
      // 각 물건 정보 파싱 및 저장
      for (const item of propertyData) {
        try {
          const property = {
            // 기본 정보
            court: schedule.court,
            department: schedule.department,
            auctionDate: schedule.date,
            auctionTime: schedule.time,
            courtRoom: schedule.room,
            
            // 물건 정보 (파싱된 셀에서 추출)
            caseNumber: '',
            itemNumber: '',
            address: '',
            propertyType: '',
            buildingName: '',
            area: '',
            
            // 가격 정보
            appraisalValue: null,
            minimumSalePrice: null,
            bidDeposit: null,
            
            // 추가 정보
            tenantStatus: '',
            landCategory: '',
            failureCount: 0,
            note: '',
            
            // 메타 정보
            sourceSite: 'courtauction_deep',
            sourceUrl: this.page.url(),
            scrapedAt: new Date().toISOString()
          };
          
          // 각 셀에서 정보 추출
          item.cells.forEach((cell, cellIndex) => {
            // 사건번호
            const caseMatch = cell.match(/(\d{4}타경\d+)/);
            if (caseMatch) {
              property.caseNumber = caseMatch[1];
            }
            
            // 물건번호
            const itemMatch = cell.match(/물건\s*(\d+)/);
            if (itemMatch) {
              property.itemNumber = itemMatch[1];
            }
            
            // 주소 (서울특별시로 시작하는 긴 텍스트)
            if (cell.includes('서울특별시') && cell.length > 15) {
              property.address = cell;
            }
            
            // 물건 유형
            const types = ['아파트', '오피스텔', '단독주택', '다세대', '상가', '사무실', '토지'];
            types.forEach(type => {
              if (cell.includes(type)) {
                property.propertyType = type;
              }
            });
            
            // 건물명
            if (cell.includes('아파트') || cell.includes('빌딩') || cell.includes('타워')) {
              property.buildingName = cell;
            }
            
            // 면적 (㎡ 단위)
            const areaMatch = cell.match(/([\d.]+)\s*㎡/);
            if (areaMatch) {
              property.area = areaMatch[1] + '㎡';
            }
            
            // 감정가
            if (cell.includes('감정가') || cellIndex === 5) {
              const priceMatch = cell.match(/[\d,]+/);
              if (priceMatch) {
                property.appraisalValue = parseInt(priceMatch[0].replace(/,/g, ''));
              }
            }
            
            // 최저매각가
            if (cell.includes('최저') || cellIndex === 6) {
              const priceMatch = cell.match(/[\d,]+/);
              if (priceMatch) {
                property.minimumSalePrice = parseInt(priceMatch[0].replace(/,/g, ''));
              }
            }
            
            // 입찰보증금
            if (cell.includes('보증금') || cellIndex === 7) {
              const priceMatch = cell.match(/[\d,]+/);
              if (priceMatch) {
                property.bidDeposit = parseInt(priceMatch[0].replace(/,/g, ''));
              }
            }
            
            // 임차인 현황
            if (cell.includes('임차인')) {
              property.tenantStatus = cell;
            }
            
            // 유찰 횟수
            const failureMatch = cell.match(/(\d+)회\s*유찰/);
            if (failureMatch) {
              property.failureCount = parseInt(failureMatch[1]);
            }
            
            // 비고
            if (cellIndex === item.cells.length - 1 && cell.length > 0) {
              property.note = cell;
            }
          });
          
          // 유효한 물건만 저장
          if (property.caseNumber) {
            const saved = await this.saveProperty(property);
            if (saved.isNew) {
              stats.newItems++;
            } else {
              stats.updatedItems++;
            }
            console.log(`  📍 ${property.caseNumber} - ${property.address || '주소미상'} (DB ${saved.isNew ? '신규' : '업데이트'})`);
          }
        } catch (error) {
          stats.errorCount++;
          console.error(`❌ 물건 파싱 및 저장 오류:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('물건 상세 정보 추출 오류:', error);
      stats.errorCount++; // 전체 오류 카운트 증가
    }
    
    return stats;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 브라우저 종료');
    }
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
   * 물건 저장 (데이터베이스 연동)
   * @param {object} property - 저장할 물건 데이터
   */
  async saveProperty(property) {
    const client = await pool.connect();
    let isNew = false;
    
    try {
      await client.query('BEGIN');
      
      // 법원 ID 조회
      let courtId = null;
      if (property.court) {
        const courtResult = await client.query(
          'SELECT id FROM analyzer.courts WHERE name LIKE $1',
          [`%${property.court.replace('지방법원', '')}%`]
        );
        courtId = courtResult.rows[0]?.id || null;
      }

      // 기존 데이터 확인
      const existingResult = await client.query(
        'SELECT id FROM analyzer.properties WHERE case_number = $1 AND item_number = $2 AND source_site = $3',
        [property.caseNumber, property.itemNumber, property.sourceSite]
      );
      
      if (existingResult.rows.length > 0) {
        // 업데이트
        const updateQuery = `
          UPDATE analyzer.properties SET 
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
            updated_at = NOW(),
            court_room = $14,
            department = $15
          WHERE case_number = $16 AND item_number = $17 AND source_site = $18
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
          property.area, // building_area로 사용
          null, // land_area는 명확치 않음
          property.tenantStatus,
          property.note, // special_notes로 사용
          'active', // current_status
          property.courtRoom,
          property.department,
          property.caseNumber,
          property.itemNumber,
          property.sourceSite
        ]);
        
      } else {
        // 신규 삽입
        const insertQuery = `
          INSERT INTO analyzer.properties (
            case_number, item_number, court_id, address, property_type,
            building_name, appraisal_value, minimum_sale_price, 
            auction_date, auction_time, failure_count, building_area,
            land_area, tenant_status, special_notes, current_status,
            source_site, source_url, last_scraped_at, court_room, department
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), $19, $20)
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
          property.area, // building_area로 사용
          null, // land_area는 명확치 않음
          property.tenantStatus,
          property.note, // special_notes로 사용
          'active', // current_status
          property.sourceSite,
          property.sourceUrl,
          property.courtRoom,
          property.department
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
}

module.exports = CourtAuctionDeepScraper;