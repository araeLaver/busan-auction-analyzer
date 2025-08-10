# 법원 경매정보 스크래핑 예제 코드

## 대한민국 법원 경매정보 (courtauction.go.kr) 스크래핑 예시

### 1. 기본 구조 분석
```javascript
// 부산지방법원 경매 물건 검색 URL 구조
const searchParams = {
  baseUrl: 'https://www.courtauction.go.kr/',
  court: '부산지방법원',
  searchType: {
    apartment: '아파트',
    house: '단독주택',
    land: '토지',
    commercial: '상가',
    officetel: '오피스텔'
  }
};
```

### 2. 수집 가능한 데이터 필드
```javascript
const auctionItemFields = {
  // 기본 정보
  caseNumber: '사건번호',        // 예: 2024타경12345
  itemNumber: '물건번호',         // 예: 1
  court: '법원',                 // 부산지방법원
  
  // 물건 정보
  address: '소재지',              // 부산광역시 해운대구 ...
  propertyType: '용도',           // 아파트, 상가 등
  area: '면적',                   // 84.95㎡
  
  // 가격 정보
  appraisalPrice: '감정가',       // 500,000,000원
  minimumBidPrice: '최저매각가',   // 400,000,000원
  bidDeposit: '입찰보증금',       // 40,000,000원
  
  // 입찰 정보
  auctionDate: '매각기일',        // 2024-12-20 10:30
  failureCount: '유찰횟수',       // 0회, 1회 등
  
  // 추가 정보
  tenant: '임차인현황',           // 있음/없음
  note: '비고',                  // 특이사항
  status: '진행상태'              // 신건, 유찰, 진행 등
};
```

### 3. Puppeteer를 이용한 스크래핑 코드 예시
```javascript
const puppeteer = require('puppeteer');

class CourtAuctionScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // User-Agent 설정
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  }

  async searchBusanAuctions() {
    try {
      // 법원경매정보 사이트 접속
      await this.page.goto('https://www.courtauction.go.kr/', {
        waitUntil: 'networkidle2'
      });

      // 부산지방법원 선택
      await this.page.select('#court', '부산지방법원');
      
      // 물건종류 선택 (예: 아파트)
      await this.page.click('#propertyType_apartment');
      
      // 검색 실행
      await this.page.click('#searchButton');
      await this.page.waitForSelector('.auction_list');

      // 결과 파싱
      const results = await this.page.evaluate(() => {
        const items = [];
        const rows = document.querySelectorAll('.auction_list tr');
        
        rows.forEach(row => {
          const item = {
            caseNumber: row.querySelector('.case_no')?.textContent,
            address: row.querySelector('.address')?.textContent,
            appraisalPrice: row.querySelector('.appraisal')?.textContent,
            minimumBidPrice: row.querySelector('.min_price')?.textContent,
            auctionDate: row.querySelector('.auction_date')?.textContent,
            status: row.querySelector('.status')?.textContent
          };
          items.push(item);
        });
        
        return items;
      });

      return results;
    } catch (error) {
      console.error('스크래핑 오류:', error);
      return [];
    }
  }

  async getDetailInfo(caseNumber) {
    // 상세 페이지 접근
    const detailUrl = `https://www.courtauction.go.kr/DetailInfo.aspx?case=${caseNumber}`;
    await this.page.goto(detailUrl, { waitUntil: 'networkidle2' });

    const details = await this.page.evaluate(() => {
      return {
        // 물건 상세 정보
        buildingName: document.querySelector('#buildingName')?.textContent,
        landArea: document.querySelector('#landArea')?.textContent,
        buildingArea: document.querySelector('#buildingArea')?.textContent,
        
        // 임차인 정보
        tenantInfo: document.querySelector('#tenantInfo')?.textContent,
        
        // 특이사항
        specialNotes: document.querySelector('#specialNotes')?.textContent,
        
        // 감정평가 정보
        evaluationDate: document.querySelector('#evalDate')?.textContent
      };
    });

    return details;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// 사용 예시
async function main() {
  const scraper = new CourtAuctionScraper();
  
  try {
    await scraper.initialize();
    
    // 부산 경매 물건 검색
    const auctionItems = await scraper.searchBusanAuctions();
    console.log(`찾은 물건 수: ${auctionItems.length}`);
    
    // 각 물건의 상세 정보 수집
    for (const item of auctionItems) {
      const details = await scraper.getDetailInfo(item.caseNumber);
      console.log('상세 정보:', details);
      
      // Rate limiting - 서버 부하 방지
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } finally {
    await scraper.close();
  }
}
```

### 4. Playwright 대안 코드
```javascript
const { chromium } = require('playwright');

class PlaywrightScraper {
  async scrapeWithPlaywright() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://www.courtauction.go.kr/');
    
    // 부산지방법원 선택
    await page.selectOption('select#court', '부산지방법원');
    
    // 검색 실행
    await page.click('button#search');
    
    // 결과 대기
    await page.waitForSelector('.result-table');
    
    // 데이터 추출
    const data = await page.$$eval('.result-row', rows => {
      return rows.map(row => ({
        caseNo: row.querySelector('.case-no')?.innerText,
        address: row.querySelector('.address')?.innerText,
        price: row.querySelector('.price')?.innerText
      }));
    });
    
    await browser.close();
    return data;
  }
}
```

### 5. 데이터 정제 유틸리티
```javascript
class DataCleaner {
  // 가격 문자열을 숫자로 변환
  static parsePrice(priceStr) {
    if (!priceStr) return 0;
    
    // "500,000,000원" -> 500000000
    return parseInt(priceStr.replace(/[^0-9]/g, ''));
  }
  
  // 날짜 파싱
  static parseDate(dateStr) {
    // "2024.12.20 (금) 10:30" -> Date 객체
    const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (match) {
      return new Date(match[1], match[2] - 1, match[3]);
    }
    return null;
  }
  
  // 면적 파싱
  static parseArea(areaStr) {
    // "84.95㎡" -> 84.95
    const match = areaStr.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }
  
  // 주소 정규화
  static normalizeAddress(address) {
    return address
      .replace(/\s+/g, ' ')
      .trim();
  }
}
```

### 6. 에러 처리 및 재시도 로직
```javascript
class RobustScraper {
  async scrapeWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.scrape(url);
        return result;
      } catch (error) {
        console.log(`시도 ${i + 1} 실패:`, error.message);
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        // 재시도 전 대기
        await new Promise(resolve => 
          setTimeout(resolve, (i + 1) * 2000)
        );
      }
    }
  }
  
  async handleCaptcha(page) {
    // Captcha 감지
    const hasCaptcha = await page.$('#captcha');
    
    if (hasCaptcha) {
      console.log('Captcha 감지됨 - 수동 처리 필요');
      // 2captcha 등 서비스 연동 또는 수동 처리
      throw new Error('Captcha 처리 필요');
    }
  }
}
```

### 7. 스케줄러 설정
```javascript
const cron = require('node-cron');

// 매일 오전 6시에 스크래핑 실행
cron.schedule('0 6 * * *', async () => {
  console.log('일일 스크래핑 시작:', new Date());
  
  try {
    const scraper = new CourtAuctionScraper();
    await scraper.initialize();
    const results = await scraper.searchBusanAuctions();
    
    // 데이터베이스 저장
    await saveToDatabase(results);
    
    // 분석 실행
    await runAnalysis(results);
    
    await scraper.close();
    console.log('스크래핑 완료');
  } catch (error) {
    console.error('스크래핑 실패:', error);
    // 에러 알림 발송
  }
});
```