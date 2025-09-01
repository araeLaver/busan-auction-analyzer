#!/usr/bin/env node

const puppeteer = require('puppeteer');
const pool = require('../config/database');
const fs = require('fs').promises;
const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 포괄적 법원경매정보 데이터 수집
 * 다수관심물건, 다수조회물건 전체 페이지 자동 수집
 */
class ComprehensiveCourtScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.totalCollected = 0;
        this.menus = [
            {
                name: '다수관심물건',
                selector: 'a[href*="mulSrchLst"]', // 실제 셀렉터는 사이트 분석 후 수정 필요
                collected: 0
            },
            {
                name: '다수조회물건', 
                selector: 'a[href*="mulViewLst"]', // 실제 셀렉터는 사이트 분석 후 수정 필요
                collected: 0
            }
        ];
    }

    async init() {
        console.log('🚀 포괄적 법원경매정보 데이터 수집 시작');
        
        this.browser = await puppeteer.launch({
            headless: false, // 디버깅을 위해 false로 설정
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--start-maximized',
                '--disable-dev-shm-usage'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');
    }

    async navigateToSite() {
        console.log('🌐 법원경매정보 사이트로 이동...');
        
        await this.page.goto('https://www.courtauction.go.kr', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });

        console.log('✅ 법원경매정보 사이트 접속 완료');
        
        // 페이지 구조 분석
        await this.analyzeSiteStructure();
    }

    async analyzeSiteStructure() {
        console.log('🔍 사이트 구조 분석 중...');
        
        const menuInfo = await this.page.evaluate(() => {
            const menus = [];
            
            // 경매물건 관련 메뉴 찾기
            const links = Array.from(document.querySelectorAll('a'));
            
            links.forEach(link => {
                const text = link.textContent.trim();
                const href = link.href;
                
                if (text.includes('다수관심') || text.includes('관심물건') || 
                    text.includes('다수조회') || text.includes('조회물건') ||
                    text.includes('물건상세검색') || text.includes('경매물건')) {
                    menus.push({
                        text: text,
                        href: href,
                        selector: link.outerHTML
                    });
                }
            });
            
            return {
                menus: menus,
                title: document.title,
                url: window.location.href
            };
        });

        console.log('📋 발견된 관련 메뉴:');
        menuInfo.menus.forEach((menu, index) => {
            console.log(`   ${index + 1}. ${menu.text} - ${menu.href}`);
        });

        return menuInfo;
    }

    async scrapeAllMenus() {
        console.log('📊 모든 메뉴에서 데이터 수집 시작');
        
        // 실제 메뉴 구조에 따라 수정 필요
        const menuUrls = [
            'https://www.courtauction.go.kr/RetrieveRealEstMulSrchLst.laf', // 다수관심물건
            'https://www.courtauction.go.kr/RetrieveRealEstMulViewLst.laf'  // 다수조회물건 (추정 URL)
        ];

        for (const url of menuUrls) {
            try {
                console.log(`\n🎯 메뉴 처리 중: ${url}`);
                await this.scrapeMenuData(url);
            } catch (error) {
                console.error(`❌ 메뉴 처리 실패 (${url}):`, error.message);
                continue;
            }
        }
    }

    async scrapeMenuData(menuUrl) {
        try {
            console.log(`📄 페이지 이동: ${menuUrl}`);
            await this.page.goto(menuUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });

            // 전체 검색 설정
            await this.setSearchFiltersToAll();
            
            // 검색 실행
            await this.executeSearch();
            
            // 모든 페이지 데이터 수집
            const properties = await this.collectAllPages();
            
            console.log(`✅ ${menuUrl}에서 ${properties.length}개 데이터 수집 완료`);
            
            // 데이터베이스 저장
            await this.saveToDatabase(properties, menuUrl);
            
        } catch (error) {
            console.error(`❌ 메뉴 데이터 수집 실패:`, error);
            throw error;
        }
    }

    async setSearchFiltersToAll() {
        console.log('⚙️  검색 조건을 전체로 설정 중...');
        
        try {
            // 일반적인 검색 폼 요소들을 전체로 설정
            await this.page.evaluate(() => {
                // 지역 선택을 전체로
                const regionSelects = document.querySelectorAll('select[name*="idCourtAuctClssCd"], select[name*="region"], select[name*="court"]');
                regionSelects.forEach(select => {
                    select.value = ''; // 전체 선택
                });

                // 물건 종류를 전체로
                const typeSelects = document.querySelectorAll('select[name*="realVowClssCd"], select[name*="type"], select[name*="kind"]');
                typeSelects.forEach(select => {
                    select.value = ''; // 전체 선택
                });

                // 기타 필터들도 전체로
                const allSelects = document.querySelectorAll('select');
                allSelects.forEach(select => {
                    if (select.options[0] && (select.options[0].text.includes('전체') || select.options[0].value === '')) {
                        select.selectedIndex = 0;
                    }
                });
            });
            
            console.log('✅ 검색 조건 설정 완료');
        } catch (error) {
            console.log('⚠️ 검색 조건 설정 중 일부 오류 (계속 진행):', error.message);
        }
    }

    async executeSearch() {
        console.log('🔍 검색 실행 중...');
        
        try {
            // 검색 버튼 찾기 및 클릭
            await this.page.evaluate(() => {
                // 다양한 검색 버튼 패턴 시도
                const searchButtons = [
                    ...document.querySelectorAll('input[type="submit"][value*="검색"]'),
                    ...document.querySelectorAll('input[type="button"][value*="검색"]'),
                    ...document.querySelectorAll('button[type="submit"]'),
                    ...document.querySelectorAll('a[onclick*="search"]'),
                    ...document.querySelectorAll('img[alt*="검색"]').map(img => img.parentElement),
                ];
                
                if (searchButtons.length > 0) {
                    searchButtons[0].click();
                    return true;
                }
                return false;
            });

            // 검색 결과 로딩 대기
            await this.page.waitForTimeout(3000);
            
            // 페이지 로딩 완료까지 대기
            await this.page.waitForLoadState?.('networkidle') || 
                  await this.page.waitForTimeout(5000);
            
            console.log('✅ 검색 실행 완료');
        } catch (error) {
            console.log('⚠️ 검색 실행 중 오류:', error.message);
            // 수동으로 검색된 상태일 수 있으므로 계속 진행
        }
    }

    async collectAllPages() {
        console.log('📚 모든 페이지 데이터 수집 중...');
        
        let allProperties = [];
        let currentPage = 1;
        let maxPages = 1;

        try {
            // 전체 페이지 수 확인
            maxPages = await this.getTotalPages();
            console.log(`📄 총 ${maxPages}페이지 발견`);

            while (currentPage <= maxPages && currentPage <= 100) { // 안전장치: 최대 100페이지
                console.log(`📖 ${currentPage}/${maxPages} 페이지 처리 중...`);
                
                // 현재 페이지 데이터 수집
                const pageProperties = await this.extractPageData(currentPage);
                allProperties = allProperties.concat(pageProperties);
                
                console.log(`   ✅ ${pageProperties.length}개 데이터 수집 (누적: ${allProperties.length}개)`);

                // 다음 페이지로 이동
                if (currentPage < maxPages) {
                    const moved = await this.goToNextPage(currentPage + 1);
                    if (!moved) {
                        console.log('⚠️ 다음 페이지 이동 실패, 수집 종료');
                        break;
                    }
                    await this.page.waitForTimeout(2000); // 페이지 로딩 대기
                }

                currentPage++;
            }

        } catch (error) {
            console.error('❌ 페이지 수집 중 오류:', error);
        }

        console.log(`🎊 총 ${allProperties.length}개 데이터 수집 완료`);
        return allProperties;
    }

    async getTotalPages() {
        try {
            return await this.page.evaluate(() => {
                // 페이지 번호 관련 요소들 찾기
                const pageElements = [
                    ...document.querySelectorAll('.paging a, .pagination a, .page a'),
                    ...document.querySelectorAll('[class*="page"] a'),
                    ...document.querySelectorAll('a[href*="page"]'),
                ];

                let maxPage = 1;
                pageElements.forEach(el => {
                    const pageText = el.textContent.trim();
                    const pageNum = parseInt(pageText);
                    if (!isNaN(pageNum) && pageNum > maxPage) {
                        maxPage = pageNum;
                    }
                });

                // 총 건수에서 페이지 수 계산 시도
                const totalText = document.body.textContent;
                const totalMatch = totalText.match(/총\s*(\d+)\s*건/);
                if (totalMatch) {
                    const total = parseInt(totalMatch[1]);
                    const calculatedPages = Math.ceil(total / 20); // 페이지당 20개 가정
                    if (calculatedPages > maxPage) {
                        maxPage = calculatedPages;
                    }
                }

                return maxPage;
            });
        } catch (error) {
            console.log('⚠️ 총 페이지 수 확인 실패, 기본값 1 사용');
            return 1;
        }
    }

    async extractPageData(pageNum) {
        try {
            return await this.page.evaluate((currentPage) => {
                const properties = [];
                
                // 테이블 찾기
                const tables = document.querySelectorAll('table');
                let dataTable = null;

                // 가장 적합한 데이터 테이블 찾기
                for (const table of tables) {
                    const text = table.textContent;
                    if (text.includes('사건번호') || text.includes('물건') || 
                        text.includes('법원') || text.includes('주소')) {
                        dataTable = table;
                        break;
                    }
                }

                if (!dataTable) {
                    console.log(`페이지 ${currentPage}: 데이터 테이블 없음`);
                    return properties;
                }

                const rows = dataTable.querySelectorAll('tr');
                if (rows.length <= 1) {
                    console.log(`페이지 ${currentPage}: 데이터 행 없음`);
                    return properties;
                }

                // 헤더 분석
                const headerRow = rows[0];
                const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
                    cell.textContent.trim()
                );

                // 헤더 매핑
                const columnMap = {};
                headers.forEach((header, index) => {
                    if (header.includes('사건') || header.includes('번호')) columnMap.caseNumber = index;
                    if (header.includes('법원')) columnMap.court = index;
                    if (header.includes('물건') || header.includes('종류')) columnMap.type = index;
                    if (header.includes('주소') || header.includes('소재')) columnMap.address = index;
                    if (header.includes('감정')) columnMap.appraisal = index;
                    if (header.includes('최저') || header.includes('최소')) columnMap.minimum = index;
                    if (header.includes('기일') || header.includes('일시')) columnMap.date = index;
                    if (header.includes('상태') || header.includes('진행')) columnMap.status = index;
                });

                // 데이터 추출
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = row.querySelectorAll('td');
                    
                    if (cells.length < 3) continue;
                    
                    const getText = (index) => {
                        return index >= 0 && cells[index] ? cells[index].textContent.trim() : '';
                    };
                    
                    const property = {
                        case_number: getText(columnMap.caseNumber) || getText(0) || `AUTO-${Date.now()}-${i}`,
                        court_name: getText(columnMap.court) || getText(1) || '',
                        property_type: getText(columnMap.type) || getText(2) || '',
                        address: getText(columnMap.address) || getText(3) || '',
                        appraisal_value: getText(columnMap.appraisal) || getText(4) || '',
                        minimum_sale_price: getText(columnMap.minimum) || getText(5) || '',
                        auction_date: getText(columnMap.date) || getText(6) || '',
                        current_status: getText(columnMap.status) || getText(7) || 'active',
                        page_number: currentPage,
                        scraped_at: new Date().toISOString(),
                        is_real_data: true
                    };

                    // 유효성 검사
                    if (property.address.length >= 5 && property.case_number.length >= 3) {
                        properties.push(property);
                    }
                }

                return properties;
            }, pageNum);
        } catch (error) {
            console.error(`❌ 페이지 ${pageNum} 데이터 추출 실패:`, error);
            return [];
        }
    }

    async goToNextPage(targetPage) {
        try {
            const moved = await this.page.evaluate((page) => {
                // 다음 페이지 버튼 찾기
                const nextButtons = [
                    ...document.querySelectorAll('a[href*="page"]').filter(a => 
                        a.textContent.trim() === page.toString()
                    ),
                    ...document.querySelectorAll('.paging a, .pagination a').filter(a => 
                        a.textContent.trim() === page.toString()
                    ),
                    ...document.querySelectorAll('a').filter(a => 
                        a.textContent.trim() === '다음' || a.textContent.trim() === 'Next'
                    ),
                ];

                if (nextButtons.length > 0) {
                    nextButtons[0].click();
                    return true;
                }
                return false;
            }, targetPage);

            if (moved) {
                await this.page.waitForTimeout(3000); // 페이지 로딩 대기
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ 페이지 ${targetPage} 이동 실패:`, error);
            return false;
        }
    }

    async saveToDatabase(properties, sourceUrl) {
        if (properties.length === 0) {
            console.log('💾 저장할 데이터가 없습니다.');
            return;
        }

        console.log(`💾 스마트 업데이트로 ${properties.length}개 데이터 처리 중...`);

        // 데이터 정제
        const cleanedProperties = properties.map(prop => ({
            case_number: prop.case_number.replace(/\s+/g, '').trim(),
            court_name: prop.court_name || '법원정보없음',
            property_type: this.parsePropertyType(prop.property_type),
            address: prop.address.replace(/\s+/g, ' ').trim(),
            appraisal_value: this.parseAmount(prop.appraisal_value),
            minimum_sale_price: this.parseAmount(prop.minimum_sale_price),
            auction_date: this.parseDate(prop.auction_date),
            current_status: 'active',
            source_url: sourceUrl,
            scraped_at: new Date().toISOString(),
            is_real_data: true
        }));

        // 유효한 데이터만 필터링
        const validProperties = cleanedProperties.filter(prop => 
            prop.address.length > 5 && 
            (prop.minimum_sale_price > 0 || prop.appraisal_value > 0)
        );

        console.log(`✅ ${validProperties.length}개 유효한 데이터 정제 완료`);

        // 스마트 중복 방지 업데이트 실행
        const updater = new SmartDedupUpdater();
        const result = await updater.processSmartUpdate(validProperties, sourceUrl);
        
        this.totalCollected += result.new + result.updated;
        
        console.log(`✅ 스마트 업데이트 완료: 신규 ${result.new}개, 업데이트 ${result.updated}개, 중복 ${result.duplicate}개`);
    }

    parsePropertyType(text) {
        if (!text) return '기타';
        
        const typeMap = {
            '아파트': '아파트',
            '단독': '단독주택',
            '다세대': '다세대주택',
            '연립': '연립주택',
            '빌라': '빌라',
            '오피스텔': '오피스텔',
            '상가': '상가',
            '점포': '상가',
            '토지': '토지',
            '대지': '토지',
            '건물': '건물',
            '공장': '공장',
            '창고': '창고'
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

    async printSummary() {
        // 수집 결과 통계
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT court_name) as courts,
                COUNT(DISTINCT property_type) as types,
                COUNT(CASE WHEN scraped_at::date = CURRENT_DATE THEN 1 END) as today_count
            FROM auction_service.properties 
            WHERE is_real_data = true
        `);

        const statData = stats.rows[0];

        console.log('\n🎊 포괄적 법원경매정보 데이터 수집 완료!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 총 수집 데이터: ${this.totalCollected}개`);
        console.log(`📊 DB 총 데이터: ${statData.total}개`);
        console.log(`📊 오늘 수집: ${statData.today_count}개`);
        console.log(`🏛️  법원 수: ${statData.courts}개`);
        console.log(`🏠 물건 유형: ${statData.types}개`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✨ 웹사이트에서 확인: http://localhost:3002`);
    }

    async close() {
        if (this.browser) {
            console.log('\n⏳ 5초 후 브라우저를 닫습니다...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.browser.close();
        }
    }

    async run() {
        try {
            await this.init();
            await this.navigateToSite();
            await this.scrapeAllMenus();
            await this.printSummary();
        } catch (error) {
            console.error('❌ 스크래핑 오류:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 실행
if (require.main === module) {
    const scraper = new ComprehensiveCourtScraper();
    
    scraper.run()
        .then(() => {
            console.log('\n🎉 포괄적 데이터 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { ComprehensiveCourtScraper };