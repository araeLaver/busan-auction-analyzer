const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 실제 법원 경매 데이터 수집기
 * 
 * 주요 기능:
 * - 법원경매정보 사이트에서 실제 데이터 수집
 * - 부산 지역 특화 검색
 * - 안정적인 오류 처리
 */
class RealAuctionScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'https://www.courtauction.go.kr';
        this.data = [];
    }

    /**
     * 스크래퍼 초기화
     */
    async initialize() {
        try {
            console.log('🚀 실제 경매 데이터 수집기 초기화 중...');
            
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // User-Agent 설정
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // 뷰포트 설정
            await this.page.setViewport({ width: 1366, height: 768 });
            
            console.log('✅ 브라우저 초기화 완료');
            
        } catch (error) {
            console.error('❌ 스크래퍼 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 부산 경매 데이터 수집
     */
    async scrapeBusanAuctions(limit = 10) {
        try {
            console.log(`🔍 부산 경매 물건 검색 중... (최대 ${limit}개)`);
            
            // 법원경매정보 메인 페이지로 이동
            await this.page.goto(`${this.baseUrl}/ib/gd/w/sr/sr.html`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            console.log('📄 법원경매정보 사이트 접속 완료');
            
            // 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 부산 지역 검색 설정
            await this.setupBusanSearch();
            
            // 검색 실행
            await this.executeSearch();
            
            // 데이터 추출
            const properties = await this.extractPropertyData(limit);
            
            console.log(`✅ ${properties.length}개 부산 경매 물건 수집 완료`);
            return properties;
            
        } catch (error) {
            console.error('❌ 부산 경매 데이터 수집 실패:', error);
            
            // 스크린샷 저장 (디버깅용)
            if (this.page) {
                try {
                    await this.page.screenshot({ 
                        path: 'debug-error.png',
                        fullPage: true 
                    });
                    console.log('🖼️ 오류 스크린샷 저장: debug-error.png');
                } catch (e) {
                    console.warn('스크린샷 저장 실패:', e.message);
                }
            }
            
            throw error;
        }
    }

    /**
     * 부산 지역 검색 설정
     */
    async setupBusanSearch() {
        try {
            console.log('🏛️ 부산 지역 검색 조건 설정 중...');
            
            // 법원 선택 (부산지방법원)
            const courtSelector = 'select[name="idJwonNm"]';
            await this.page.waitForSelector(courtSelector, { timeout: 10000 });
            await this.page.select(courtSelector, '340000'); // 부산지방법원 코드
            
            console.log('✅ 부산지방법원 선택 완료');
            
            // 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.warn('⚠️ 검색 조건 설정 중 오류:', error.message);
            // 계속 진행
        }
    }

    /**
     * 검색 실행
     */
    async executeSearch() {
        try {
            console.log('🔍 검색 실행 중...');
            
            // 검색 버튼 클릭
            const searchButton = 'input[type="submit"][value="검색"]';
            await this.page.waitForSelector(searchButton, { timeout: 5000 });
            await this.page.click(searchButton);
            
            // 검색 결과 로딩 대기
            await this.page.waitForNavigation({ 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            console.log('✅ 검색 완료');
            
        } catch (error) {
            console.warn('⚠️ 검색 실행 중 오류:', error.message);
            // 페이지가 이미 로드되었을 수 있으므로 계속 진행
        }
    }

    /**
     * 물건 데이터 추출
     */
    async extractPropertyData(limit) {
        const properties = [];
        
        try {
            console.log('📊 경매 물건 데이터 추출 중...');
            
            // 결과 테이블 대기
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 페이지 HTML 가져오기
            const html = await this.page.content();
            const $ = cheerio.load(html);
            
            // 경매 물건 목록 테이블 찾기
            const rows = $('table tbody tr');
            console.log(`📋 발견된 행 수: ${rows.length}`);
            
            rows.each((index, row) => {
                if (properties.length >= limit) return false;
                
                try {
                    const $row = $(row);
                    const cells = $row.find('td');
                    
                    if (cells.length < 5) return; // 데이터가 부족한 행 스킵
                    
                    // 데이터 추출
                    const property = {
                        id: Date.now() + Math.random(), // 임시 ID
                        case_number: this.extractText(cells.eq(0)),
                        court_name: '부산지방법원',
                        property_type: this.extractText(cells.eq(1)),
                        address: this.extractText(cells.eq(2)),
                        appraisal_value: this.extractPrice(cells.eq(3)),
                        minimum_sale_price: this.extractPrice(cells.eq(4)),
                        auction_date: this.extractDate(cells.eq(5)),
                        current_status: 'active',
                        scraped_at: new Date().toISOString(),
                        source_url: this.baseUrl
                    };
                    
                    // 기본값 설정
                    property.bid_deposit = Math.floor(property.minimum_sale_price * 0.1);
                    property.discount_rate = Math.round((1 - property.minimum_sale_price / property.appraisal_value) * 100);
                    property.investment_score = Math.max(30, Math.min(95, 70 + Math.random() * 20));
                    
                    // 유효한 데이터만 추가
                    if (property.case_number && property.address && property.minimum_sale_price > 0) {
                        properties.push(property);
                        console.log(`✅ 물건 추출: ${property.case_number} - ${property.address}`);
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ 행 ${index} 처리 중 오류:`, error.message);
                }
            });
            
            if (properties.length === 0) {
                console.log('⚠️ 추출된 데이터가 없습니다. 페이지 구조를 확인합니다.');
                
                // 디버깅을 위한 페이지 정보 출력
                const title = await this.page.title();
                console.log('📄 현재 페이지 제목:', title);
                
                // 주요 선택자들 확인
                const tableExists = await this.page.$('table') !== null;
                console.log('📊 테이블 존재 여부:', tableExists);
            }
            
        } catch (error) {
            console.error('❌ 데이터 추출 실패:', error);
        }
        
        return properties;
    }

    /**
     * 텍스트 추출 및 정제
     */
    extractText(element) {
        return element.text().trim().replace(/\s+/g, ' ');
    }

    /**
     * 가격 정보 추출 (원 단위)
     */
    extractPrice(element) {
        const text = this.extractText(element);
        const numbers = text.replace(/[^\d]/g, '');
        return numbers ? parseInt(numbers) : 0;
    }

    /**
     * 날짜 정보 추출
     */
    extractDate(element) {
        const text = this.extractText(element);
        // 날짜 형식을 표준화
        const dateMatch = text.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return null;
    }

    /**
     * 스크린샷 저장
     */
    async saveScreenshot(filename = 'debug.png') {
        if (this.page) {
            await this.page.screenshot({ 
                path: filename,
                fullPage: true 
            });
            console.log(`🖼️ 스크린샷 저장: ${filename}`);
        }
    }

    /**
     * 리소스 정리
     */
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log('🧹 브라우저 리소스 정리 완료');
            }
        } catch (error) {
            console.warn('⚠️ 리소스 정리 중 오류:', error.message);
        }
    }
}

module.exports = RealAuctionScraper;