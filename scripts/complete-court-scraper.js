#!/usr/bin/env node

const puppeteer = require('puppeteer');
const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 완전한 법원경매 크롤러
 * 다수관심물건과 다수조회물건 모두 처리
 */
class CompleteCourtScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.totalCollected = 0;
    }

    async init() {
        console.log('🚀 완전한 법원경매 크롤러 시작');
        
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

    async scrapeAllMenus() {
        const allData = [];
        
        // 다수조회물건과 다수관심물건 URL
        const menuUrls = [
            {
                name: '다수조회물건',
                url: 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ155M00.xml&pgmDvsNum=1'
            },
            {
                name: '다수관심물건', 
                url: 'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ155M00.xml&pgmDvsNum=2'
            }
        ];

        for (const menu of menuUrls) {
            console.log(`\n🎯 ${menu.name} 처리 시작...`);
            
            try {
                const menuData = await this.scrapeMenuData(menu);
                if (menuData.length > 0) {
                    allData.push(...menuData);
                    console.log(`✅ ${menu.name}에서 ${menuData.length}개 데이터 수집`);
                } else {
                    console.log(`⚠️ ${menu.name}에서 데이터 없음`);
                }
            } catch (error) {
                console.error(`❌ ${menu.name} 처리 실패:`, error.message);
            }
        }

        return allData;
    }

    async scrapeMenuData(menu) {
        console.log(`📄 ${menu.name} 페이지 접근: ${menu.url}`);
        
        try {
            await this.page.goto(menu.url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`✅ ${menu.name} 페이지 접근 완료`);

            // 전체 선택 및 검색
            const searchSuccess = await this.selectAllAndSearch();
            
            if (searchSuccess) {
                // 모든 페이지 데이터 수집
                const allData = await this.scrapeAllPages();
                return allData;
            } else {
                console.log(`❌ ${menu.name} 검색 실패`);
                return [];
            }

        } catch (error) {
            console.error(`${menu.name} 접근 실패:`, error.message);
            return [];
        }
    }

    async selectAllAndSearch() {
        console.log('⚙️ 전체 선택 및 검색 실행...');
        
        try {
            await this.page.waitForSelector('body', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 모든 select 요소를 전체로 설정
            await this.page.evaluate(() => {
                const selects = document.querySelectorAll('select');
                
                selects.forEach((select, index) => {
                    if (select.options && select.options.length > 0) {
                        // "전체" 또는 빈 값 옵션 찾기
                        for (let i = 0; i < select.options.length; i++) {
                            const option = select.options[i];
                            if (option.text.includes('전체') || 
                                option.text.includes('전국') || 
                                option.value === '' || 
                                i === 0) {
                                select.selectedIndex = i;
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                                break;
                            }
                        }
                    }
                });

                // 라디오 버튼이 있다면 전체 선택
                const radioButtons = document.querySelectorAll('input[type="radio"]');
                radioButtons.forEach(radio => {
                    if (radio.value === '' || radio.value === '전체') {
                        radio.checked = true;
                    }
                });
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // 검색 버튼 클릭
            const searchResult = await this.page.evaluate(() => {
                const searchSelectors = [
                    'input[type="submit"][value*="검색"]',
                    'input[type="button"][value*="검색"]', 
                    'input[type="submit"][value*="조회"]',
                    'input[type="button"][value*="조회"]',
                    'button[type="submit"]',
                    'img[alt*="검색"]',
                    'img[alt*="조회"]',
                    '[onclick*="search"]',
                    '[onclick*="Search"]'
                ];

                for (const selector of searchSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const text = element.value || element.textContent || element.alt || '';
                        if (text.includes('검색') || text.includes('조회') || text.includes('Search')) {
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
                        element.click();
                        return true;
                    }
                }

                return false;
            });

            if (searchResult) {
                console.log('✅ 검색 버튼 클릭 성공');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                const hasResults = await this.page.evaluate(() => {
                    const bodyText = document.body.textContent;
                    return bodyText.includes('사건번호') || 
                           bodyText.includes('물건번호') ||
                           bodyText.includes('감정가') ||
                           bodyText.includes('최저가') ||
                           bodyText.includes('매각기일') ||
                           bodyText.includes('법원');
                });

                if (hasResults) {
                    console.log('✅ 검색 결과 확인됨');
                    return true;
                } else {
                    console.log('⚠️ 검색 결과가 없거나 로딩되지 않음');
                    return false;
                }
            } else {
                console.log('❌ 검색 버튼을 찾을 수 없음');
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
        
        while (hasNextPage && currentPage <= 500) { // 최대 500페이지
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
                    if (currentPage === 1) break;
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
            
            const tables = document.querySelectorAll('table');
            let dataTable = null;
            
            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const text = table.textContent;
                const rows = table.querySelectorAll('tr');
                
                if (rows.length > 2 && (
                    text.includes('사건번호') || text.includes('물건번호') ||
                    text.includes('감정가') || text.includes('최저가') ||
                    text.includes('매각기일') || text.includes('법원')
                )) {
                    dataTable = table;
                    break;
                }
            }

            if (!dataTable) return properties;

            const rows = dataTable.querySelectorAll('tr');
            if (rows.length <= 1) return properties;

            // 헤더 분석
            const headerCells = rows[0].querySelectorAll('th, td');
            const headers = Array.from(headerCells).map(cell => cell.textContent.trim());

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

            // 데이터 추출
            for (let i = 1; i < rows.length; i++) {
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
            }

            return properties;
        });
    }

    async goToNextPage() {
        try {
            return await this.page.evaluate(() => {
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

        const currentUrl = await this.page.url();

        const cleanedProperties = properties.map(prop => ({
            case_number: (prop.case_number || '').replace(/\s+/g, '').trim(),
            court_name: prop.court_name || '정보없음',
            property_type: this.parsePropertyType(prop.property_type),
            address: (prop.address || '').replace(/\s+/g, ' ').trim(),
            appraisal_value: this.parseAmount(prop.appraisal_value),
            minimum_sale_price: this.parseAmount(prop.minimum_sale_price),
            auction_date: this.parseDate(prop.auction_date),
            current_status: 'active',
            source_url: currentUrl || 'complete-court-scraper',
            scraped_at: new Date(),
            is_real_data: true
        }));

        const validProperties = cleanedProperties.filter(prop => 
            prop.case_number && prop.case_number.length >= 5 &&
            prop.address && prop.address.length >= 5
        );

        console.log(`✅ ${validProperties.length}개 유효한 데이터 정제 완료`);

        const updater = new SmartDedupUpdater();
        const result = await updater.processSmartUpdate(validProperties, 'complete-court-scraper');
        
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
            
            // 모든 메뉴 처리
            const allData = await this.scrapeAllMenus();
            
            // 데이터 저장
            const result = await this.saveData(allData);
            
            // 완료 리포트
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            
            console.log('\n🎉 완전한 법원경매 데이터 수집 완료!');
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
            console.error('\n❌ 완전한 수집 실패:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 실행
if (require.main === module) {
    const scraper = new CompleteCourtScraper();
    
    scraper.run()
        .then(() => {
            console.log('\n🎊 완전한 법원경매 데이터 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { CompleteCourtScraper };