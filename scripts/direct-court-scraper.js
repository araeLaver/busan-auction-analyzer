#!/usr/bin/env node

const puppeteer = require('puppeteer');
const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 직접 URL 접근 법원경매 크롤러
 * 정확한 다수조회물건 URL로 바로 접근하여 전체 데이터 수집
 */
class DirectCourtScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.totalCollected = 0;
    }

    async init() {
        console.log('🚀 직접 URL 접근 법원경매 크롤러 시작');
        
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--start-maximized',
                '--disable-dev-shm-usage'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    async scrapeMultipleViewPage() {
        console.log('🎯 다수조회물건 페이지 직접 접근...');
        
        const url = 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ155M00.xml&pgmDvsNum=1';
        
        try {
            console.log(`📄 페이지 이동: ${url}`);
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✅ 다수조회물건 페이지 접근 완료');

            // 전체 선택 및 검색
            await this.selectAllAndSearch();
            
            // 모든 페이지 데이터 수집
            const allData = await this.scrapeAllPages();
            
            return allData;

        } catch (error) {
            console.error('다수조회물건 페이지 접근 실패:', error.message);
            throw error;
        }
    }

    async selectAllAndSearch() {
        console.log('⚙️ 전체 선택 및 검색 실행...');
        
        try {
            // 페이지가 완전히 로드될 때까지 대기
            await this.page.waitForSelector('body', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 모든 select 요소를 전체로 설정
            await this.page.evaluate(() => {
                console.log('전체 선택 설정 시작...');
                
                // 모든 select 요소 찾기
                const selects = document.querySelectorAll('select');
                console.log(`총 ${selects.length}개 select 요소 발견`);
                
                selects.forEach((select, index) => {
                    console.log(`Select ${index}: ${select.name || select.id || 'unknown'}`);
                    
                    // 첫 번째 옵션 선택 (보통 전체)
                    if (select.options && select.options.length > 0) {
                        // "전체" 또는 빈 값 옵션 찾기
                        for (let i = 0; i < select.options.length; i++) {
                            const option = select.options[i];
                            if (option.text.includes('전체') || 
                                option.text.includes('전국') || 
                                option.value === '' || 
                                i === 0) {
                                select.selectedIndex = i;
                                console.log(`Select ${index} 설정: ${option.text}`);
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                                break;
                            }
                        }
                    }
                });

                // 특정 필드들 확인 및 설정
                const regionSelect = document.querySelector('select[name*="region"], select[name*="court"], select[name*="sido"]');
                if (regionSelect) {
                    console.log('지역 선택 요소 발견');
                    regionSelect.selectedIndex = 0;
                    regionSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // 라디오 버튼이 있다면 전체 선택
                const radioButtons = document.querySelectorAll('input[type="radio"]');
                radioButtons.forEach(radio => {
                    if (radio.value === '' || radio.value === '전체') {
                        radio.checked = true;
                    }
                });

                console.log('전체 선택 설정 완료');
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // 검색 버튼 클릭
            console.log('🔍 검색 버튼 클릭 시도...');
            
            const searchResult = await this.page.evaluate(() => {
                console.log('검색 버튼 찾는 중...');
                
                // 다양한 검색 버튼 패턴
                const searchSelectors = [
                    'input[type="submit"][value*="검색"]',
                    'input[type="button"][value*="검색"]', 
                    'input[type="submit"][value*="조회"]',
                    'input[type="button"][value*="조회"]',
                    'button[type="submit"]',
                    'img[alt*="검색"]',
                    'img[alt*="조회"]',
                    '[onclick*="search"]',
                    '[onclick*="Search"]',
                    '.btn_search',
                    '#searchBtn',
                    '.search-btn'
                ];

                for (const selector of searchSelectors) {
                    const elements = document.querySelectorAll(selector);
                    console.log(`${selector}: ${elements.length}개 발견`);
                    
                    for (const element of elements) {
                        const text = element.value || element.textContent || element.alt || '';
                        console.log(`버튼 텍스트: "${text}"`);
                        
                        if (text.includes('검색') || text.includes('조회') || text.includes('Search')) {
                            console.log(`검색 버튼 클릭: ${text}`);
                            element.click();
                            return true;
                        }
                    }
                }

                // onclick 이벤트가 있는 모든 요소 검사
                const clickableElements = document.querySelectorAll('[onclick]');
                for (const element of clickableElements) {
                    const onclick = element.getAttribute('onclick');
                    const text = element.textContent || element.value || '';
                    
                    if ((onclick.includes('search') || onclick.includes('Search')) && 
                        (text.includes('검색') || text.includes('조회'))) {
                        console.log(`onclick 검색 버튼 클릭: ${text}`);
                        element.click();
                        return true;
                    }
                }

                return false;
            });

            if (searchResult) {
                console.log('✅ 검색 버튼 클릭 성공');
                console.log('⏳ 검색 결과 로딩 대기...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 검색 결과 확인
                const hasResults = await this.page.evaluate(() => {
                    const bodyText = document.body.textContent;
                    const hasData = bodyText.includes('사건번호') || 
                                   bodyText.includes('물건번호') ||
                                   bodyText.includes('감정가') ||
                                   bodyText.includes('최저가') ||
                                   bodyText.includes('매각기일') ||
                                   bodyText.includes('법원');
                    
                    console.log('검색 결과 확인:', hasData);
                    return hasData;
                });

                if (hasResults) {
                    console.log('✅ 검색 결과 확인됨');
                    return true;
                } else {
                    console.log('⚠️ 검색 결과가 없거나 로딩되지 않음');
                    
                    // 페이지 내용 디버깅
                    const pageContent = await this.page.evaluate(() => {
                        return {
                            title: document.title,
                            hasTable: document.querySelectorAll('table').length > 0,
                            tableCount: document.querySelectorAll('table').length,
                            bodyText: document.body.textContent.substring(0, 500)
                        };
                    });
                    
                    console.log('페이지 디버깅 정보:', pageContent);
                    return false;
                }
            } else {
                console.log('❌ 검색 버튼을 찾을 수 없음');
                
                // 페이지 내용 확인
                const pageInfo = await this.page.evaluate(() => {
                    const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
                        type: input.type,
                        value: input.value,
                        name: input.name,
                        id: input.id
                    }));
                    
                    return {
                        title: document.title,
                        url: window.location.href,
                        inputs: inputs.slice(0, 10), // 처음 10개만
                        buttons: Array.from(document.querySelectorAll('button')).length,
                        hasForm: document.querySelectorAll('form').length > 0
                    };
                });
                
                console.log('페이지 정보:', pageInfo);
                return false;
            }
            
        } catch (error) {
            console.error('전체 선택 및 검색 실행 실패:', error.message);
            return false;
        }
    }

    async scrapeAllPages() {
        console.log('📚 모든 페이지 데이터 수집 시작...');
        
        let allProperties = [];
        let currentPage = 1;
        let hasNextPage = true;
        
        while (hasNextPage && currentPage <= 200) { // 최대 200페이지
            console.log(`📖 페이지 ${currentPage} 처리 중...`);
            
            try {
                const pageData = await this.extractPageData();
                
                if (pageData.length > 0) {
                    allProperties = allProperties.concat(pageData);
                    console.log(`   ✅ ${pageData.length}개 데이터 수집 (총 ${allProperties.length}개)`);
                    
                    // 다음 페이지 이동
                    hasNextPage = await this.goToNextPage();
                    
                    if (hasNextPage) {
                        currentPage++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        console.log('📄 더 이상 페이지가 없습니다');
                        break;
                    }
                } else {
                    console.log('   ⚠️ 이 페이지에서 데이터를 찾을 수 없음');
                    
                    // 첫 번째 페이지에서 데이터가 없으면 종료
                    if (currentPage === 1) {
                        console.log('첫 번째 페이지에 데이터가 없습니다');
                        break;
                    }
                    
                    hasNextPage = false;
                }
                
            } catch (error) {
                console.error(`❌ 페이지 ${currentPage} 처리 실패:`, error.message);
                break;
            }
        }

        console.log(`🎊 총 ${allProperties.length}개 데이터 수집 완료`);
        return allProperties;
    }

    async extractPageData() {
        return await this.page.evaluate(() => {
            const properties = [];
            
            // 모든 테이블 검사
            const tables = document.querySelectorAll('table');
            console.log(`총 ${tables.length}개 테이블 발견`);
            
            let dataTable = null;
            
            // 경매 데이터가 포함된 테이블 찾기
            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const text = table.textContent;
                const rows = table.querySelectorAll('tr');
                
                console.log(`테이블 ${i}: ${rows.length}행, 내용 미리보기: "${text.substring(0, 100)}"`);
                
                if (rows.length > 2 && (
                    text.includes('사건번호') || text.includes('물건번호') ||
                    text.includes('감정가') || text.includes('최저가') ||
                    text.includes('매각기일') || text.includes('법원')
                )) {
                    dataTable = table;
                    console.log(`데이터 테이블 선택: 테이블 ${i}`);
                    break;
                }
            }

            if (!dataTable) {
                console.log('경매 데이터 테이블을 찾을 수 없음');
                return properties;
            }

            const rows = dataTable.querySelectorAll('tr');
            console.log(`데이터 테이블 행 수: ${rows.length}`);
            
            if (rows.length <= 1) {
                return properties;
            }

            // 헤더 분석
            const headerCells = rows[0].querySelectorAll('th, td');
            const headers = Array.from(headerCells).map(cell => cell.textContent.trim());
            console.log('헤더:', headers);

            // 컬럼 매핑
            const columnMap = {};
            headers.forEach((header, index) => {
                const h = header.toLowerCase();
                if (h.includes('사건') || h.includes('번호')) columnMap.caseNumber = index;
                if (h.includes('법원')) columnMap.court = index;
                if (h.includes('물건') || h.includes('종류') || h.includes('용도')) columnMap.type = index;
                if (h.includes('소재') || h.includes('주소') || h.includes('위치')) columnMap.address = index;
                if (h.includes('감정') || h.includes('평가')) columnMap.appraisal = index;
                if (h.includes('최저') || h.includes('매각') || h.includes('가격')) columnMap.minimum = index;
                if (h.includes('기일') || h.includes('일시') || h.includes('날짜')) columnMap.date = index;
                if (h.includes('상태') || h.includes('진행')) columnMap.status = index;
            });

            console.log('컬럼 매핑:', columnMap);

            // 데이터 추출
            let extractedCount = 0;
            for (let i = 1; i < rows.length && extractedCount < 1000; i++) { // 최대 1000개
                const cells = rows[i].querySelectorAll('td');
                if (cells.length < 3) continue;
                
                const getText = (colIndex, fallbackIndex = 0) => {
                    const index = colIndex >= 0 ? colIndex : fallbackIndex;
                    if (index < cells.length) {
                        return cells[index].textContent.replace(/\s+/g, ' ').trim();
                    }
                    return '';
                };
                
                const caseNumber = getText(columnMap.caseNumber, 0);
                const address = getText(columnMap.address, Math.min(3, cells.length - 1));
                
                // 유효성 검사
                if (!caseNumber || caseNumber.length < 5 || !address || address.length < 5) {
                    continue;
                }

                const property = {
                    case_number: caseNumber,
                    court_name: getText(columnMap.court, 1),
                    property_type: getText(columnMap.type, 2),
                    address: address,
                    appraisal_value: getText(columnMap.appraisal, Math.min(4, cells.length - 1)),
                    minimum_sale_price: getText(columnMap.minimum, Math.min(5, cells.length - 1)),
                    auction_date: getText(columnMap.date, Math.min(6, cells.length - 1)),
                    current_status: getText(columnMap.status, Math.min(7, cells.length - 1)) || 'active',
                    scraped_at: new Date().toISOString(),
                    is_real_data: true
                };

                properties.push(property);
                extractedCount++;
            }

            console.log(`추출된 물건 수: ${properties.length}`);
            return properties;
        });
    }

    async goToNextPage() {
        try {
            return await this.page.evaluate(() => {
                // 다음 페이지 버튼 패턴들
                const nextSelectors = [
                    'img[alt*="다음"]',
                    'img[alt*="Next"]',
                    'a[href*="next"]',
                    'input[value*="다음"]',
                    '[onclick*="next"]',
                    '.paging a',
                    '.pagination a'
                ];

                for (const selector of nextSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (element.style.display !== 'none' && !element.disabled) {
                            console.log(`다음 페이지 버튼 클릭: ${element.alt || element.textContent}`);
                            element.click();
                            return true;
                        }
                    }
                }

                return false;
            });
        } catch (error) {
            console.error('다음 페이지 이동 실패:', error.message);
            return false;
        }
    }

    async saveData(properties) {
        if (properties.length === 0) {
            console.log('💾 저장할 데이터가 없습니다.');
            return { new: 0, updated: 0, duplicate: 0, skipped: 0 };
        }

        console.log(`💾 ${properties.length}개 데이터 스마트 업데이트 중...`);

        // 현재 URL 가져오기
        const currentUrl = await this.page.url();

        // 데이터 정제
        const cleanedProperties = properties.map(prop => ({
            case_number: (prop.case_number || '').replace(/\s+/g, '').trim(),
            court_name: prop.court_name || '정보없음',
            property_type: this.parsePropertyType(prop.property_type),
            address: (prop.address || '').replace(/\s+/g, ' ').trim(),
            appraisal_value: this.parseAmount(prop.appraisal_value),
            minimum_sale_price: this.parseAmount(prop.minimum_sale_price),
            auction_date: this.parseDate(prop.auction_date),
            current_status: 'active',
            source_url: currentUrl || 'direct-court-scraper',
            scraped_at: new Date(),
            is_real_data: true
        }));

        // 유효한 데이터만 필터링
        const validProperties = cleanedProperties.filter(prop => 
            prop.case_number && prop.case_number.length >= 5 &&
            prop.address && prop.address.length >= 5
        );

        console.log(`✅ ${validProperties.length}개 유효한 데이터 정제 완료`);

        // 스마트 업데이트 실행
        const updater = new SmartDedupUpdater();
        const result = await updater.processSmartUpdate(validProperties, 'direct-court-scraper');
        
        this.totalCollected = result.new + result.updated;
        
        return result;
    }

    parsePropertyType(text) {
        if (!text) return '기타';
        
        const typeMap = {
            '아파트': '아파트', '단독': '단독주택', '다세대': '다세대주택',
            '연립': '연립주택', '빌라': '빌라', '오피스텔': '오피스텔',
            '상가': '상가', '점포': '상가', '토지': '토지', '대지': '토지',
            '건물': '건물', '공장': '공장', '창고': '창고'
        };
        
        for (const [key, value] of Object.entries(typeMap)) {
            if (text.includes(key)) return value;
        }
        return '기타';
    }

    parseAmount(text) {
        if (!text) return 0;
        
        let amount = 0;
        const cleanText = text.replace(/[^\d억만천원,]/g, '');
        
        if (cleanText.includes('억')) {
            const match = cleanText.match(/(\d+)억/);
            if (match) amount += parseInt(match[1]) * 100000000;
        }
        if (cleanText.includes('만')) {
            const match = cleanText.match(/(\d+)만/);
            if (match) amount += parseInt(match[1]) * 10000;
        }
        if (cleanText.includes('천')) {
            const match = cleanText.match(/(\d+)천/);
            if (match) amount += parseInt(match[1]) * 1000;
        }
        if (amount === 0) {
            const match = cleanText.replace(/[,원]/g, '').match(/\d+/);
            if (match) amount = parseInt(match[0]);
        }
        
        return amount;
    }

    parseDate(text) {
        if (!text) {
            const future = new Date();
            future.setDate(future.getDate() + 30);
            return future.toISOString().split('T')[0];
        }
        
        const match = text.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
        if (match) {
            const [, year, month, day] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        const future = new Date();
        future.setDate(future.getDate() + 30);
        return future.toISOString().split('T')[0];
    }

    async close() {
        if (this.browser) {
            console.log('\n⏳ 10초 후 브라우저를 닫습니다...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            await this.browser.close();
        }
    }

    async run() {
        const startTime = new Date();
        
        try {
            await this.init();
            
            // 다수조회물건 페이지 직접 접근
            const allData = await this.scrapeMultipleViewPage();
            
            // 데이터 저장
            const result = await this.saveData(allData);
            
            // 완료 리포트
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            
            console.log('\n🎉 직접 URL 접근 법원경매 데이터 수집 완료!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`⏱️ 총 소요시간: ${duration}초`);
            console.log(`📊 총 수집량: ${allData.length}개`);
            console.log(`✨ 신규 추가: ${result.new}개`);
            console.log(`🔄 업데이트: ${result.updated}개`);
            console.log(`🔄 중복: ${result.duplicate}개`);
            console.log(`⚠️ 스킵: ${result.skipped}개`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌐 웹사이트에서 확인: http://localhost:3002`);

        } catch (error) {
            console.error('\n❌ 직접 접근 수집 실패:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 실행
if (require.main === module) {
    const scraper = new DirectCourtScraper();
    
    scraper.run()
        .then(() => {
            console.log('\n🎊 직접 URL 접근 법원경매 데이터 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { DirectCourtScraper };