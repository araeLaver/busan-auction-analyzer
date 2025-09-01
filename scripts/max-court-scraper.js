#!/usr/bin/env node

const puppeteer = require('puppeteer');
const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 최대한 많이 가져오는 법원경매 크롤러
 * 각 메뉴에서 50건씩 모든 페이지 수집
 */
class MaxCourtScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.totalCollected = 0;
    }

    async init() {
        console.log('🚀 최대 수집 법원경매 크롤러 시작');
        
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
            console.log(`\n🎯 ${menu.name} 전체 데이터 수집 시작...`);
            
            try {
                const menuData = await this.scrapeMenuDataMaximally(menu);
                if (menuData.length > 0) {
                    allData.push(...menuData);
                    console.log(`✅ ${menu.name}에서 ${menuData.length}개 데이터 수집 완료`);
                } else {
                    console.log(`⚠️ ${menu.name}에서 데이터 없음`);
                }
            } catch (error) {
                console.error(`❌ ${menu.name} 처리 실패:`, error.message);
            }
        }

        return allData;
    }

    async scrapeMenuDataMaximally(menu) {
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
                // 모든 페이지를 강제로 수집
                const allData = await this.scrapeAllPagesMaximally();
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

            // 검색 조건 설정
            await this.page.evaluate(() => {
                console.log('검색 조건 설정 중...');
                
                // 모든 select를 전체로
                const selects = document.querySelectorAll('select');
                console.log(`${selects.length}개 select 요소 처리`);
                
                selects.forEach((select, index) => {
                    if (select.options && select.options.length > 0) {
                        // 전체 옵션 찾기
                        for (let i = 0; i < select.options.length; i++) {
                            const option = select.options[i];
                            if (option.text.includes('전체') || 
                                option.text.includes('전국') || 
                                option.value === '' || 
                                i === 0) {
                                select.selectedIndex = i;
                                console.log(`Select ${index}: ${option.text} 선택`);
                                select.dispatchEvent(new Event('change', { bubbles: true }));
                                break;
                            }
                        }
                    }
                });

                // 라디오 버튼 전체 선택
                const radioButtons = document.querySelectorAll('input[type="radio"]');
                radioButtons.forEach(radio => {
                    if (radio.value === '' || radio.value === '전체') {
                        radio.checked = true;
                    }
                });

                console.log('검색 조건 설정 완료');
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // 검색 버튼 클릭
            console.log('🔍 검색 버튼 찾기...');
            
            const searchResult = await this.page.evaluate(() => {
                console.log('검색 버튼 검색 중...');
                
                // 더 포괄적인 검색 버튼 찾기
                const allElements = [
                    ...document.querySelectorAll('input'),
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('img'),
                    ...document.querySelectorAll('a'),
                    ...document.querySelectorAll('[onclick]')
                ];

                console.log(`총 ${allElements.length}개 요소 검사`);

                for (const element of allElements) {
                    const text = element.value || element.textContent || element.alt || element.title || '';
                    const onclick = element.getAttribute('onclick') || '';
                    const href = element.href || '';
                    
                    // 검색 관련 텍스트나 이벤트가 있는지 확인
                    if ((text.includes('검색') || text.includes('조회') || text.includes('Search')) ||
                        (onclick.includes('search') || onclick.includes('Search')) ||
                        (href.includes('search'))) {
                        
                        console.log(`검색 버튼 발견: ${text} (${element.tagName})`);
                        element.click();
                        return true;
                    }
                }

                console.log('검색 버튼을 찾을 수 없음');
                return false;
            });

            if (searchResult) {
                console.log('✅ 검색 버튼 클릭 성공');
                console.log('⏳ 검색 결과 로딩 대기...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 검색 결과 확인
                const hasResults = await this.page.evaluate(() => {
                    const bodyText = document.body.textContent;
                    const keywords = ['사건번호', '물건번호', '감정가', '최저가', '매각기일', '법원', '주소', '소재지'];
                    
                    let foundKeywords = 0;
                    keywords.forEach(keyword => {
                        if (bodyText.includes(keyword)) {
                            foundKeywords++;
                        }
                    });
                    
                    console.log(`검색 결과 키워드 ${foundKeywords}/${keywords.length}개 발견`);
                    return foundKeywords >= 3; // 3개 이상의 키워드가 있으면 유효한 결과
                });

                if (hasResults) {
                    console.log('✅ 검색 결과 확인됨');
                    return true;
                } else {
                    console.log('⚠️ 검색 결과가 없거나 로딩되지 않음');
                    
                    // 페이지 내용 디버깅
                    const debugInfo = await this.page.evaluate(() => {
                        return {
                            title: document.title,
                            tables: document.querySelectorAll('table').length,
                            bodyLength: document.body.textContent.length,
                            sample: document.body.textContent.substring(0, 200)
                        };
                    });
                    
                    console.log('디버그 정보:', debugInfo);
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

    async scrapeAllPagesMaximally() {
        console.log('📚 최대한 모든 페이지 데이터 수집...');
        
        let allProperties = [];
        let pageAttempt = 1;
        const maxAttempts = 20; // 최대 20페이지까지 시도
        
        while (pageAttempt <= maxAttempts) {
            console.log(`📖 페이지 ${pageAttempt} 시도 중...`);
            
            try {
                // 현재 페이지 데이터 추출
                const pageData = await this.extractPageDataThoroughly();
                
                if (pageData.length > 0) {
                    allProperties = allProperties.concat(pageData);
                    console.log(`   ✅ ${pageData.length}개 데이터 수집 (누적 ${allProperties.length}개)`);
                    
                    // 페이지당 최소 10개 이상은 있어야 정상
                    if (pageData.length < 5 && pageAttempt > 1) {
                        console.log('   ⚠️ 데이터가 적어서 마지막 페이지로 판단');
                        break;
                    }
                    
                    // 다음 페이지 시도
                    const nextPageSuccess = await this.tryAllNextPageMethods(pageAttempt);
                    
                    if (nextPageSuccess) {
                        pageAttempt++;
                        await new Promise(resolve => setTimeout(resolve, 3000)); // 충분한 대기
                    } else {
                        console.log('   📄 더 이상 페이지가 없습니다');
                        break;
                    }
                    
                } else {
                    console.log('   ⚠️ 이 페이지에서 데이터 없음');
                    
                    if (pageAttempt === 1) {
                        console.log('첫 페이지에 데이터가 없음 - 검색 실패');
                        break;
                    } else {
                        console.log('데이터 없음 - 마지막 페이지 도달');
                        break;
                    }
                }
                
            } catch (error) {
                console.error(`❌ 페이지 ${pageAttempt} 처리 실패:`, error.message);
                break;
            }
        }

        console.log(`🎊 최종 ${allProperties.length}개 데이터 수집 완료`);
        return allProperties;
    }

    async extractPageDataThoroughly() {
        return await this.page.evaluate(() => {
            const properties = [];
            
            console.log('페이지 데이터 추출 시작...');
            
            // 모든 테이블 검사
            const tables = document.querySelectorAll('table');
            console.log(`총 ${tables.length}개 테이블 검사`);
            
            let bestTable = null;
            let maxScore = 0;
            
            // 가장 적합한 테이블 찾기
            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const text = table.textContent;
                const rows = table.querySelectorAll('tr');
                
                let score = 0;
                
                // 점수 계산
                if (text.includes('사건번호') || text.includes('물건번호')) score += 5;
                if (text.includes('법원')) score += 3;
                if (text.includes('감정가') || text.includes('최저가')) score += 4;
                if (text.includes('주소') || text.includes('소재')) score += 3;
                if (text.includes('매각기일')) score += 2;
                if (rows.length > 2) score += rows.length * 0.1; // 행 수에 비례
                
                console.log(`테이블 ${i}: 점수 ${score}, 행 수 ${rows.length}`);
                
                if (score > maxScore && rows.length > 2) {
                    maxScore = score;
                    bestTable = table;
                }
            }

            if (!bestTable) {
                console.log('적합한 데이터 테이블 없음');
                return properties;
            }

            console.log(`최고 점수 테이블 선택: 점수 ${maxScore}`);

            const rows = bestTable.querySelectorAll('tr');
            if (rows.length <= 1) return properties;

            // 헤더 분석
            const headerCells = rows[0].querySelectorAll('th, td');
            const headers = Array.from(headerCells).map(cell => cell.textContent.trim());
            console.log('헤더:', headers);

            // 컬럼 매핑 - 더 정확한 매핑
            const findColumn = (keywords) => {
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
                caseNumber: findColumn(['사건번호', '물건번호', '번호']),
                court: findColumn(['법원', '담당법원']),
                type: findColumn(['물건종류', '용도', '종류', '구분']),
                address: findColumn(['소재지', '주소', '위치', '소재']),
                appraisal: findColumn(['감정가', '평가액', '감정']),
                minimum: findColumn(['최저매각가격', '최저가', '매각가격', '최저']),
                date: findColumn(['매각기일', '경매일', '기일', '일시']),
                status: findColumn(['진행상태', '상태', '진행'])
            };

            console.log('컬럼 매핑:', columnMap);

            // 데이터 추출 - 더 관대한 조건
            let extractedCount = 0;
            for (let i = 1; i < rows.length && extractedCount < 100; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length < 2) continue;
                
                const getText = (colIndex, fallbackIndex) => {
                    let index = colIndex >= 0 ? colIndex : fallbackIndex;
                    if (index >= cells.length) index = Math.min(fallbackIndex, cells.length - 1);
                    
                    if (index >= 0 && index < cells.length) {
                        return cells[index].textContent.replace(/\s+/g, ' ').trim();
                    }
                    return '';
                };
                
                const caseNumber = getText(columnMap.caseNumber, 0);
                const address = getText(columnMap.address, Math.min(2, cells.length - 1));
                
                // 더 관대한 유효성 검사
                if (caseNumber && caseNumber.length >= 3 && address && address.length >= 3) {
                    const property = {
                        case_number: caseNumber,
                        court_name: getText(columnMap.court, 1),
                        property_type: getText(columnMap.type, Math.min(1, cells.length - 1)),
                        address: address,
                        appraisal_value: getText(columnMap.appraisal, Math.min(3, cells.length - 1)),
                        minimum_sale_price: getText(columnMap.minimum, Math.min(4, cells.length - 1)),
                        auction_date: getText(columnMap.date, Math.min(5, cells.length - 1)),
                        current_status: getText(columnMap.status, Math.min(6, cells.length - 1)) || 'active',
                        scraped_at: new Date().toISOString(),
                        is_real_data: true
                    };

                    properties.push(property);
                    extractedCount++;
                    
                    if (extractedCount % 10 === 0) {
                        console.log(`${extractedCount}개 추출 중...`);
                    }
                }
            }

            console.log(`총 ${properties.length}개 데이터 추출`);
            return properties;
        });
    }

    async tryAllNextPageMethods(currentPage) {
        console.log(`   🔄 페이지 ${currentPage + 1} 이동 시도...`);
        
        try {
            // 방법 1: 다음 버튼 찾기
            const method1 = await this.page.evaluate(() => {
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
                        if (element.style.display !== 'none' && !element.disabled && 
                            !element.classList.contains('disabled')) {
                            console.log(`다음 버튼 클릭: ${element.alt || element.textContent}`);
                            element.click();
                            return true;
                        }
                    }
                }
                return false;
            });

            if (method1) {
                console.log('   ✅ 방법1 성공: 다음 버튼');
                return true;
            }

            // 방법 2: 페이지 번호 클릭
            const method2 = await this.page.evaluate((targetPage) => {
                const pageLinks = document.querySelectorAll('a[href*="page"], a[onclick*="page"]');
                for (const link of pageLinks) {
                    const linkText = link.textContent.trim();
                    if (linkText === targetPage.toString()) {
                        console.log(`페이지 번호 클릭: ${linkText}`);
                        link.click();
                        return true;
                    }
                }
                return false;
            }, currentPage + 1);

            if (method2) {
                console.log('   ✅ 방법2 성공: 페이지 번호');
                return true;
            }

            // 방법 3: JavaScript 실행으로 페이지 이동
            const method3 = await this.page.evaluate((targetPage) => {
                // 일반적인 페이징 함수들 시도
                const pageFunctions = [
                    `goPage(${targetPage})`,
                    `movePage(${targetPage})`,
                    `pageMove(${targetPage})`,
                    `fn_goPage(${targetPage})`,
                    `fn_movePage(${targetPage})`
                ];

                for (const func of pageFunctions) {
                    try {
                        eval(func);
                        console.log(`JavaScript 함수 실행: ${func}`);
                        return true;
                    } catch (e) {
                        // 함수가 없으면 무시
                    }
                }
                return false;
            }, currentPage + 1);

            if (method3) {
                console.log('   ✅ 방법3 성공: JavaScript 함수');
                return true;
            }

            console.log('   ❌ 모든 방법 실패');
            return false;

        } catch (error) {
            console.error('   ❌ 페이지 이동 오류:', error.message);
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
            source_url: currentUrl || 'max-court-scraper',
            scraped_at: new Date(),
            is_real_data: true
        }));

        const validProperties = cleanedProperties.filter(prop => 
            prop.case_number && prop.case_number.length >= 3 &&
            prop.address && prop.address.length >= 3
        );

        console.log(`✅ ${validProperties.length}개 유효한 데이터 정제 완료`);

        const updater = new SmartDedupUpdater();
        const result = await updater.processSmartUpdate(validProperties, 'max-court-scraper');
        
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
            console.log('\n⏳ 15초 후 브라우저를 닫습니다...');
            await new Promise(resolve => setTimeout(resolve, 15000));
            await this.browser.close();
        }
    }

    async run() {
        const startTime = new Date();
        
        try {
            await this.init();
            
            // 모든 메뉴에서 최대한 수집
            const allData = await this.scrapeAllMenus();
            
            // 데이터 저장
            const result = await this.saveData(allData);
            
            // 완료 리포트
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            
            console.log('\n🎉 최대 수집 법원경매 데이터 수집 완료!');
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
            console.error('\n❌ 최대 수집 실패:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 실행
if (require.main === module) {
    const scraper = new MaxCourtScraper();
    
    scraper.run()
        .then(() => {
            console.log('\n🎊 최대 수집 법원경매 데이터 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { MaxCourtScraper };