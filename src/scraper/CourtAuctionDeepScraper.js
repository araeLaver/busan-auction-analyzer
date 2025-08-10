const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class CourtAuctionDeepScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ153F00.xml';
    this.allProperties = [];
  }

  async initialize(headless = false) {
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
      
      console.log(`📋 총 ${auctionSchedules.length}개 매각기일 발견`);
      
      // 4단계: 각 담당계별로 상세 페이지 진입
      for (const schedule of auctionSchedules) {
        console.log(`\n🔍 담당계 진입: ${schedule.court} - ${schedule.department} (${schedule.date})`);
        await this.scrapeDetailsByDepartment(schedule);
      }
      
      console.log(`\n✅ 총 ${this.allProperties.length}개 물건 수집 완료`);
      return this.allProperties;
      
    } catch (error) {
      console.error('❌ 스크래핑 오류:', error);
      await this.page.screenshot({ path: 'seoul-court-error.png', fullPage: true });
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
        const properties = await this.extractDetailProperties(schedule);
        
        console.log(`✅ ${schedule.department}: ${properties.length}개 물건 추출`);
        
        // 전체 목록에 추가
        this.allProperties.push(...properties);
        
        // 목록 페이지로 돌아가기
        await this.page.goBack();
        await this.page.waitForTimeout(2000);
        
      } else {
        console.log(`⚠️ ${schedule.department}: 링크 정보 없음`);
      }
      
    } catch (error) {
      console.error(`${schedule.department} 상세 페이지 오류:`, error);
    }
  }

  async extractDetailProperties(schedule) {
    console.log('🏠 물건 상세 정보 추출 중...');
    
    const properties = [];
    
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
      
      // 각 물건 정보 파싱
      propertyData.forEach((item, index) => {
        const property = {
          // 기본 정보
          court: schedule.court,
          department: schedule.department,
          auctionDate: schedule.date,
          auctionTime: schedule.time,
          courtRoom: schedule.room,
          
          // 물건 정보
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
          sourceSite: 'courtauction',
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
        
        // 유효한 물건만 추가
        if (property.caseNumber) {
          properties.push(property);
          
          console.log(`  📍 ${index + 1}. ${property.caseNumber} - ${property.address || '주소미상'}`);
          if (property.minimumSalePrice) {
            console.log(`     💰 최저가: ${property.minimumSalePrice.toLocaleString()}원`);
          }
        }
      });
      
    } catch (error) {
      console.error('물건 상세 정보 추출 오류:', error);
    }
    
    return properties;
  }

  async saveToJSON(filename = 'seoul-court-properties.json') {
    const fs = require('fs').promises;
    
    try {
      const data = {
        scrapedAt: new Date().toISOString(),
        totalCount: this.allProperties.length,
        properties: this.allProperties
      };
      
      await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ ${filename} 파일로 저장 완료`);
      
    } catch (error) {
      console.error('JSON 저장 오류:', error);
    }
  }

  async saveToCSV(filename = 'seoul-court-properties.csv') {
    const fs = require('fs').promises;
    
    try {
      // CSV 헤더
      const headers = [
        '법원', '담당계', '매각기일', '매각시간', '법정',
        '사건번호', '물건번호', '주소', '물건유형', '건물명',
        '면적', '감정가', '최저매각가', '입찰보증금',
        '임차인현황', '유찰횟수', '비고'
      ];
      
      let csv = headers.join(',') + '\n';
      
      // 데이터 행 추가
      this.allProperties.forEach(property => {
        const row = [
          property.court,
          property.department,
          property.auctionDate,
          property.auctionTime,
          property.courtRoom,
          property.caseNumber,
          property.itemNumber,
          `"${property.address}"`,
          property.propertyType,
          `"${property.buildingName}"`,
          property.area,
          property.appraisalValue || '',
          property.minimumSalePrice || '',
          property.bidDeposit || '',
          `"${property.tenantStatus}"`,
          property.failureCount,
          `"${property.note}"`
        ];
        
        csv += row.join(',') + '\n';
      });
      
      await fs.writeFile(filename, csv, 'utf8');
      console.log(`✅ ${filename} 파일로 저장 완료`);
      
    } catch (error) {
      console.error('CSV 저장 오류:', error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 브라우저 종료');
    }
  }
}

module.exports = CourtAuctionDeepScraper;