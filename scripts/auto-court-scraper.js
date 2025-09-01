#!/usr/bin/env node

const puppeteer = require('puppeteer');
const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 완전 자동 법원경매정보 크롤러
 * 다수관심물건, 다수조회물건 자동 접근하여 전체 페이지 수집
 */
class AutoCourtScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.totalCollected = 0;
    }

    async init() {
        console.log('🚀 완전 자동 법원경매 크롤러 시작');
        
        this.browser = await puppeteer.launch({
            headless: false, // 디버깅을 위해 브라우저 표시
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

    async navigateToCourtSite() {
        console.log('🌐 법원경매정보 사이트 접속...');
        
        await this.page.goto('https://www.courtauction.go.kr', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ 법원경매정보 사이트 접속 완료');
    }

    async accessMultipleSearchMenus() {
        const results = [];
        
        // 다수관심물건과 다수조회물건 모두 시도
        const menuTargets = [
            { name: '다수관심물건', url: 'https://www.courtauction.go.kr/RetrieveRealEstMulSrchLst.laf' },
            { name: '다수조회물건', url: 'https://www.courtauction.go.kr/RetrieveRealEstMulViewLst.laf' }
        ];

        for (const target of menuTargets) {
            console.log(`\n🎯 ${target.name} 메뉴 처리 시작...`);
            
            try {
                const menuData = await this.scrapeMenuData(target);
                if (menuData.length > 0) {
                    results.push(...menuData);
                    console.log(`✅ ${target.name}에서 ${menuData.length}개 데이터 수집`);
                } else {
                    console.log(`⚠️ ${target.name}에서 데이터 없음`);
                }
            } catch (error) {
                console.error(`❌ ${target.name} 처리 실패:`, error.message);
                
                // 브라우저 방식으로 재시도
                try {
                    const browserData = await this.tryBrowserAccess(target.name);
                    if (browserData.length > 0) {
                        results.push(...browserData);
                        console.log(`✅ 브라우저 방식으로 ${target.name}에서 ${browserData.length}개 데이터 수집`);
                    }
                } catch (retryError) {
                    console.error(`❌ ${target.name} 재시도도 실패:`, retryError.message);
                }
            }
        }

        return results;
    }

    async scrapeMenuData(target) {
        console.log(`📄 ${target.name} 페이지로 이동: ${target.url}`);
        
        try {
            await this.page.goto(target.url, { 
                waitUntil: 'networkidle2',
                timeout: 20000 
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            // 전체 검색 조건 설정
            await this.setAllFilters();
            
            // 검색 실행
            await this.executeSearch();

            // 모든 페이지 데이터 수집
            const allData = await this.scrapeAllPagesAutomatically();
            
            return allData;

        } catch (error) {
            console.error(`${target.name} 직접 접근 실패:`, error.message);
            return [];
        }
    }

    async tryBrowserAccess(menuName) {
        console.log(`🔄 ${menuName} 브라우저 방식으로 재시도...`);
        
        try {
            // 메인 페이지로 돌아가기
            await this.page.goto('https://www.courtauction.go.kr', { 
                waitUntil: 'networkidle2',
                timeout: 20000 
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            // JavaScript로 메뉴 클릭 시도
            const menuFound = await this.page.evaluate((targetMenu) => {
                // 모든 가능한 요소들 검색
                const allElements = [
                    ...document.querySelectorAll('a'),
                    ...document.querySelectorAll('td'),
                    ...document.querySelectorAll('div'),
                    ...document.querySelectorAll('span'),
                    ...document.querySelectorAll('[onclick]')
                ];

                for (const element of allElements) {
                    const text = element.textContent || element.innerText || '';
                    if (text.includes(targetMenu) || text.includes('다수관심') || text.includes('다수조회')) {
                        console.log(`메뉴 발견: ${text}`);
                        element.click();
                        return true;
                    }
                }

                // 경매물건 메뉴 먼저 클릭 시도
                for (const element of allElements) {
                    const text = element.textContent || element.innerText || '';
                    if (text.includes('경매물건')) {
                        console.log(`경매물건 메뉴 클릭: ${text}`);
                        element.click();
                        return 'auction_menu';
                    }
                }

                return false;
            }, menuName);

            if (menuFound === 'auction_menu') {
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 다수관심물건/다수조회물건 메뉴 다시 찾기
                const subMenuFound = await this.page.evaluate((targetMenu) => {
                    const allElements = [
                        ...document.querySelectorAll('a'),
                        ...document.querySelectorAll('td'),
                        ...document.querySelectorAll('div')
                    ];

                    for (const element of allElements) {
                        const text = element.textContent || element.innerText || '';
                        if (text.includes(targetMenu) || text.includes('다수관심') || text.includes('다수조회')) {
                            console.log(`서브메뉴 발견: ${text}`);
                            element.click();
                            return true;
                        }
                    }
                    return false;
                }, menuName);

                if (subMenuFound) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // 검색 수행
                    await this.setAllFilters();
                    await this.executeSearch();
                    const data = await this.scrapeAllPagesAutomatically();
                    
                    return data;
                }
            } else if (menuFound) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 검색 수행
                await this.setAllFilters();
                await this.executeSearch();
                const data = await this.scrapeAllPagesAutomatically();
                
                return data;
            }

            return [];

        } catch (error) {
            console.error(`브라우저 방식 접근 실패:`, error.message);
            return [];
        }
    }

    async setAllFilters() {
        console.log('⚙️ 검색 조건을 전체로 설정...');
        
        try {
            await this.page.evaluate(() => {
                // 모든 select 요소를 전체로 설정
                const selects = document.querySelectorAll('select');
                selects.forEach(select => {
                    // 첫 번째 옵션 선택 (보통 전체)
                    if (select.options && select.options.length > 0) {
                        select.selectedIndex = 0;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                // 특정 필드들 전체로 설정
                const regionSelects = document.querySelectorAll('select[name*="court"], select[name*="region"], select[name*="sido"]');
                regionSelects.forEach(select => {
                    for (let i = 0; i < select.options.length; i++) {
                        const option = select.options[i];
                        if (option.text.includes('전체') || option.text.includes('전국') || option.value === '') {
                            select.selectedIndex = i;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                        }
                    }
                });

                // 체크박스들 체크
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    if (!checkbox.checked) {
                        checkbox.click();
                    }
                });
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('✅ 검색 조건 설정 완료');
            
        } catch (error) {
            console.log('⚠️ 검색 조건 설정 중 일부 오류:', error.message);
        }
    }

    async executeSearch() {
        console.log('🔍 검색 실행...');
        
        try {
            const searchExecuted = await this.page.evaluate(() => {
                // 검색 버튼 찾기
                const searchButtons = [
                    ...document.querySelectorAll('input[type="submit"]'),
                    ...document.querySelectorAll('input[type="button"]'),
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('img[alt*="검색"]'),
                    ...document.querySelectorAll('[onclick*="search"]')
                ];

                for (const button of searchButtons) {
                    const text = button.value || button.textContent || button.alt || '';
                    if (text.includes('검색') || text.includes('조회') || text.includes('Search')) {
                        console.log(`검색 버튼 클릭: ${text}`);
                        button.click();
                        return true;
                    }
                }
                
                return false;
            });

            if (searchExecuted) {
                console.log('🔍 검색 버튼 클릭 완료, 결과 로딩 대기...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 검색 결과 확인
                const hasResults = await this.page.evaluate(() => {
                    const text = document.body.textContent;
                    return text.includes('사건번호') || 
                           text.includes('물건번호') ||
                           text.includes('감정가') ||
                           text.includes('최저가') ||
                           text.includes('매각기일');
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
            console.error('검색 실행 실패:', error.message);
            return false;
        }
    }

    async scrapeAllPagesAutomatically() {
        console.log('📚 모든 페이지 자동 수집 시작...');
        
        let allProperties = [];
        let currentPage = 1;
        let hasNextPage = true;
        
        while (hasNextPage && currentPage <= 100) { // 최대 100페이지
            console.log(`📖 페이지 ${currentPage} 처리 중...`);
            
            try {
                const pageData = await this.extractCurrentPageData();
                
                if (pageData.length > 0) {
                    allProperties = allProperties.concat(pageData);
                    console.log(`   ✅ ${pageData.length}개 데이터 수집 (총 ${allProperties.length}개)`);
                    
                    // 다음 페이지 이동
                    hasNextPage = await this.moveToNextPage();
                    
                    if (hasNextPage) {
                        currentPage++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        console.log('📄 더 이상 페이지가 없습니다');
                        break;
                    }
                } else {
                    console.log('   ⚠️ 이 페이지에서 데이터를 찾을 수 없음');
                    break;
                }
                
            } catch (error) {
                console.error(`❌ 페이지 ${currentPage} 처리 실패:`, error.message);
                break;
            }
        }

        console.log(`🎊 총 ${allProperties.length}개 데이터 수집 완료`);
        return allProperties;
    }

    async extractCurrentPageData() {
        return await this.page.evaluate(() => {
            const properties = [];
            
            // 테이블 찾기
            const tables = document.querySelectorAll('table');
            let dataTable = null;
            
            // 경매 데이터 테이블 식별
            for (const table of tables) {
                const text = table.textContent;
                if ((text.includes('사건번호') || text.includes('물건번호')) && 
                    (text.includes('법원') || text.includes('감정가')) && 
                    table.querySelectorAll('tr').length > 2) {
                    dataTable = table;
                    break;
                }
            }

            if (!dataTable) {
                return properties;
            }

            const rows = dataTable.querySelectorAll('tr');
            if (rows.length <= 1) {
                return properties;
            }

            // 헤더 분석
            const headerCells = rows[0].querySelectorAll('th, td');
            const headers = Array.from(headerCells).map(cell => cell.textContent.trim());

            // 컬럼 매핑
            const getColumnIndex = (keywords) => {
                for (let i = 0; i < headers.length; i++) {
                    const header = headers[i].toLowerCase();
                    for (const keyword of keywords) {
                        if (header.includes(keyword.toLowerCase())) {
                            return i;
                        }
                    }
                }
                return -1;
            };

            const columnMap = {
                caseNumber: getColumnIndex(['사건번호', '물건번호', '번호']),
                court: getColumnIndex(['법원', '담당법원']),
                type: getColumnIndex(['물건종류', '용도', '종류']),
                address: getColumnIndex(['소재지', '주소', '위치']),
                appraisal: getColumnIndex(['감정가', '평가액']),
                minimum: getColumnIndex(['최저매각가격', '최저가', '매각가격']),
                date: getColumnIndex(['매각기일', '경매일', '기일']),
                status: getColumnIndex(['진행상태', '상태'])
            };

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
                const address = getText(columnMap.address, 3);
                
                // 최소 검증: 사건번호와 주소가 있어야 유효
                if (!caseNumber || caseNumber.length < 3 || !address || address.length < 5) {
                    continue;
                }

                const property = {
                    case_number: caseNumber,
                    court_name: getText(columnMap.court, 1),
                    property_type: getText(columnMap.type, 2),
                    address: address,
                    appraisal_value: getText(columnMap.appraisal, 4),
                    minimum_sale_price: getText(columnMap.minimum, 5),
                    auction_date: getText(columnMap.date, 6),
                    current_status: getText(columnMap.status, 7) || 'active',
                    scraped_at: new Date().toISOString(),
                    is_real_data: true
                };

                properties.push(property);
            }

            return properties;
        });
    }

    async moveToNextPage() {
        try {
            return await this.page.evaluate(() => {
                // 다음 페이지 버튼 찾기
                const nextPatterns = [
                    'a[href*="next"]',
                    'img[alt*="다음"]',
                    'img[alt*="Next"]', 
                    'input[value*="다음"]',
                    '[onclick*="next"]',
                    '.next',
                    '[title*="다음"]'
                ];

                for (const pattern of nextPatterns) {
                    const elements = document.querySelectorAll(pattern);
                    for (const element of elements) {
                        if (element.style.display !== 'none' && !element.disabled) {
                            element.click();
                            return true;
                        }
                    }
                }

                // 페이지 번호로 찾기
                const pageLinks = document.querySelectorAll('a[href*="page"], a[onclick*="page"]');
                let currentPageNum = 1;
                
                // 현재 페이지 확인
                const currentPageElement = document.querySelector('.current, .active, [style*="font-weight: bold"]');
                if (currentPageElement) {
                    const pageText = currentPageElement.textContent.trim();
                    const pageMatch = pageText.match(/\d+/);
                    if (pageMatch) {
                        currentPageNum = parseInt(pageMatch[0]);
                    }
                }

                // 다음 페이지 번호 클릭
                for (const link of pageLinks) {
                    const linkText = link.textContent.trim();
                    const pageMatch = linkText.match(/\d+/);
                    if (pageMatch) {
                        const pageNum = parseInt(pageMatch[0]);
                        if (pageNum === currentPageNum + 1) {
                            link.click();
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
            source_url: currentUrl || 'auto-court-scraper',
            scraped_at: new Date(),
            is_real_data: true
        }));

        // 유효한 데이터만 필터링
        const validProperties = cleanedProperties.filter(prop => 
            prop.case_number && prop.case_number.length >= 3 &&
            prop.address && prop.address.length >= 5
        );

        console.log(`✅ ${validProperties.length}개 유효한 데이터 정제 완료`);

        // 스마트 업데이트 실행
        const updater = new SmartDedupUpdater();
        const result = await updater.processSmartUpdate(validProperties, 'auto-court-scraper');
        
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
            await this.navigateToCourtSite();
            
            // 다수관심물건, 다수조회물건 모두 처리
            const allData = await this.accessMultipleSearchMenus();
            
            // 데이터 저장
            const result = await this.saveData(allData);
            
            // 완료 리포트
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            
            console.log('\n🎉 완전 자동 법원경매 데이터 수집 완료!');
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
            console.error('\n❌ 자동 수집 실패:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 실행
if (require.main === module) {
    const scraper = new AutoCourtScraper();
    
    scraper.run()
        .then(() => {
            console.log('\n🎊 완전 자동 법원경매 데이터 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { AutoCourtScraper };