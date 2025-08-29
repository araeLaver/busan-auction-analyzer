const axios = require('axios');
const tough = require('tough-cookie');
const cheerio = require('cheerio');

/**
 * 패킷 분석으로 발견한 실제 법원경매정보 API 사용
 */
class RealApiScraper {
    constructor() {
        this.baseUrl = 'https://www.courtauction.go.kr';
        this.cookieJar = new tough.CookieJar();
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
                        'Cookie': 'WMONID=jCYXiWgaQNV; SID=; cortAuctnLgnMbr=; JSESSIONID=Gafzep6hQYvWJskN254oLUEAM8xaZNX7C91XgJaTz7U7-00p_ZFG!137493535'
                    },
                    timeout: 15000
                }
            );
            
            console.log(`✅ 경매물건 검색 응답: ${response.status}`);
            
            if (response.data) {
                // JSON 응답인 경우
                if (response.data.status === 200 && response.data.data) {
                    console.log('🎉 JSON 형태 실제 경매 물건 데이터 발견!');
                    return this.parseRealPropertyResponse(response.data);
                }
                // HTML 응답인 경우 (검색 결과 페이지)
                else if (typeof response.data === 'string' && response.data.includes('<')) {
                    console.log('🎉 HTML 형태 실제 경매 물건 데이터 발견!');
                    return this.parseRealHTMLResponse(response.data);
                }
            }
            
            console.log('⚠️ 경매 물건 데이터가 비어있거나 올바르지 않은 형식입니다.');
            return [];
            
        } catch (error) {
            console.error('❌ 실제 경매 물건 검색 실패:', error.message);
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
}

module.exports = RealApiScraper;