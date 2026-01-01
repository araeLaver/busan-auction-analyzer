const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * 법원경매정보 사이트의 다수 관심물건 메뉴에서 실제 데이터 수집
 */
class CourtAuctionScraper {
    constructor() {
        this.baseUrl = 'https://www.courtauction.go.kr';
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('🚀 브라우저 초기화 중...');
        
        this.browser = await puppeteer.launch({
            headless: false, // 브라우저 창을 표시하여 동작 확인
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();
        
        // 한국어 설정
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        });

        // User-Agent 설정
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');

        console.log('✅ 브라우저 초기화 완료');
    }

    /**
     * 법원경매정보 사이트에서 다수 관심물건 데이터 수집
     */
    async scrapeMultipleInterestProperties() {
        try {
            console.log('🔍 법원경매정보 사이트 접속 중...');
            
            // 메인 페이지 접속
            await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });
            console.log('✅ 메인 페이지 접속 완료');

            // 잠시 대기하여 페이지 로드 완료
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log('🔍 다수 관심물건 메뉴 찾는 중...');
            
            // 다수 관심물건 메뉴 클릭 (여러 가능한 선택자 시도)
            const menuSelectors = [
                'a[href*="mulSrch"]',
                'a:contains("다수")',
                'a:contains("관심")',
                'a:contains("물건")',
                '.gnb a',
                '.menu a',
                'nav a'
            ];

            let menuFound = false;
            for (const selector of menuSelectors) {
                try {
                    if (selector.includes('contains')) {
                        // contains 선택자는 puppeteer에서 지원하지 않으므로 다른 방법 사용
                        continue;
                    }
                    
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    await this.page.click(selector);
                    console.log(`✅ 메뉴 클릭 성공: ${selector}`);
                    menuFound = true;
                    break;
                } catch (e) {
                    console.log(`❌ 메뉴 선택자 실패: ${selector}`);
                }
            }

            if (!menuFound) {
                console.log('📋 수동으로 메뉴 탐색 중...');
                
                // 페이지의 모든 링크 텍스트 확인
                const links = await this.page.evaluate(() => {
                    const allLinks = Array.from(document.querySelectorAll('a'));
                    return allLinks.map(link => ({
                        text: link.textContent.trim(),
                        href: link.href,
                        id: link.id,
                        className: link.className
                    })).filter(link => link.text.length > 0);
                });

                console.log('📋 발견된 링크들:');
                links.slice(0, 20).forEach((link, index) => {
                    console.log(`   ${index + 1}. "${link.text}" -> ${link.href}`);
                });

                // 부동산 관련 메뉴 찾기
                const realEstateMenus = links.filter(link => 
                    link.text.includes('부동산') || 
                    link.text.includes('물건') ||
                    link.text.includes('검색') ||
                    link.text.includes('관심') ||
                    link.href.includes('mulSrch') ||
                    link.href.includes('search')
                );

                if (realEstateMenus.length > 0) {
                    console.log('🎯 부동산 관련 메뉴 발견:');
                    realEstateMenus.forEach((menu, index) => {
                        console.log(`   ${index + 1}. "${menu.text}" -> ${menu.href}`);
                    });

                    // 첫 번째 관련 메뉴 클릭
                    const targetMenu = realEstateMenus[0];
                    await this.page.goto(targetMenu.href, { waitUntil: 'networkidle0' });
                    console.log(`✅ 메뉴 이동: ${targetMenu.text}`);
                    menuFound = true;
                }
            }

            if (!menuFound) {
                console.log('⚠️ 직접 검색 페이지로 이동합니다...');
                // 직접 검색 페이지 URL로 이동 시도
                const searchUrls = [
                    `${this.baseUrl}/RetrieveRealEstCarefulBidList.laf`,
                    `${this.baseUrl}/srch/mulSrch.on`,
                    `${this.baseUrl}/pgj/pgj003/mulSrch.on`
                ];

                for (const url of searchUrls) {
                    try {
                        await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
                        console.log(`✅ 검색 페이지 접속: ${url}`);
                        menuFound = true;
                        break;
                    } catch (e) {
                        console.log(`❌ URL 접속 실패: ${url}`);
                    }
                }
            }

            if (!menuFound) {
                throw new Error('다수 관심물건 메뉴를 찾을 수 없습니다');
            }

            // 현재 페이지에서 경매물건 데이터 수집
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('📊 경매물건 데이터 수집 중...');

            const properties = await this.extractPropertiesFromPage();
            console.log(`✅ ${properties.length}개 경매물건 수집 완료`);

            // 다음 페이지가 있으면 더 수집
            let totalProperties = [...properties];
            let pageNum = 1;
            const maxPages = 5; // 최대 5페이지까지만 수집

            while (pageNum < maxPages) {
                const hasNextPage = await this.goToNextPage();
                if (!hasNextPage) break;

                pageNum++;
                console.log(`📄 ${pageNum}페이지 데이터 수집 중...`);
                
                const pageProperties = await this.extractPropertiesFromPage();
                totalProperties = totalProperties.concat(pageProperties);
                console.log(`✅ ${pageNum}페이지에서 ${pageProperties.length}개 추가 수집`);

                await new Promise(resolve => setTimeout(resolve, 2000)); // 서버 부하 방지
            }

            return totalProperties;

        } catch (error) {
            console.error('❌ 다수 관심물건 스크래핑 오류:', error);
            throw error;
        }
    }

    /**
     * 현재 페이지에서 경매물건 데이터 추출
     */
    async extractPropertiesFromPage() {
        return await this.page.evaluate(() => {
            const properties = [];
            
            // 다양한 테이블 구조 시도
            const tableSelectors = [
                'table.tbl_list tbody tr',
                'table.list tbody tr', 
                'table tbody tr',
                '.grid-row',
                '.item-row',
                '.auction-item'
            ];

            let rows = [];
            for (const selector of tableSelectors) {
                rows = document.querySelectorAll(selector);
                if (rows.length > 1) { // 헤더 제외하고 실제 데이터가 있으면
                    console.log(`테이블 발견: ${selector}, ${rows.length}개 행`);
                    break;
                }
            }

            if (rows.length === 0) {
                console.log('❌ 테이블을 찾을 수 없습니다');
                return properties;
            }

            // 각 행에서 데이터 추출
            rows.forEach((row, index) => {
                try {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 5) return; // 최소 5개 열이 있어야 유효한 데이터

                    // 텍스트 추출 함수
                    const getText = (cell) => cell ? cell.textContent.trim() : '';
                    
                    // 가능한 데이터 구조에 맞춰 추출
                    const property = {
                        case_number: getText(cells[0]) || getText(cells[1]) || `REAL-${Date.now()}-${index}`,
                        court_name: getText(cells[1]) || getText(cells[2]) || '법원 정보 없음',
                        property_type: getText(cells[2]) || getText(cells[3]) || '기타',
                        address: getText(cells[3]) || getText(cells[4]) || '주소 정보 없음',
                        appraisal_value: getText(cells[4]) || getText(cells[5]) || '0',
                        minimum_sale_price: getText(cells[5]) || getText(cells[6]) || '0',
                        auction_date: getText(cells[6]) || getText(cells[7]) || '',
                        scraped_at: new Date().toISOString(),
                        is_real_data: true
                    };

                    // 유효성 검사
                    if (property.address.length > 5 && 
                        !property.address.includes('주소 정보 없음') &&
                        property.case_number !== 'REAL-') {
                        properties.push(property);
                        console.log(`✅ 물건 추출: ${property.case_number} - ${property.address.substring(0, 30)}`);
                    }

                } catch (error) {
                    console.warn(`⚠️ 행 ${index} 처리 중 오류:`, error);
                }
            });

            return properties;
        });
    }

    /**
     * 다음 페이지로 이동
     */
    async goToNextPage() {
        try {
            // 다음 페이지 버튼 선택자들
            const nextButtonSelectors = [
                'a:contains("다음")',
                'a:contains(">")',
                '.next',
                '.page-next',
                'a[onclick*="next"]',
                'input[onclick*="next"]'
            ];

            for (const selector of nextButtonSelectors) {
                try {
                    if (selector.includes('contains')) {
                        // JavaScript로 다음 버튼 찾기
                        const hasNext = await this.page.evaluate(() => {
                            const nextButtons = Array.from(document.querySelectorAll('a, input, button')).filter(el => 
                                el.textContent.includes('다음') || 
                                el.textContent.includes('>') ||
                                el.className.includes('next')
                            );
                            
                            if (nextButtons.length > 0) {
                                nextButtons[0].click();
                                return true;
                            }
                            return false;
                        });

                        if (hasNext) {
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            return true;
                        }
                    } else {
                        const nextButton = await this.page.$(selector);
                        if (nextButton) {
                            await nextButton.click();
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            return true;
                        }
                    }
                } catch (e) {
                    // 다음 선택자 시도
                    continue;
                }
            }

            return false;
        } catch (error) {
            console.log('❌ 다음 페이지 이동 실패:', error.message);
            return false;
        }
    }

    /**
     * 수집된 데이터를 정제하고 포맷팅
     */
    formatProperties(rawProperties) {
        return rawProperties.map(prop => {
            return {
                case_number: this.cleanText(prop.case_number),
                court_name: this.extractCourtName(prop.court_name),
                property_type: this.parsePropertyType(prop.property_type),
                address: this.cleanAddress(prop.address),
                appraisal_value: this.parseAmount(prop.appraisal_value),
                minimum_sale_price: this.parseAmount(prop.minimum_sale_price),
                auction_date: this.parseDate(prop.auction_date),
                current_status: 'active',
                source_url: this.baseUrl,
                scraped_at: new Date().toISOString(),
                is_real_data: true
            };
        });
    }

    cleanText(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    extractCourtName(text) {
        if (!text) return '법원 미상';
        
        const courtKeywords = ['지방법원', '지원', '법원'];
        for (const keyword of courtKeywords) {
            if (text.includes(keyword)) {
                return text.trim();
            }
        }
        
        return text.includes('서울') ? '서울중앙지방법원' :
               text.includes('부산') ? '부산지방법원' :
               text.includes('인천') ? '인천지방법원' :
               text.includes('대구') ? '대구지방법원' : text + '지방법원';
    }

    parsePropertyType(text) {
        const typeMap = {
            '아파트': '아파트',
            '단독': '단독주택',
            '다세대': '다세대주택',
            '오피스텔': '오피스텔',
            '상가': '상가',
            '토지': '토지',
            '건물': '건물'
        };
        
        for (const [key, value] of Object.entries(typeMap)) {
            if (text && text.includes(key)) {
                return value;
            }
        }
        
        return '기타';
    }

    cleanAddress(text) {
        if (!text) return '';
        return text.replace(/^\s*주소\s*:?\s*/, '').replace(/\s+/g, ' ').trim();
    }

    parseAmount(text) {
        if (!text) return 0;
        
        // 억, 만 단위 처리
        let amount = 0;
        const cleanText = text.replace(/[^\d억만원,]/g, '');
        
        if (cleanText.includes('억')) {
            const eokMatch = cleanText.match(/(\d+)억/);
            if (eokMatch) amount += parseInt(eokMatch[1]) * 100000000;
        }
        
        if (cleanText.includes('만')) {
            const manMatch = cleanText.match(/(\d+)만/);
            if (manMatch) amount += parseInt(manMatch[1]) * 10000;
        }
        
        if (amount === 0) {
            const numberMatch = cleanText.replace(/[,원]/g, '').match(/\d+/);
            if (numberMatch) amount = parseInt(numberMatch[0]);
        }
        
        return amount;
    }

    parseDate(text) {
        if (!text) {
            const future = new Date();
            future.setDate(future.getDate() + 30);
            return future.toISOString().split('T')[0];
        }
        
        const datePattern = /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/;
        const match = text.match(datePattern);
        
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
            await this.browser.close();
            console.log('🔚 브라우저 종료');
        }
    }

    /**
     * 스크래핑 결과를 파일로 저장
     */
    async saveResults(properties, filename = 'real-court-auction-data.json') {
        const data = {
            collected_at: new Date().toISOString(),
            source: '법원경매정보 - 다수 관심물건',
            total_count: properties.length,
            properties: properties
        };

        await fs.writeFile(filename, JSON.stringify(data, null, 2));
        console.log(`💾 결과 저장: ${filename} (${properties.length}개 물건)`);
        return filename;
    }
}

module.exports = CourtAuctionScraper;