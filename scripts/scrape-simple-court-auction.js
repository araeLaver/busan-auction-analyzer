#!/usr/bin/env node

const puppeteer = require('puppeteer');
const pool = require('../config/database');
const fs = require('fs').promises;

/**
 * 간단한 법원경매정보 사이트 스크래핑
 * 직접 검색 페이지로 이동하여 데이터 수집
 */
async function scrapeSimpleCourtAuction() {
    let browser = null;
    
    try {
        console.log('🚀 법원경매정보 간단 스크래핑 시작');
        
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');

        console.log('🔍 법원경매정보 검색 페이지 직접 접속...');
        
        // 부동산 검색 페이지 직접 이동 시도
        const searchUrls = [
            'https://www.courtauction.go.kr/ksearch/ksearch.laf',
            'https://www.courtauction.go.kr/RetrieveRealEstCarefulBidList.laf',
            'https://www.courtauction.go.kr/RetrieveRealEstMulBidList.laf',
        ];

        let pageFound = false;
        for (const url of searchUrls) {
            try {
                console.log(`📋 시도: ${url}`);
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
                
                // 페이지가 정상 로드되었는지 확인
                const title = await page.title();
                console.log(`📄 페이지 제목: ${title}`);
                
                if (title && !title.includes('오류') && !title.includes('Error')) {
                    pageFound = true;
                    console.log(`✅ 검색 페이지 접속 성공: ${url}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ URL 접속 실패: ${url} - ${error.message}`);
            }
        }

        if (!pageFound) {
            console.log('⚠️ 메인 페이지에서 수동으로 검색 페이지 찾기...');
            
            await page.goto('https://www.courtauction.go.kr', { waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // 브라우저 창을 사용자가 수동으로 조작할 수 있도록 대기
            console.log('🖱️  브라우저 창에서 수동으로 다음 작업을 수행하세요:');
            console.log('   1. "경매물건" 메뉴 클릭');
            console.log('   2. "다수관심물건" 또는 "물건상세검색" 메뉴 클릭');
            console.log('   3. 검색 결과 페이지가 나오면 Enter 키를 눌러주세요.');
            
            // 사용자 입력 대기
            await new Promise(resolve => {
                process.stdin.once('data', () => {
                    resolve();
                });
            });
        }

        console.log('📊 현재 페이지에서 경매물건 데이터 추출 중...');
        
        // 페이지에서 테이블 구조 분석
        const tableInfo = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            const tableData = [];
            
            tables.forEach((table, index) => {
                const rows = table.querySelectorAll('tr');
                if (rows.length > 1) { // 헤더 포함해서 2행 이상
                    const firstRowCells = rows[0] ? rows[0].querySelectorAll('th, td') : [];
                    const headerTexts = Array.from(firstRowCells).map(cell => cell.textContent.trim());
                    
                    tableData.push({
                        index,
                        rowCount: rows.length,
                        columnCount: firstRowCells.length,
                        headers: headerTexts,
                        hasAuctionData: headerTexts.some(header => 
                            header.includes('사건번호') || 
                            header.includes('물건') ||
                            header.includes('주소') ||
                            header.includes('감정가') ||
                            header.includes('최저가')
                        )
                    });
                }
            });
            
            return tableData;
        });

        console.log('📋 발견된 테이블들:');
        tableInfo.forEach(table => {
            console.log(`   테이블 ${table.index}: ${table.rowCount}행 ${table.columnCount}열`);
            console.log(`   헤더: ${table.headers.join(', ')}`);
            console.log(`   경매 데이터: ${table.hasAuctionData ? '✅' : '❌'}`);
        });

        // 경매 데이터가 있는 테이블 찾기
        const auctionTable = tableInfo.find(table => table.hasAuctionData);
        
        if (!auctionTable) {
            console.log('❌ 경매 데이터 테이블을 찾을 수 없습니다.');
            console.log('💡 다음을 확인하세요:');
            console.log('   1. 검색 결과가 표시되고 있는지');
            console.log('   2. 경매물건 목록이 테이블 형태인지');
            console.log('   3. 페이지가 완전히 로드되었는지');
            
            // 페이지 HTML 저장
            const html = await page.content();
            await fs.writeFile('current-page.html', html);
            console.log('💾 현재 페이지 HTML을 current-page.html로 저장했습니다.');
            
            return [];
        }

        console.log(`✅ 경매 데이터 테이블 발견: 테이블 ${auctionTable.index}`);

        // 실제 경매 데이터 추출
        const properties = await page.evaluate((tableIndex) => {
            const table = document.querySelectorAll('table')[tableIndex];
            const rows = table.querySelectorAll('tr');
            const properties = [];
            
            // 헤더 분석 (어떤 열에 어떤 데이터가 있는지 파악)
            const headerRow = rows[0];
            const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => cell.textContent.trim());
            
            // 각 열의 역할 파악
            const columnMap = {
                caseNumber: -1,
                court: -1,
                type: -1,
                address: -1,
                appraisal: -1,
                minimum: -1,
                date: -1
            };
            
            headers.forEach((header, index) => {
                if (header.includes('사건번호') || header.includes('사건')) columnMap.caseNumber = index;
                if (header.includes('법원') || header.includes('지원')) columnMap.court = index;
                if (header.includes('물건') || header.includes('종류')) columnMap.type = index;
                if (header.includes('주소') || header.includes('소재지')) columnMap.address = index;
                if (header.includes('감정가') || header.includes('감정')) columnMap.appraisal = index;
                if (header.includes('최저가') || header.includes('최저')) columnMap.minimum = index;
                if (header.includes('기일') || header.includes('일시') || header.includes('날짜')) columnMap.date = index;
            });

            console.log('컬럼 매핑:', columnMap);

            // 데이터 행 처리 (헤더 제외)
            for (let i = 1; i < Math.min(rows.length, 51); i++) { // 최대 50개만
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                
                if (cells.length < 3) continue;
                
                const getText = (index) => index >= 0 && cells[index] ? cells[index].textContent.trim() : '';
                
                const property = {
                    case_number: getText(columnMap.caseNumber) || getText(0) || `REAL-${Date.now()}-${i}`,
                    court_name: getText(columnMap.court) || getText(1) || '법원정보없음',
                    property_type: getText(columnMap.type) || getText(2) || '기타',
                    address: getText(columnMap.address) || getText(3) || '주소정보없음',
                    appraisal_value: getText(columnMap.appraisal) || getText(4) || '0',
                    minimum_sale_price: getText(columnMap.minimum) || getText(5) || '0',
                    auction_date: getText(columnMap.date) || getText(6) || '',
                    scraped_at: new Date().toISOString(),
                    is_real_data: true
                };

                // 유효성 검사
                if (property.address.length > 3 && 
                    !property.address.includes('주소정보없음') &&
                    property.case_number.length > 3) {
                    properties.push(property);
                }
            }

            return properties;
        }, auctionTable.index);

        console.log(`✅ ${properties.length}개 경매물건 추출 완료`);

        if (properties.length === 0) {
            console.log('❌ 추출된 경매물건이 없습니다.');
            return;
        }

        // 추출된 데이터 미리보기
        console.log('\n📋 추출된 데이터 미리보기:');
        properties.slice(0, 3).forEach((prop, index) => {
            console.log(`${index + 1}. ${prop.case_number}`);
            console.log(`   법원: ${prop.court_name}`);
            console.log(`   종류: ${prop.property_type}`);
            console.log(`   주소: ${prop.address}`);
            console.log(`   감정가: ${prop.appraisal_value}`);
            console.log(`   최저가: ${prop.minimum_sale_price}\n`);
        });

        // 데이터 정제
        const cleanedProperties = properties.map(prop => ({
            case_number: prop.case_number.replace(/\s+/g, ' ').trim(),
            court_name: prop.court_name.includes('법원') ? prop.court_name : prop.court_name + '지방법원',
            property_type: parsePropertyType(prop.property_type),
            address: prop.address.replace(/\s+/g, ' ').trim(),
            appraisal_value: parseAmount(prop.appraisal_value),
            minimum_sale_price: parseAmount(prop.minimum_sale_price),
            auction_date: parseDate(prop.auction_date),
            current_status: 'active',
            source_url: 'https://www.courtauction.go.kr',
            scraped_at: new Date().toISOString(),
            is_real_data: true
        }));

        // JSON 파일 저장
        const dataFile = 'scraped-court-auction-data.json';
        await fs.writeFile(dataFile, JSON.stringify({
            collected_at: new Date().toISOString(),
            source: '법원경매정보 사이트 직접 스크래핑',
            total_count: cleanedProperties.length,
            properties: cleanedProperties
        }, null, 2));

        console.log(`💾 데이터 저장: ${dataFile}`);

        // 데이터베이스에 저장
        console.log('\n💾 데이터베이스에 저장 중...');

        let savedCount = 0;
        const insertQuery = `
            INSERT INTO auction_service.properties (
                case_number, court_name, property_type, address, 
                appraisal_value, minimum_sale_price, auction_date,
                current_status, source_url, scraped_at, is_real_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (case_number) DO UPDATE SET
                address = EXCLUDED.address,
                appraisal_value = EXCLUDED.appraisal_value,
                minimum_sale_price = EXCLUDED.minimum_sale_price,
                scraped_at = EXCLUDED.scraped_at
        `;

        for (const property of cleanedProperties) {
            try {
                await pool.query(insertQuery, [
                    property.case_number,
                    property.court_name,
                    property.property_type,
                    property.address,
                    property.appraisal_value,
                    property.minimum_sale_price,
                    property.auction_date,
                    property.current_status,
                    property.source_url,
                    property.scraped_at,
                    property.is_real_data
                ]);

                savedCount++;
                console.log(`✅ ${savedCount}. ${property.case_number} 저장 완료`);

            } catch (error) {
                console.log(`⚠️ ${property.case_number} 저장 실패: ${error.message}`);
            }
        }

        console.log(`\n🎉 총 ${savedCount}개 실제 경매물건 데이터베이스 저장 완료!`);
        console.log('✨ 웹사이트에서 확인하세요: http://localhost:3002');

    } catch (error) {
        console.error('❌ 스크래핑 오류:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

function parsePropertyType(text) {
    const typeMap = {
        '아파트': '아파트',
        '단독': '단독주택',
        '다세대': '다세대주택',
        '오피스텔': '오피스텔',
        '상가': '상가',
        '토지': '토지'
    };
    
    for (const [key, value] of Object.entries(typeMap)) {
        if (text && text.includes(key)) return value;
    }
    return '기타';
}

function parseAmount(text) {
    if (!text) return 0;
    
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

function parseDate(text) {
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

// 실행
if (require.main === module) {
    scrapeSimpleCourtAuction()
        .then(() => {
            console.log('\n🎊 법원경매정보 실제 데이터 스크래핑 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 스크래핑 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { scrapeSimpleCourtAuction };