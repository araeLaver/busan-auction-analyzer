const puppeteer = require('puppeteer');
const axios = require('axios');

/**
 * 패킷 분석을 통한 실제 API 호출 스크래퍼
 */
class PacketScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.interceptedRequests = [];
        this.apiCalls = [];
    }

    async initialize() {
        try {
            console.log('📡 패킷 분석 스크래퍼 초기화 중...');
            
            this.browser = await puppeteer.launch({
                headless: false, // 실제 브라우저로 패킷 확인
                devtools: true,  // 개발자도구 열기
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // 모든 네트워크 요청 인터셉트
            await this.page.setRequestInterception(true);
            
            this.page.on('request', (request) => {
                // 모든 요청 로깅
                console.log(`🌐 요청: ${request.method()} ${request.url()}`);
                
                this.interceptedRequests.push({
                    method: request.method(),
                    url: request.url(),
                    headers: request.headers(),
                    postData: request.postData(),
                    timestamp: new Date()
                });
                
                request.continue();
            });
            
            this.page.on('response', async (response) => {
                const url = response.url();
                
                // API 응답으로 보이는 것들 필터링
                if (url.includes('/api/') || 
                    url.includes('.json') || 
                    url.includes('ajax') ||
                    url.includes('service') ||
                    response.headers()['content-type']?.includes('application/json')) {
                    
                    console.log(`📨 응답: ${response.status()} ${url}`);
                    
                    try {
                        const responseBody = await response.text();
                        
                        this.apiCalls.push({
                            url: url,
                            method: response.request().method(),
                            status: response.status(),
                            headers: response.headers(),
                            body: responseBody.substring(0, 1000), // 처음 1000자만
                            timestamp: new Date()
                        });
                        
                        console.log(`📊 응답 데이터: ${responseBody.substring(0, 200)}...`);
                        
                    } catch (e) {
                        console.log('⚠️ 응답 본문 읽기 실패:', e.message);
                    }
                }
            });
            
            console.log('✅ 패킷 인터셉터 설정 완료');
            
        } catch (error) {
            console.error('❌ 패킷 스크래퍼 초기화 실패:', error);
            throw error;
        }
    }

    async analyzeCourtAuctionAPI() {
        try {
            console.log('🔍 법원경매정보 API 분석 시작...');
            
            // 1단계: 메인 페이지 접속하여 패킷 분석
            console.log('📄 메인 페이지 접속 중...');
            await this.page.goto('https://www.courtauction.go.kr', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 2단계: 물건검색 페이지로 이동
            console.log('🔍 물건검색 페이지 이동...');
            
            try {
                // 부동산 메뉴 클릭 시도
                await this.page.click('a[href*="mulgeon"], a[href*="search"], .menu a');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.log('⚠️ 메뉴 클릭 실패, URL 직접 접근 시도');
                
                // 직접 검색 URL들 시도
                const searchUrls = [
                    'https://www.courtauction.go.kr/InitMulSrch.laf',
                    'https://www.courtauction.go.kr/RetrieveRealEstMulSrchInfo.laf',
                    'https://www.courtauction.go.kr/srch/srch.jsp'
                ];
                
                for (const url of searchUrls) {
                    try {
                        console.log(`📋 시도: ${url}`);
                        await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        break;
                    } catch (e) {
                        console.log(`❌ ${url} 접근 실패`);
                    }
                }
            }
            
            // 3단계: 검색 실행하여 API 호출 패킷 캡처
            console.log('🔍 검색 실행하여 API 패킷 캡처...');
            
            try {
                // 검색 버튼 찾아서 클릭
                const searchSelectors = [
                    'input[type="submit"][value*="검색"]',
                    'button[onclick*="search"]',
                    '.search-btn',
                    '#searchBtn'
                ];
                
                for (const selector of searchSelectors) {
                    try {
                        await this.page.click(selector);
                        console.log(`✅ 검색 버튼 클릭: ${selector}`);
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                
                // 검색 결과 로딩 대기
                await new Promise(resolve => setTimeout(resolve, 5000));
                
            } catch (e) {
                console.log('⚠️ 검색 버튼 클릭 실패, JavaScript로 시도');
                
                // JavaScript로 직접 검색 실행
                await this.page.evaluate(() => {
                    // 일반적인 검색 함수들 시도
                    if (typeof search === 'function') search();
                    if (typeof doSearch === 'function') doSearch();
                    if (typeof submitSearch === 'function') submitSearch();
                });
                
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // 4단계: 캡처된 API 호출 분석
            console.log('\n📊 캡처된 API 호출 분석:');
            console.log(`총 ${this.apiCalls.length}개 API 호출 발견`);
            
            const relevantAPIs = this.apiCalls.filter(api => 
                api.url.includes('mulgeon') || 
                api.url.includes('auction') ||
                api.url.includes('list') ||
                api.body.includes('사건번호') ||
                api.body.includes('물건')
            );
            
            console.log(`\n🎯 경매 관련 API ${relevantAPIs.length}개:`);
            
            for (const api of relevantAPIs) {
                console.log(`\n🔗 API: ${api.url}`);
                console.log(`📋 메소드: ${api.method}`);
                console.log(`📊 응답: ${api.body.substring(0, 300)}...`);
            }
            
            // 5단계: 발견된 API로 데이터 직접 요청
            if (relevantAPIs.length > 0) {
                console.log('\n🚀 발견된 API로 실제 데이터 요청...');
                return await this.callDiscoveredAPIs(relevantAPIs);
            } else {
                console.log('❌ 경매 데이터 API를 찾지 못했습니다.');
                return [];
            }
            
        } catch (error) {
            console.error('❌ API 분석 실패:', error);
            return [];
        }
    }

    async callDiscoveredAPIs(apis) {
        const properties = [];
        
        for (const api of apis) {
            try {
                console.log(`📡 API 호출: ${api.url}`);
                
                // 원본 요청과 동일한 헤더 사용
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.courtauction.go.kr',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    ...api.headers
                };
                
                const response = await axios({
                    method: api.method || 'GET',
                    url: api.url,
                    headers: headers,
                    timeout: 10000
                });
                
                console.log(`✅ API 응답 성공: ${response.status}`);
                
                // 응답 데이터 파싱
                const parsedData = this.parseAPIResponse(response.data);
                properties.push(...parsedData);
                
            } catch (error) {
                console.error(`❌ API 호출 실패: ${api.url}`, error.message);
            }
        }
        
        return properties;
    }

    parseAPIResponse(data) {
        const properties = [];
        
        try {
            // JSON 응답인 경우
            if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
                const jsonData = JSON.parse(data);
                // JSON 구조에서 경매 물건 데이터 추출
                // 이 부분은 실제 API 응답 구조에 따라 조정 필요
                console.log('📊 JSON 데이터 구조:', Object.keys(jsonData));
            }
            
            // HTML 응답인 경우 테이블 파싱
            if (data.includes('<table') && data.includes('물건')) {
                console.log('📋 HTML 테이블에서 데이터 추출 시도...');
                // 여기서 cheerio로 HTML 파싱하여 테이블 데이터 추출
            }
            
        } catch (error) {
            console.error('❌ 응답 파싱 실패:', error.message);
        }
        
        return properties;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('📡 패킷 분석 완료');
        }
    }

    // 캡처된 요청들을 파일로 저장
    async saveRequests() {
        const fs = require('fs').promises;
        
        await fs.writeFile(
            'captured-requests.json', 
            JSON.stringify({
                requests: this.interceptedRequests,
                apiCalls: this.apiCalls,
                timestamp: new Date()
            }, null, 2)
        );
        
        console.log('💾 캡처된 요청을 captured-requests.json에 저장했습니다.');
    }
}

module.exports = PacketScraper;