const axios = require('axios');
const tough = require('tough-cookie');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer'); // puppeteer 추가
require('dotenv').config(); // Load environment variables
const pool = require('../../config/database'); // Database connection pool

/**
 * 패킷 분석으로 발견한 실제 법원경매정보 API 사용
 */
class RealApiScraper {
    constructor() {
        this.baseUrl = 'https://www.courtauction.go.kr';
        this.cookieJar = new tough.CookieJar(); // axios-cookiejar-support와 함께 사용될 수 있지만, 여기서는 수동 관리
        this.sessionCookies = ''; // 세션 쿠키를 저장할 변수
        this.sessionStart = Date.now(); // 스크래핑 시간 기록
        this.sessionHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.courtauction.go.kr/',
            'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
        };
    }

    /**
     * Puppeteer를 사용하여 초기 세션 쿠키를 가져옵니다.
     * 이를 통해 웹사이트의 CSRF 토큰이나 세션 관련 쿠키를 획득하여
     * 이후 axios 요청에 사용할 수 있게 합니다.
     */
    async initSession() {
        let browser;
        try {
            console.log('🚀 초기 세션 쿠키 획득을 위해 브라우저 시작...');
            browser = await puppeteer.launch({
                headless: true, // 백그라운드에서 실행
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-web-security'
                ]
            });
            const page = await browser.newPage();
            
            // 고급 탐지 방지 스크립트 적용 (AdvancedCourtAuctionScraper.js에서 가져온 헬퍼 필요)
            // 여기서는 간단하게 User-Agent만 설정
            await page.setUserAgent(this.sessionHeaders['User-Agent']);

            await page.goto(this.baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // 쿠키 획득
            const cookies = await page.cookies();
            this.sessionCookies = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            console.log(`✅ 세션 쿠키 획득 완료: ${this.sessionCookies.substring(0, 100)}...`);

        } catch (error) {
            console.error('❌ 초기 세션 쿠키 획득 실패:', error.message);
            // 오류 발생 시 재시도 로직 또는 경고 처리
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 브라우저 종료');
            }
        }
    }

    /**
     * 실제 법원 목록 조회
     */
    async getCourts() {
        try {
            console.log('🏛️ 실제 법원 목록 조회...');
            
            const response = await axios.post(
                `${this.baseUrl}/pgj/pgj002/selectCortOfcLst.on`,
                'mulSlctTp=B', // 부동산 타입
                {
                    headers: this.sessionHeaders,
                    timeout: 10000
                }
            );
            
            console.log('✅ 법원 목록 조회 성공');
            
            if (response.data?.data?.cortOfcLst) {
                const courts = response.data.data.cortOfcLst;
                console.log(`📋 발견된 법원 수: ${courts.length}`);
                
                courts.slice(0, 5).forEach(court => {
                    console.log(`   - ${court.name} (${court.code})`);
                });
                
                return courts;
            }
            
            return [];
            
        } catch (error) {
            console.error('❌ 법원 목록 조회 실패:', error.message);
            return [];
        }
    }

    /**
     * 실제 지역 목록 조회
     */
    async getRegions() {
        try {
            console.log('🗺️ 실제 지역 목록 조회...');
            
            const response = await axios.post(
                `${this.baseUrl}/pgj/pgj002/selectAdongSdLst.on`,
                '',
                {
                    headers: this.sessionHeaders,
                    timeout: 10000
                }
            );
            
            console.log('✅ 지역 목록 조회 성공');
            
            if (response.data?.data?.adongSdLst) {
                const regions = response.data.data.adongSdLst;
                console.log(`📋 발견된 지역 수: ${regions.length}`);
                
                regions.slice(0, 5).forEach(region => {
                    console.log(`   - ${region.name} (${region.code})`);
                });
                
                return regions;
            }
            
            return [];
            
        } catch (error) {
            console.error('❌ 지역 목록 조회 실패:', error.message);
            return [];
        }
    }

    /**
     * 실제 경매 물건 검색 - 패킷 분석으로 발견한 실제 API 사용
     */
    async searchProperties(searchParams = {}) {
        const logId = await this.logScrapingStart('courtauction_api');
        const stats = { totalFound: 0, newItems: 0, updatedItems: 0, errorCount: 0 };

        try {
            console.log('🔍 실제 경매 물건 검색 중...');
            
            // 실제 경매물건 검색 API 엔드포인트
            const searchEndpoint = '/pgj/pgj003/selectRealEstMulSrchLst.on';
            
            // 기본 검색 파라미터 
            const defaultParams = {
                'pageIndex': '1',
                'pageUnit': '20',
                'mulSlctTp': 'R', // 부동산
                'realVowelChk': '2', // 실제 경매
                'sdCtcd': '26', // 부산광역시 코드
                'cortOfcCd': '', // 법원 코드 (전체)
                'mulSlctTp': 'R',
                'realVowelChk': '1',
                'lotNo': '',
                'saYear': '',
                'nbrYear': '',
                'hmnnYear': '',
                'yearCd': '',
                'monthCd': '',
                'dayCd': '',
                'utiNm': '',
                'rdnmAddr': '',
                'rdnmAddress': '',
                'sdNm': '부산광역시',
                'caseNo': '',
                'srchCaseNoRad': '',
                'fromApprslAmt': '',
                'toApprslAmt': '',
                'fromMinSelngAmt': '',
                'toMinSelngAmt': '',
                'fromSqmtAmt': '',
                'toSqmtAmt': ''
            };
            
            // 검색 파라미터 병합
            const finalParams = { ...defaultParams, ...searchParams };
            const searchData = new URLSearchParams(finalParams).toString();
            
            console.log('📊 검색 파라미터:', finalParams);
            
            const response = await axios.post(
                `${this.baseUrl}${searchEndpoint}`,
                searchData,
                {
                    headers: {
                        ...this.sessionHeaders,
                        'Cookie': this.sessionCookies // 동적으로 획득한 세션 쿠키 사용
                    },
                    timeout: 15000
                }
            );
            
            console.log(`✅ 경매물건 검색 응답: ${response.status}`);
            
            let properties = [];
            if (response.data) {
                // JSON 응답인 경우
                if (response.data.status === 200 && response.data.data) {
                    console.log('🎉 JSON 형태 실제 경매 물건 데이터 발견!');
                    properties = this.parseRealPropertyResponse(response.data);
                }
                // HTML 응답인 경우 (검색 결과 페이지)
                else if (typeof response.data === 'string' && response.data.includes('<')) {
                    console.log('🎉 HTML 형태 실제 경매 물건 데이터 발견!');
                    properties = this.parseRealHTMLResponse(response.data);
                }
            }
            stats.totalFound = properties.length;

            // 각 물건을 데이터베이스에 저장
            for (const property of properties) {
                try {
                    const saved = await this.saveProperty(property);
                    if (saved.isNew) {
                        stats.newItems++;
                    } else {
                        stats.updatedItems++;
                    }
                } catch (saveError) {
                    stats.errorCount++;
                    console.error(`❌ 물건 저장 오류 (${property.case_number}):`, saveError.message);
                }
            }
            await this.logScrapingEnd(logId, stats);
            console.log(`✅ Real API 스크래핑 완료: 신규 ${stats.newItems}개, 업데이트 ${stats.updatedItems}개, 오류 ${stats.errorCount}개`);
            return properties;
            
        } catch (error) {
            console.error('❌ 실제 경매 물건 검색 실패:', error.message);
            await this.logScrapingEnd(logId, stats, error);
            return [];
        }
    }

    parsePropertyResponse(data) {
        const properties = [];
        
        // 다양한 응답 구조에 대응
        let items = data.data?.list || data.data?.items || data.list || data.items || [];
        
        if (!Array.isArray(items)) {
            items = [items];
        }
        
        for (const item of items) {
            try {
                const property = {
                    case_number: item.caseNo || item.sagunNo || item.case_number,
                    court_name: item.courtNm || item.court_name,
                    property_type: this.parsePropertyType(item.mulType || item.property_type),
                    address: item.addr || item.address,
                    appraisal_value: parseInt(item.gamjeongAmt || item.appraisal_value) || 0,
                    minimum_sale_price: parseInt(item.minSaleAmt || item.minimum_sale_price) || 0,
                    auction_date: item.biddingDate || item.auction_date,
                    current_status: 'active',
                    source_url: this.baseUrl,
                    scraped_at: new Date().toISOString(),
                    is_real_data: true
                };
                
                if (property.case_number && property.address) {
                    properties.push(property);
                    console.log(`✅ 실제 물건: ${property.case_number} - ${property.address}`);
                }
                
            } catch (error) {
                console.warn('⚠️ 물건 파싱 오류:', error.message);
            }
        }
        
        return properties;
    }

    parseHTMLResponse(html) {
        const properties = [];
        const $ = cheerio.load(html);
        
        try {
            console.log('📋 HTML에서 경매 물건 데이터 추출 중...');
            
            // 테이블 형태의 경매 물건 목록 찾기
            const tableRows = $('table tbody tr, .list-table tr, .data-table tr').filter((index, element) => {
                const text = $(element).text();
                return text.includes('타경') || text.includes('물건') || text.includes('경매');
            });
            
            console.log(`📊 발견된 테이블 행 수: ${tableRows.length}`);
            
            tableRows.each((index, row) => {
                const $row = $(row);
                const cells = $row.find('td');
                
                if (cells.length >= 5) {
                    try {
                        const property = {
                            case_number: this.extractText(cells.eq(0)) || `REAL-${Date.now()}-${index}`,
                            court_name: this.extractCourtName(this.extractText(cells.eq(1))),
                            property_type: this.parsePropertyType(this.extractText(cells.eq(2))),
                            address: this.extractText(cells.eq(3)),
                            appraisal_value: this.extractPrice(this.extractText(cells.eq(4))),
                            minimum_sale_price: this.extractPrice(this.extractText(cells.eq(5))),
                            auction_date: this.extractDate(this.extractText(cells.eq(6))),
                            current_status: 'active',
                            source_url: this.baseUrl,
                            scraped_at: new Date().toISOString(),
                            is_real_data: true
                        };
                        
                        // 유효한 데이터만 추가
                        if (property.address && property.address.length > 5 && property.minimum_sale_price > 0) {
                            properties.push(property);
                            console.log(`✅ 실제 물건: ${property.case_number} - ${property.address}`);
                        }
                        
                    } catch (error) {
                        console.warn(`⚠️ 행 ${index} 파싱 오류:`, error.message);
                    }
                }
            });
            
            // 다른 구조도 시도 (div, li 등)
            if (properties.length === 0) {
                console.log('📋 다른 HTML 구조에서 데이터 추출 시도...');
                
                const items = $('.item, .property-item, .auction-item, .mul-item');
                items.each((index, item) => {
                    const $item = $(item);
                    const text = $item.text();
                    
                    if (text.includes('타경') || text.includes('경매')) {
                        // 여기서 다른 구조의 데이터 추출 로직 구현
                        console.log(`📋 아이템 발견: ${text.substring(0, 100)}...`);
                    }
                });
            }
            
        } catch (error) {
            console.error('❌ HTML 파싱 오류:', error);
        }
        
        return properties;
    }

    extractText(element) {
        return element.text().trim().replace(/\s+/g, ' ');
    }

    extractCourtName(text) {
        if (!text) return '법원 미상';
        if (text.includes('서울')) return '서울중앙지방법원';
        if (text.includes('부산')) return '부산지방법원';
        if (text.includes('인천')) return '인천지방법원';
        if (text.includes('대구')) return '대구지방법원';
        return text.includes('법원') ? text : text + '지방법원';
    }

    extractPrice(text) {
        if (!text) return 0;
        const numbers = text.replace(/[^0-9,억만원]/g, '');
        
        if (numbers.includes('억')) {
            const match = numbers.match(/(\d+)억/);
            if (match) return parseInt(match[1]) * 100000000;
        }
        
        return parseInt(numbers.replace(/[^0-9]/g, '')) || 0;
    }

    extractDate(text) {
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

    parsePropertyType(type) {
        const typeMap = {
            '아파트': '아파트',
            '단독': '단독주택',
            '다세대': '다세대주택', 
            '오피스텔': '오피스텔',
            '상가': '상가',
            '토지': '토지'
        };
        
        for (const [key, value] of Object.entries(typeMap)) {
            if (type && type.includes(key)) {
                return value;
            }
        }
        
        return '기타';
    }

    /**
     * 실제 경매 물건 JSON 응답 파싱
     */
    parseRealPropertyResponse(data) {
        const properties = [];
        
        try {
            if (data.data && data.data.realEstMulSrchLst) {
                const items = data.data.realEstMulSrchLst;
                
                for (const item of items) {
                    const property = {
                        case_number: item.caseNo || item.saYear + item.saNo || `REAL-${Date.now()}-${Math.random()}`,
                        item_number: item.cltrMngNo?.[0] || '1', // API 응답에서 물건번호 추출, 없으면 '1'로 기본값
                        court_name: this.extractCourtName(item.cortOfcNm || item.cortNm || ''),
                        property_type: this.parsePropertyType(item.mulNm || item.mulClsfc || ''),
                        address: item.toAddr || item.addr || item.rdnmAddr || '',
                        appraisal_value: this.parseAmount(item.apprslAmt || item.gamjeongAmt || '0'),
                        minimum_sale_price: this.parseAmount(item.minSelngAmt || item.minSaleAmt || '0'),
                        auction_date: this.formatDate(item.biddingDt || item.saleDate || ''),
                        current_status: 'active',
                        source_url: this.baseUrl,
                        scraped_at: new Date().toISOString(),
                        is_real_data: true,
                        details: {
                            building_area: item.bldgArea || '',
                            land_area: item.landArea || '',
                            floors: item.floorInfo || '',
                            year_built: item.builtYear || '',
                            usage: item.usage || '',
                            deposit_amount: this.parseAmount(item.depositAmt || '0')
                        }
                    };
                    
                    if (property.case_number && property.address && property.minimum_sale_price > 0) {
                        properties.push(property);
                        console.log(`✅ 실제 경매물건: ${property.case_number} - ${property.address}`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ 실제 경매물건 JSON 파싱 오류:', error.message);
        }
        
        return properties;
    }

    /**
     * 실제 경매 물건 HTML 응답 파싱 (개선된 버전)
     */
    parseRealHTMLResponse(html) {
        const properties = [];
        const $ = cheerio.load(html);
        
        try {
            console.log('📋 실제 경매물건 HTML에서 데이터 추출 중...');
            
            // 다양한 테이블 구조 시도
            const tableSelectors = [
                'table.tbl_list tbody tr',
                'table.list-table tbody tr',
                '.grid-content .grid-row',
                '.result-list .item',
                'tbody tr',
                '.auction-item'
            ];
            
            let foundItems = false;
            
            for (const selector of tableSelectors) {
                const rows = $(selector);
                
                if (rows.length > 0) {
                    console.log(`📊 발견된 ${selector} 행 수: ${rows.length}`);
                    foundItems = true;
                    
                    rows.each((index, row) => {
                        const $row = $(row);
                        const cells = $row.find('td');
                        
                        if (cells.length >= 4) { // 최소 4개 컬럼 필요
                            try {
                                // 셀 데이터 추출
                                const caseInfo = this.extractText(cells.eq(0)) || this.extractText(cells.eq(1));
                                const courtInfo = this.extractText(cells.eq(1)) || this.extractText(cells.eq(2));
                                const propertyInfo = this.extractText(cells.eq(2)) || this.extractText(cells.eq(3));
                                const addressInfo = this.extractText(cells.eq(3)) || this.extractText(cells.eq(4));
                                const appraisalInfo = this.extractText(cells.eq(4)) || this.extractText(cells.eq(5));
                                const minSaleInfo = this.extractText(cells.eq(5)) || this.extractText(cells.eq(6));
                                const dateInfo = this.extractText(cells.eq(6)) || this.extractText(cells.eq(7));
                                
                                const property = {
                                    case_number: this.extractCaseNumber(caseInfo) || `REAL-HTML-${Date.now()}-${index}`,
                                    item_number: '1', // HTML 파싱에서 물건번호를 명확히 식별하기 어려워 기본값 '1'로 설정
                                    court_name: this.extractCourtName(courtInfo),
                                    property_type: this.parsePropertyType(propertyInfo),
                                    address: this.cleanAddress(addressInfo),
                                    appraisal_value: this.parseAmount(appraisalInfo),
                                    minimum_sale_price: this.parseAmount(minSaleInfo),
                                    auction_date: this.formatDate(dateInfo),
                                    current_status: 'active',
                                    source_url: this.baseUrl,
                                    scraped_at: new Date().toISOString(),
                                    is_real_data: true
                                };
                                
                                // 유효한 데이터만 추가
                                if (property.address && property.address.length > 5 && 
                                    property.minimum_sale_price > 0) {
                                    properties.push(property);
                                    console.log(`✅ HTML 경매물건: ${property.case_number} - ${property.address}`);
                                }
                                
                            } catch (error) {
                                console.warn(`⚠️ HTML 행 ${index} 파싱 오류:`, error.message);
                            }
                        }
                    });
                    
                    if (properties.length > 0) break; // 데이터를 찾으면 중단
                }
            }
            
            if (!foundItems) {
                console.log('❌ HTML에서 경매물건 테이블을 찾을 수 없습니다.');
                // HTML 구조 분석을 위한 디버그 정보
                console.log('📋 HTML 구조 분석:');
                console.log(`- 전체 테이블 수: ${$('table').length}`);
                console.log(`- tbody 수: ${$('tbody').length}`);
                console.log(`- tr 수: ${$('tr').length}`);
                
                // 내용이 있는 테이블 찾기
                $('table').each((index, table) => {
                    const $table = $(table);
                    const rows = $table.find('tr');
                    if (rows.length > 1) {
                        console.log(`테이블 ${index + 1}: ${rows.length}개 행`);
                        const firstRowText = rows.first().text().trim();
                        if (firstRowText.length > 10) {
                            console.log(`  첫 행: ${firstRowText.substring(0, 100)}...`);
                        }
                    }
                });
            }
            
        } catch (error) {
            console.error('❌ 실제 경매물건 HTML 파싱 오류:', error.message);
        }
        
        return properties;
    }

    /**
     * 사건번호 추출
     */
    extractCaseNumber(text) {
        if (!text) return null;
        
        // 한국 법원 사건번호 패턴 (예: 2024타경12345)
        const casePattern = /(\d{4}타경\d+|\d{4}타\d+|\d{4}-\d+)/;
        const match = text.match(casePattern);
        return match ? match[1] : text.trim();
    }

    /**
     * 주소 정보 정제
     */
    cleanAddress(text) {
        if (!text) return '';
        
        return text
            .replace(/^\s*주소\s*:?\s*/, '')  // '주소:' 접두사 제거
            .replace(/\s+/g, ' ')            // 여러 공백을 하나로
            .trim();
    }

    /**
     * 금액 파싱 개선
     */
    parseAmount(text) {
        if (!text) return 0;
        
        // 숫자와 한글 단위만 추출
        const cleanText = text.replace(/[^\d억만원,]/g, '');
        
        let amount = 0;
        
        // 억 단위 처리
        if (cleanText.includes('억')) {
            const eokMatch = cleanText.match(/(\d+)억/);
            if (eokMatch) {
                amount += parseInt(eokMatch[1]) * 100000000;
            }
        }
        
        // 만 단위 처리
        if (cleanText.includes('만')) {
            const manMatch = cleanText.match(/(\d+)만/);
            if (manMatch) {
                amount += parseInt(manMatch[1]) * 10000;
            }
        }
        
        // 단순 숫자 처리
        if (amount === 0) {
            const numberMatch = cleanText.replace(/[,원]/g, '').match(/\d+/);
            if (numberMatch) {
                amount = parseInt(numberMatch[0]);
            }
        }
        
        return amount;
    }

    /**
     * 날짜 형식 통일
     */
    formatDate(text) {
        if (!text) {
            const future = new Date();
            future.setDate(future.getDate() + 30);
            return future.toISOString().split('T')[0];
        }
        
        // 다양한 날짜 형식 지원
        const datePatterns = [
            /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/,  // YYYY-MM-DD, YYYY.MM.DD
            /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,  // YYYY년 MM월 DD일
            /(\d{2})[.-](\d{1,2})[.-](\d{1,2})/   // YY-MM-DD
        ];
        
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                let [, year, month, day] = match;
                
                // 2자리 연도를 4자리로 변환
                if (year.length === 2) {
                    year = '20' + year;
                }
                
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }
        
        // 기본값: 30일 후
        const future = new Date();
        future.setDate(future.getDate() + 30);
        return future.toISOString().split('T')[0];
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
            
            // 법원 ID 조회 (court_name을 기반으로)
            let courtId = null;
            if (property.court_name) {
                const courtResult = await client.query(
                    'SELECT id FROM analyzer.courts WHERE name LIKE $1', // analyzer 스키마 명시
                    [`%${property.court_name.replace('지방법원', '')}%`]
                );
                courtId = courtResult.rows[0]?.id || null;
            }

            const itemNumber = property.item_number || '1'; // item_number를 property에서 가져오거나 기본값 '1' 설정
            
            // 기존 데이터 확인: case_number, item_number, source_site를 유니크 키로 사용
            const existingResult = await client.query(
                'SELECT id FROM analyzer.properties WHERE case_number = $1 AND item_number = $2 AND source_site = $3', // analyzer 스키마 명시
                [property.case_number, itemNumber, property.source_url]
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
                        current_status = $7,
                        last_scraped_at = NOW(),
                        updated_at = NOW(),
                        details = $8
                    WHERE case_number = $9 AND item_number = $10 AND source_site = $11
                `;
                
                await client.query(updateQuery, [
                    property.address,
                    property.property_type,
                    property.building_name,
                    property.appraisal_value,
                    property.minimum_sale_price,
                    property.auction_date,
                    property.current_status,
                    property.details, // details 필드 업데이트
                    property.case_number,
                    itemNumber,
                    property.source_url
                ]);
                
            } else {
                // 신규 삽입
                const insertQuery = `
                    INSERT INTO analyzer.properties (
                        case_number, item_number, court_id, address, property_type, building_name,
                        appraisal_value, minimum_sale_price, auction_date,
                        current_status, source_site, source_url, last_scraped_at, details
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
                `;
                
                await client.query(insertQuery, [
                    property.case_number,
                    itemNumber,
                    courtId,
                    property.address,
                    property.property_type,
                    property.building_name,
                    property.appraisal_value,
                    property.minimum_sale_price,
                    property.auction_date,
                    property.current_status,
                    property.source_url,
                    property.source_url,
                    property.details // details 필드 저장
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

module.exports = RealApiScraper;