#!/usr/bin/env node

const puppeteer = require('puppeteer');
const pool = require('../config/database');
const fs = require('fs').promises;

/**
 * 수동 법원경매정보 데이터 수집
 * 사용자가 직접 브라우저에서 검색 후 스크래핑
 */
async function manualCourtScraper() {
    let browser = null;
    
    try {
        console.log('🚀 법원경매정보 수동 데이터 수집 시작');
        console.log('📱 브라우저가 열리면 다음 단계를 따라하세요:\n');

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--start-maximized'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');

        console.log('🌐 법원경매정보 사이트로 이동...');
        await page.goto('https://www.courtauction.go.kr', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });

        console.log('✅ 법원경매정보 사이트 접속 완료!\n');
        console.log('🎯 이제 다음 단계를 수행하세요:');
        console.log('   1. 🖱️  "경매물건" 메뉴 클릭');
        console.log('   2. 🔍 "다수관심물건" 또는 "물건상세검색" 메뉴 선택');
        console.log('   3. 📝 검색 조건 설정 (지역: 부산, 물건종류: 부동산 등)');
        console.log('   4. 🔍 "검색" 버튼 클릭하여 검색 결과 확인');
        console.log('   5. ✅ 경매물건 목록이 나타나면 아무 키나 눌러주세요.\n');

        console.log('⏳ 경매물건 목록이 표시될 때까지 대기 중...');
        console.log('💡 검색 결과가 나오면 아무 키나 눌러주세요.');

        // 사용자 입력 대기 (stdin.setRawMode 대신 readline 사용)
        await new Promise(resolve => {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question('검색 결과가 표시되면 Enter키를 눌러주세요...', () => {
                rl.close();
                resolve();
            });
        });

        console.log('\n📊 현재 페이지에서 경매물건 데이터 분석 중...');

        // 현재 페이지 정보 확인
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                tableCount: document.querySelectorAll('table').length,
                hasData: document.body.innerText.includes('사건번호') || 
                         document.body.innerText.includes('경매') ||
                         document.body.innerText.includes('물건')
            };
        });

        console.log(`📄 현재 페이지: ${pageInfo.title}`);
        console.log(`🔗 URL: ${pageInfo.url}`);
        console.log(`📋 테이블 개수: ${pageInfo.tableCount}`);
        console.log(`📊 경매 데이터: ${pageInfo.hasData ? '✅ 감지됨' : '❌ 없음'}`);

        if (!pageInfo.hasData) {
            console.log('\n❌ 경매 데이터가 감지되지 않았습니다.');
            console.log('💡 다음을 확인하세요:');
            console.log('   - 검색 결과가 정상적으로 표시되었는지');
            console.log('   - 경매물건 목록 테이블이 있는지');
            console.log('   - 페이지가 완전히 로드되었는지');
            
            // 현재 페이지 저장
            const html = await page.content();
            await fs.writeFile('manual-scraper-page.html', html);
            console.log('💾 현재 페이지를 manual-scraper-page.html로 저장했습니다.');
            return;
        }

        // 테이블 구조 상세 분석
        const tableAnalysis = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            const analysis = [];
            
            tables.forEach((table, index) => {
                const rows = table.querySelectorAll('tr');
                if (rows.length > 1) {
                    const headerRow = rows[0];
                    const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
                        cell.textContent.trim()
                    );
                    
                    // 경매 관련 키워드 체크
                    const auctionKeywords = ['사건번호', '물건', '주소', '감정가', '최저가', '법원', '경매', '기일'];
                    const hasAuctionKeywords = headers.some(header => 
                        auctionKeywords.some(keyword => header.includes(keyword))
                    );
                    
                    if (hasAuctionKeywords || headers.length >= 5) {
                        // 샘플 데이터 행 추출
                        const sampleData = [];
                        for (let i = 1; i < Math.min(rows.length, 4); i++) {
                            const cells = Array.from(rows[i].querySelectorAll('td')).map(cell => 
                                cell.textContent.trim().substring(0, 30) + (cell.textContent.trim().length > 30 ? '...' : '')
                            );
                            if (cells.length > 0) {
                                sampleData.push(cells);
                            }
                        }
                        
                        analysis.push({
                            index,
                            rowCount: rows.length,
                            columnCount: headers.length,
                            headers,
                            hasAuctionKeywords,
                            sampleData
                        });
                    }
                }
            });
            
            return analysis;
        });

        console.log('\n📊 경매 데이터 테이블 분석 결과:');
        tableAnalysis.forEach(table => {
            console.log(`\n테이블 ${table.index}:`);
            console.log(`  📏 크기: ${table.rowCount}행 × ${table.columnCount}열`);
            console.log(`  📋 헤더: ${table.headers.join(' | ')}`);
            console.log(`  🎯 경매 키워드: ${table.hasAuctionKeywords ? '✅' : '❌'}`);
            
            if (table.sampleData.length > 0) {
                console.log(`  📄 샘플 데이터:`);
                table.sampleData.forEach((row, idx) => {
                    console.log(`    ${idx + 1}. ${row.join(' | ')}`);
                });
            }
        });

        // 가장 적합한 테이블 선택
        const bestTable = tableAnalysis.find(table => table.hasAuctionKeywords) || 
                          tableAnalysis.find(table => table.columnCount >= 5);

        if (!bestTable) {
            console.log('\n❌ 적합한 경매 데이터 테이블을 찾을 수 없습니다.');
            return;
        }

        console.log(`\n✅ 테이블 ${bestTable.index}를 사용하여 데이터 추출합니다.`);

        // 실제 데이터 추출
        const properties = await page.evaluate((tableIndex, headers) => {
            const table = document.querySelectorAll('table')[tableIndex];
            const rows = table.querySelectorAll('tr');
            const properties = [];
            
            // 헤더 매핑
            const columnMap = {};
            headers.forEach((header, index) => {
                if (header.includes('사건') || header.includes('번호')) columnMap.caseNumber = index;
                if (header.includes('법원')) columnMap.court = index;
                if (header.includes('물건') || header.includes('종류')) columnMap.type = index;
                if (header.includes('주소') || header.includes('소재')) columnMap.address = index;
                if (header.includes('감정')) columnMap.appraisal = index;
                if (header.includes('최저') || header.includes('최소')) columnMap.minimum = index;
                if (header.includes('기일') || header.includes('일시') || header.includes('날짜')) columnMap.date = index;
            });

            // 데이터 추출 (최대 100개)
            for (let i = 1; i < Math.min(rows.length, 101); i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                
                if (cells.length < 3) continue;
                
                const getText = (index) => {
                    return index >= 0 && cells[index] ? cells[index].textContent.trim() : '';
                };
                
                const property = {
                    case_number: getText(columnMap.caseNumber) || getText(0) || `MANUAL-${Date.now()}-${i}`,
                    court_name: getText(columnMap.court) || getText(1) || '',
                    property_type: getText(columnMap.type) || getText(2) || '',
                    address: getText(columnMap.address) || getText(3) || '',
                    appraisal_value: getText(columnMap.appraisal) || getText(4) || '',
                    minimum_sale_price: getText(columnMap.minimum) || getText(5) || '',
                    auction_date: getText(columnMap.date) || getText(6) || '',
                    scraped_at: new Date().toISOString(),
                    is_real_data: true
                };

                // 유효성 검사: 주소가 5자 이상이고 사건번호가 있으면 유효
                if (property.address.length >= 5 && property.case_number.length >= 3) {
                    properties.push(property);
                }
            }

            return properties;
        }, bestTable.index, bestTable.headers);

        console.log(`\n✅ ${properties.length}개 경매물건 추출 완료!`);

        if (properties.length === 0) {
            console.log('❌ 유효한 데이터가 추출되지 않았습니다.');
            return;
        }

        // 추출된 데이터 미리보기
        console.log('\n📋 추출된 데이터 미리보기 (처음 5개):');
        properties.slice(0, 5).forEach((prop, index) => {
            console.log(`\n${index + 1}. ${prop.case_number}`);
            console.log(`   법원: ${prop.court_name}`);
            console.log(`   종류: ${prop.property_type}`);
            console.log(`   주소: ${prop.address}`);
            console.log(`   감정가: ${prop.appraisal_value}`);
            console.log(`   최저가: ${prop.minimum_sale_price}`);
        });

        // 데이터 정제 및 포맷팅
        const cleanedProperties = properties.map(prop => ({
            case_number: prop.case_number.replace(/\s+/g, '').trim(),
            court_name: prop.court_name || '법원정보없음',
            property_type: parsePropertyType(prop.property_type),
            address: prop.address.replace(/\s+/g, ' ').trim(),
            appraisal_value: parseAmount(prop.appraisal_value),
            minimum_sale_price: parseAmount(prop.minimum_sale_price),
            auction_date: parseDate(prop.auction_date),
            current_status: 'active',
            source_url: pageInfo.url,
            scraped_at: new Date().toISOString(),
            is_real_data: true
        }));

        // 유효한 데이터만 필터링
        const validProperties = cleanedProperties.filter(prop => 
            prop.address.length > 5 && 
            (prop.minimum_sale_price > 0 || prop.appraisal_value > 0)
        );

        console.log(`\n🔧 ${validProperties.length}개 유효한 데이터 정제 완료`);

        if (validProperties.length === 0) {
            console.log('❌ 유효한 데이터가 없습니다.');
            return;
        }

        // JSON 파일 저장
        const dataFile = 'manual-scraped-court-data.json';
        await fs.writeFile(dataFile, JSON.stringify({
            collected_at: new Date().toISOString(),
            source_url: pageInfo.url,
            source_title: pageInfo.title,
            total_count: validProperties.length,
            properties: validProperties
        }, null, 2));

        console.log(`💾 데이터 파일 저장: ${dataFile}`);

        // 데이터베이스 저장
        console.log('\n💾 데이터베이스에 저장 중...');
        
        // 기존 데이터 삭제 (실제 데이터로 교체)
        await pool.query('DELETE FROM auction_service.properties WHERE is_real_data = true');
        console.log('🗑️  기존 실제 데이터 삭제');

        const insertQuery = `
            INSERT INTO auction_service.properties (
                case_number, court_name, property_type, address, 
                appraisal_value, minimum_sale_price, auction_date,
                current_status, source_url, scraped_at, is_real_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        let savedCount = 0;
        for (const property of validProperties) {
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
                console.log(`✅ ${savedCount}. ${property.case_number} - ${property.address.substring(0, 30)}${property.address.length > 30 ? '...' : ''}`);

            } catch (error) {
                console.log(`⚠️ 저장 실패: ${property.case_number} - ${error.message}`);
            }
        }

        // 저장 완료 통계
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT court_name) as courts,
                COUNT(DISTINCT property_type) as types
            FROM auction_service.properties 
            WHERE is_real_data = true
        `);

        const statData = stats.rows[0];

        console.log(`\n🎉 법원경매정보 실제 데이터 수집 완료!`);
        console.log(`   📊 총 저장된 물건: ${savedCount}개`);
        console.log(`   🏛️  법원 수: ${statData.courts}개`);
        console.log(`   🏠 물건 유형: ${statData.types}개`);
        console.log(`\n✨ 웹사이트에서 실제 경매물건을 확인하세요:`);
        console.log(`   🌐 http://localhost:3002`);

    } catch (error) {
        console.error('❌ 스크래핑 오류:', error);
        throw error;
    } finally {
        if (browser) {
            console.log('\n⏳ 5초 후 브라우저를 닫습니다...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await browser.close();
        }
    }
}

// 유틸리티 함수들
function parsePropertyType(text) {
    if (!text) return '기타';
    
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
        if (text.includes(key)) return value;
    }
    
    return '기타';
}

function parseAmount(text) {
    if (!text) return 0;
    
    let amount = 0;
    const cleanText = text.replace(/[^\d억만원,]/g, '');
    
    if (cleanText.includes('억')) {
        const match = cleanText.match(/(\d+)억/);
        if (match) amount += parseInt(match[1]) * 100000000;
    }
    
    if (cleanText.includes('만')) {
        const match = cleanText.match(/(\d+)만/);
        if (match) amount += parseInt(match[1]) * 10000;
    }
    
    if (amount === 0) {
        const match = cleanText.replace(/[,원]/g, '').match(/\d+/);
        if (match) amount = parseInt(match[0]);
    }
    
    return amount;
}

function parseDate(text) {
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

// 실행
if (require.main === module) {
    manualCourtScraper()
        .then(() => {
            console.log('\n🎊 실제 법원경매 데이터 수집 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 수집 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { manualCourtScraper };