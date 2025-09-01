#!/usr/bin/env node

const puppeteer = require('puppeteer');
const pool = require('../config/database');
const fs = require('fs').promises;
const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 실제 법원경매정보 사이트 전체 데이터 수집기
 * 다수관심물건, 다수조회물건 실제 접근하여 모든 페이지 수집
 */
class RealCourtDataScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.totalCollected = 0;
        this.currentUrl = '';
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async init() {
        console.log('🚀 실제 법원경매정보 전체 데이터 수집기 시작');
        
        this.browser = await puppeteer.launch({
            headless: false, // 실제 브라우저 창 표시
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--start-maximized',
                '--disable-dev-shm-usage',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();
        
        // User-Agent 설정
        await this.page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
        );

        // 요청 인터셉터 설정 (디버깅용)
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
            if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet') {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    async navigateToSite() {
        console.log('🌐 법원경매정보 사이트 접속 중...');
        
        try {
            await this.page.goto('https://www.courtauction.go.kr', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // 페이지 로드 확인
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✅ 메인 페이지 접속 완료');
            
            return true;
        } catch (error) {
            console.error('❌ 사이트 접속 실패:', error.message);
            throw error;
        }
    }

    async accessMultipleInterestMenu() {
        console.log('🎯 다수관심물건 메뉴 접근 시도...');
        
        try {
            // 경매물건 메뉴 클릭 대기
            console.log('1️⃣ 경매물건 메뉴 찾는 중...');
            
            await this.page.evaluate(() => {
                // 경매물건 관련 링크 찾기
                const links = Array.from(document.querySelectorAll('a'));
                const auctionLink = links.find(link => 
                    link.textContent.includes('경매물건') || 
                    link.textContent.includes('물건검색')
                );
                
                if (auctionLink) {
                    console.log('경매물건 메뉴 발견:', auctionLink.textContent);
                    auctionLink.click();
                    return true;
                }
                return false;
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            // 다수관심물건 메뉴 찾기
            console.log('2️⃣ 다수관심물건 메뉴 찾는 중...');
            
            const found = await this.page.evaluate(() => {
                // 모든 링크와 버튼 검사
                const elements = [
                    ...document.querySelectorAll('a'),
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('[onclick]'),
                    ...document.querySelectorAll('td'),
                    ...document.querySelectorAll('div')
                ];
                
                for (const element of elements) {
                    const text = element.textContent || element.innerText || '';
                    if (text.includes('다수관심') || text.includes('관심물건')) {
                        console.log('다수관심물건 메뉴 발견:', text);
                        element.click();
                        return true;
                    }
                }
                
                return false;
            });

            if (found) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                console.log('✅ 다수관심물건 메뉴 접근 성공');
                return true;
            }
            
            throw new Error('다수관심물건 메뉴를 찾을 수 없습니다');
            
        } catch (error) {
            console.error('❌ 다수관심물건 메뉴 접근 실패:', error.message);
            return false;
        }
    }

    async performCompleteSearch() {
        console.log('🔍 전체 검색 설정 및 실행...');
        
        try {
            // 검색 조건을 전체로 설정
            await this.page.evaluate(() => {
                // 모든 select 요소를 전체/전국으로 설정
                const selects = document.querySelectorAll('select');
                selects.forEach(select => {
                    // 첫 번째 옵션이 보통 "전체"
                    if (select.options.length > 0) {
                        select.selectedIndex = 0;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                // 지역 설정 - 전국으로
                const regionSelects = document.querySelectorAll('select[name*="region"], select[name*="sido"], select[name*="court"]');
                regionSelects.forEach(select => {
                    for (let i = 0; i < select.options.length; i++) {
                        if (select.options[i].text.includes('전체') || 
                            select.options[i].text.includes('전국') ||
                            select.options[i].value === '') {
                            select.selectedIndex = i;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                        }
                    }
                });

                // 물건종류 - 전체로
                const typeSelects = document.querySelectorAll('select[name*="type"], select[name*="kind"]');
                typeSelects.forEach(select => {
                    select.selectedIndex = 0;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            // 검색 버튼 클릭
            console.log('🔍 검색 버튼 클릭...');
            
            const searchClicked = await this.page.evaluate(() => {
                // 검색 버튼 찾기
                const searchElements = [
                    ...document.querySelectorAll('input[type="submit"]'),
                    ...document.querySelectorAll('input[type="button"]'),
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('img[alt*="검색"]'),
                    ...document.querySelectorAll('a[href*="search"]'),
                    ...document.querySelectorAll('[onclick*="search"]')
                ];

                for (const element of searchElements) {
                    const text = element.value || element.textContent || element.alt || '';
                    if (text.includes('검색') || text.includes('조회')) {
                        element.click();
                        return true;
                    }
                }
                return false;
            });

            if (!searchClicked) {
                throw new Error('검색 버튼을 찾을 수 없습니다');
            }

            // 검색 결과 로딩 대기
            console.log('⏳ 검색 결과 로딩 대기...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // 검색 결과 확인
            const hasResults = await this.page.evaluate(() => {
                const text = document.body.textContent;
                return text.includes('사건번호') || 
                       text.includes('물건') || 
                       text.includes('감정가') ||
                       text.includes('최저가') ||
                       text.includes('법원');
            });

            if (hasResults) {
                console.log('✅ 검색 결과 확인됨');
                return true;
            } else {
                throw new Error('검색 결과가 없거나 로딩되지 않음');
            }
            
        } catch (error) {
            console.error('❌ 검색 실행 실패:', error.message);
            return false;
        }
    }

    async scrapeAllPages() {
        console.log('📚 모든 페이지 데이터 수집 시작...');
        
        let allProperties = [];
        let currentPage = 1;
        let hasNextPage = true;
        
        while (hasNextPage && currentPage <= 500) { // 최대 500페이지
            console.log(`📖 페이지 ${currentPage} 수집 중...`);
            
            try {
                // 현재 페이지 데이터 추출
                const pageData = await this.extractCurrentPageData();
                
                if (pageData.length > 0) {
                    allProperties = allProperties.concat(pageData);
                    console.log(`   ✅ ${pageData.length}개 데이터 수집 (총 ${allProperties.length}개)`);
                    
                    // 다음 페이지로 이동
                    hasNextPage = await this.goToNextPage();
                    currentPage++;
                    
                    if (hasNextPage) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 페이지 로딩 대기
                    }
                } else {
                    console.log('   ⚠️ 페이지에서 데이터를 찾을 수 없음');
                    hasNextPage = false;
                }
                
            } catch (error) {
                console.error(`❌ 페이지 ${currentPage} 처리 실패:`, error.message);
                hasNextPage = false;
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
            
            // 경매 데이터가 있는 테이블 찾기
            for (const table of tables) {
                const text = table.textContent;
                if ((text.includes('사건번호') || text.includes('물건')) && 
                    text.includes('법원') && table.querySelectorAll('tr').length > 2) {
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
            const headerRow = rows[0];
            const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
                cell.textContent.trim()
            );

            // 열 매핑
            const columnMap = {};
            headers.forEach((header, index) => {
                const h = header.toLowerCase();
                if (h.includes('사건') || h.includes('번호')) columnMap.caseNumber = index;
                if (h.includes('법원')) columnMap.court = index;
                if (h.includes('물건') || h.includes('종류') || h.includes('용도')) columnMap.type = index;
                if (h.includes('주소') || h.includes('소재')) columnMap.address = index;
                if (h.includes('감정') || h.includes('평가')) columnMap.appraisal = index;
                if (h.includes('최저') || h.includes('최소') || h.includes('매각')) columnMap.minimum = index;
                if (h.includes('기일') || h.includes('일시') || h.includes('날짜')) columnMap.date = index;
                if (h.includes('상태') || h.includes('진행')) columnMap.status = index;
            });

            // 데이터 추출
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                
                if (cells.length < 3) continue;
                
                const getText = (index) => {
                    if (index >= 0 && cells[index]) {
                        return cells[index].textContent.replace(/\s+/g, ' ').trim();
                    }
                    return '';
                };
                
                // 사건번호로 유효성 검사
                const caseNumber = getText(columnMap.caseNumber) || getText(0);
                if (!caseNumber || caseNumber.length < 3) continue;

                const property = {
                    case_number: caseNumber,
                    court_name: getText(columnMap.court) || getText(1) || '',
                    property_type: getText(columnMap.type) || getText(2) || '',
                    address: getText(columnMap.address) || getText(3) || '',
                    appraisal_value: getText(columnMap.appraisal) || getText(4) || '',
                    minimum_sale_price: getText(columnMap.minimum) || getText(5) || '',
                    auction_date: getText(columnMap.date) || getText(6) || '',
                    current_status: getText(columnMap.status) || getText(7) || 'active',
                    scraped_at: new Date().toISOString(),
                    is_real_data: true
                };

                // 최소한의 유효성 검사
                if (property.address && property.address.length >= 5) {
                    properties.push(property);
                }
            }

            return properties;
        });
    }

    async goToNextPage() {
        try {
            return await this.page.evaluate(() => {
                // 다양한 다음 페이지 버튼 패턴 찾기
                const nextElements = [
                    ...document.querySelectorAll('a'),
                    ...document.querySelectorAll('img'),
                    ...document.querySelectorAll('input[type="button"]'),
                    ...document.querySelectorAll('input[type="submit"]')
                ];

                for (const element of nextElements) {
                    const text = element.textContent || element.alt || element.value || '';
                    const href = element.href || '';
                    
                    if (text.includes('다음') || text.includes('Next') || text.includes('▶') ||
                        text.includes('→') || href.includes('next') || 
                        element.className.includes('next')) {
                        element.click();
                        return true;
                    }
                }

                // 페이지 번호 링크 찾기 (현재 페이지 + 1)
                const pageLinks = document.querySelectorAll('a[href*="page"]');
                for (const link of pageLinks) {
                    const pageNum = parseInt(link.textContent.trim());
                    if (!isNaN(pageNum)) {
                        link.click();
                        return true;
                    }
                }

                return false;
            });
        } catch (error) {
            console.error('다음 페이지 이동 실패:', error.message);
            return false;
        }
    }

    async saveCollectedData(properties) {
        if (properties.length === 0) {
            console.log('💾 저장할 데이터가 없습니다.');
            return;
        }

        console.log(`💾 ${properties.length}개 데이터 스마트 업데이트 중...`);

        // 현재 페이지 URL 가져오기
        const currentUrl = await this.page.url();
        
        // 데이터 정제
        const cleanedProperties = properties.map(prop => ({
            case_number: prop.case_number.replace(/\s+/g, '').trim(),
            court_name: prop.court_name || '정보없음',
            property_type: this.parsePropertyType(prop.property_type),
            address: prop.address.replace(/\s+/g, ' ').trim(),
            appraisal_value: this.parseAmount(prop.appraisal_value),
            minimum_sale_price: this.parseAmount(prop.minimum_sale_price),
            auction_date: this.parseDate(prop.auction_date),
            current_status: 'active',
            source_url: currentUrl || 'court-scraper',
            scraped_at: new Date().toISOString(),
            is_real_data: true
        }));

        // 유효한 데이터만 필터링
        const validProperties = cleanedProperties.filter(prop => 
            prop.case_number && prop.case_number.length >= 3 &&
            prop.address && prop.address.length >= 5
        );

        console.log(`✅ ${validProperties.length}개 유효한 데이터 정제 완료`);

        // 스마트 중복 방지 업데이트
        const updater = new SmartDedupUpdater();
        const result = await updater.processSmartUpdate(validProperties, 'real-court-scraper');
        
        this.totalCollected = result.new + result.updated;
        
        console.log(`🎊 데이터 저장 완료:`);
        console.log(`   ✨ 신규: ${result.new}개`);
        console.log(`   🔄 업데이트: ${result.updated}개`);
        console.log(`   🔄 중복: ${result.duplicate}개`);
        console.log(`   ⚠️ 스킵: ${result.skipped}개`);

        return result;
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
            '창고': '창고',
            '임야': '임야',
            '전답': '농지',
            '답': '농지',
            '전': '농지'
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
            console.log('\n⏳ 10초 후 브라우저를 닫습니다... (수동으로 확인하고 싶으면 Ctrl+C로 중단)');
            await new Promise(resolve => setTimeout(resolve, 10000));
            await this.browser.close();
        }
    }

    async run() {
        const startTime = new Date();
        
        try {
            await this.init();
            
            // 1단계: 사이트 접속
            const siteAccess = await this.navigateToSite();
            if (!siteAccess) throw new Error('사이트 접속 실패');

            console.log('\n🎯 수동으로 다수관심물건/다수조회물건 메뉴에 접근해주세요');
            console.log('1. 경매물건 메뉴 클릭');
            console.log('2. 다수관심물건 또는 다수조회물건 클릭');
            console.log('3. 검색 조건을 전체/전국으로 설정');
            console.log('4. 검색 버튼 클릭');
            console.log('5. 검색 결과가 나타나면 아무 키나 눌러주세요\n');

            // 사용자 입력 대기
            await new Promise(resolve => {
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                rl.question('검색 결과가 표시되면 Enter를 눌러 자동 수집을 시작하세요...', () => {
                    rl.close();
                    resolve();
                });
            });

            // 2단계: 모든 페이지 데이터 수집
            const allData = await this.scrapeAllPages();

            // 3단계: 데이터 저장
            const saveResult = await this.saveCollectedData(allData);

            // 완료 리포트
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            
            console.log('\n🎉 실제 법원경매정보 전체 수집 완료!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`⏱️  총 소요시간: ${duration}초`);
            console.log(`📊 총 수집량: ${allData.length}개`);
            console.log(`✨ 신규 추가: ${saveResult?.new || 0}개`);
            console.log(`🔄 업데이트: ${saveResult?.updated || 0}개`);
            console.log(`🔄 중복 건너뜀: ${saveResult?.duplicate || 0}개`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌐 웹사이트에서 확인: http://localhost:3002`);

        } catch (error) {
            console.error('\n❌ 수집 실패:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// 실행
if (require.main === module) {
    const scraper = new RealCourtDataScraper();
    
    scraper.run()
        .then(() => {
            console.log('\n🎊 실제 법원경매정보 전체 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { RealCourtDataScraper };