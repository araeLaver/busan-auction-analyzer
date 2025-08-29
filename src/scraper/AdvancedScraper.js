const puppeteer = require('puppeteer');
const axios = require('axios');

/**
 * 고급 웹 방화벽 우회 스크래퍼
 * 실제 법원경매정보에서 현재 진행 중인 경매 데이터 수집
 */
class AdvancedScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'https://www.courtauction.go.kr';
    }

    async initialize() {
        try {
            console.log('🚀 고급 스크래퍼 초기화 중...');
            
            // 더 은밀한 브라우저 설정
            this.browser = await puppeteer.launch({
                headless: false,
                devtools: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-default-apps',
                    '--disable-popup-blocking',
                    '--disable-translate',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-device-discovery-notifications',
                    '--disable-web-security',
                    '--allow-running-insecure-content',
                    '--window-size=1920,1080'
                ]
            });
            
            const pages = await this.browser.pages();
            this.page = pages[0];
            
            // 완전히 사람처럼 보이게 설정
            await this.page.evaluateOnNewDocument(() => {
                // webdriver 속성 제거
                delete navigator.__proto__.webdriver;
                
                // 완전한 navigator 객체 재정의
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['ko-KR', 'ko', 'en-US', 'en'],
                });
                
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        { name: 'Shockwave Flash', filename: 'pepflashplayer.dll' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin' }
                    ]
                });
                
                // 권한 관련
                const originalQuery = window.navigator.permissions.query;
                return window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
            });
            
            // 실제 브라우저 User-Agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // 실제 브라우저 헤더들
            await this.page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            });
            
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            console.log('✅ 고급 스크래퍼 초기화 완료');
            
        } catch (error) {
            console.error('❌ 초기화 실패:', error);
            throw error;
        }
    }

    async scrapeRealData() {
        try {
            console.log('🌐 법원경매정보 사이트 접속 시도...');
            
            // 1단계: 직접 메인 페이지 접속
            await this.page.goto('https://www.courtauction.go.kr', {
                waitUntil: 'networkidle0',
                timeout: 60000
            });
            
            // 사람처럼 페이지 로딩 대기
            await this.humanDelay(3000, 2000);
            
            const title = await this.page.title();
            console.log('📄 페이지 제목:', title);
            
            // 차단 확인
            if (title.includes('시스템안내') || title.includes('blocked')) {
                console.log('🛡️ 방화벽 감지. 우회 시도...');
                
                // 새탭에서 다시 시도
                const newPage = await this.browser.newPage();
                await newPage.goto('https://www.courtauction.go.kr', {
                    waitUntil: 'networkidle0',
                    timeout: 60000
                });
                this.page = newPage;
            }
            
            // 2단계: 물건정보 페이지로 이동
            console.log('🔍 물건정보 검색 페이지 이동...');
            
            // 직접 URL로 물건정보 페이지 접근 시도
            const searchUrls = [
                'https://www.courtauction.go.kr/InitMulSrch.laf',
                'https://www.courtauction.go.kr/RetrieveRealEstMulSrchInfo.laf',
                'https://www.courtauction.go.kr/ib/gd/w/sr/sr.html'
            ];
            
            for (const url of searchUrls) {
                try {
                    console.log(`📋 시도 중: ${url}`);
                    await this.page.goto(url, {
                        waitUntil: 'networkidle0',
                        timeout: 30000
                    });
                    
                    await this.humanDelay(2000, 1000);
                    
                    const currentTitle = await this.page.title();
                    if (!currentTitle.includes('시스템안내')) {
                        console.log(`✅ 성공: ${currentTitle}`);
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ 실패: ${url}`);
                    continue;
                }
            }
            
            // 3단계: 페이지 내용 분석
            const html = await this.page.content();
            
            if (html.includes('시스템안내')) {
                throw new Error('웹 방화벽으로 차단됨');
            }
            
            // 4단계: 실제 데이터 추출
            const properties = await this.extractRealProperties();
            
            return properties;
            
        } catch (error) {
            console.error('❌ 실제 데이터 수집 실패:', error);
            
            // 스크린샷으로 상태 확인
            try {
                await this.page.screenshot({ 
                    path: 'debug-real-scraper.png',
                    fullPage: true 
                });
                console.log('📸 디버그 스크린샷 저장: debug-real-scraper.png');
            } catch (e) {}
            
            throw error;
        }
    }

    async extractRealProperties() {
        console.log('📊 실제 경매 물건 데이터 추출 중...');
        
        const properties = [];
        
        try {
            // JavaScript 실행으로 데이터 추출
            const extractedData = await this.page.evaluate(() => {
                const results = [];
                
                // 다양한 테이블 선택자 시도
                const tableSelectors = [
                    'table.Ltbl',
                    'table.table',
                    'table[summary*="물건"]',
                    'table tbody tr',
                    '.list-table tbody tr'
                ];
                
                for (const selector of tableSelectors) {
                    const rows = document.querySelectorAll(selector);
                    if (rows.length > 0) {
                        console.log(`테이블 발견: ${selector} (${rows.length}행)`);
                        
                        rows.forEach((row, index) => {
                            const cells = row.querySelectorAll('td');
                            if (cells.length >= 5) {
                                results.push({
                                    index,
                                    cells: Array.from(cells).map(cell => cell.textContent.trim())
                                });
                            }
                        });
                        
                        break;
                    }
                }
                
                return results;
            });
            
            console.log(`📋 추출된 데이터 행 수: ${extractedData.length}`);
            
            // 데이터 파싱
            for (const row of extractedData.slice(0, 20)) {
                try {
                    const property = {
                        case_number: row.cells[0] || `REAL-${Date.now()}-${Math.random()}`,
                        court_name: this.parseCourtName(row.cells[1]),
                        property_type: this.parsePropertyType(row.cells[2]),
                        address: row.cells[3] || '주소 미상',
                        appraisal_value: this.parsePrice(row.cells[4]),
                        minimum_sale_price: this.parsePrice(row.cells[5]),
                        auction_date: this.parseDate(row.cells[6]),
                        current_status: 'active',
                        scraped_at: new Date().toISOString(),
                        source_url: this.baseUrl,
                        is_real_data: true
                    };
                    
                    if (property.address !== '주소 미상' && property.minimum_sale_price > 0) {
                        properties.push(property);
                        console.log(`✅ 실제 물건: ${property.case_number} - ${property.address}`);
                    }
                } catch (e) {
                    console.warn(`⚠️ 행 파싱 오류: ${e.message}`);
                }
            }
            
        } catch (error) {
            console.error('❌ 데이터 추출 중 오류:', error);
        }
        
        return properties;
    }

    parseCourtName(text) {
        if (!text) return '법원 미상';
        if (text.includes('서울')) return '서울중앙지방법원';
        if (text.includes('부산')) return '부산지방법원';
        if (text.includes('인천')) return '인천지방법원';
        if (text.includes('대구')) return '대구지방법원';
        if (text.includes('광주')) return '광주지방법원';
        if (text.includes('대전')) return '대전지방법원';
        return text.includes('법원') ? text : text + '지방법원';
    }

    parsePropertyType(text) {
        if (!text) return '기타';
        const types = ['아파트', '단독주택', '다세대주택', '오피스텔', '상가', '토지'];
        return types.find(type => text.includes(type)) || '기타';
    }

    parsePrice(text) {
        if (!text) return 0;
        const numbers = text.replace(/[^0-9,억만원]/g, '');
        
        if (numbers.includes('억')) {
            const match = numbers.match(/(\d+)억/);
            if (match) return parseInt(match[1]) * 100000000;
        }
        
        return parseInt(numbers.replace(/[^0-9]/g, '')) || 0;
    }

    parseDate(text) {
        if (!text) {
            const future = new Date();
            future.setDate(future.getDate() + 30);
            return future.toISOString().split('T')[0];
        }
        
        const match = text.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
        if (match) {
            const [, year, month, day] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        const future = new Date();
        future.setDate(future.getDate() + 30);
        return future.toISOString().split('T')[0];
    }

    async humanDelay(base, variance = 0) {
        const delay = base + (Math.random() * variance);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 고급 스크래퍼 종료');
        }
    }
}

module.exports = AdvancedScraper;