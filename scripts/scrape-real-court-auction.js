#!/usr/bin/env node

const CourtAuctionScraper = require('../src/scraper/CourtAuctionScraper');
const pool = require('../config/database');

/**
 * 법원경매정보 사이트에서 실제 경매물건 데이터 스크래핑
 */
async function scrapeRealCourtAuction() {
    const scraper = new CourtAuctionScraper();
    
    try {
        console.log('🚀 법원경매정보 실제 데이터 스크래핑 시작');
        console.log('📍 다수 관심물건 메뉴에서 데이터 수집 중...\n');
        
        // 스크래퍼 초기화
        await scraper.initialize();
        
        console.log('⏳ 브라우저가 열렸습니다. 법원경매정보 사이트에 접속 중...');
        console.log('💡 팁: 브라우저 창에서 스크래핑 과정을 실시간으로 확인할 수 있습니다.\n');
        
        // 실제 경매물건 데이터 스크래핑
        const rawProperties = await scraper.scrapeMultipleInterestProperties();
        
        if (rawProperties.length === 0) {
            console.log('❌ 스크래핑된 데이터가 없습니다.');
            console.log('💡 수동으로 확인해보세요:');
            console.log('   1. 브라우저에서 법원경매정보 사이트가 정상 접속되었는지 확인');
            console.log('   2. "다수 관심물건" 메뉴나 검색 결과가 표시되는지 확인');
            console.log('   3. 경매물건 목록 테이블이 있는지 확인');
            return;
        }
        
        console.log(`\n✅ ${rawProperties.length}개 원시 데이터 수집 완료`);
        
        // 데이터 정제 및 포맷팅
        const formattedProperties = scraper.formatProperties(rawProperties);
        console.log(`🔧 ${formattedProperties.length}개 데이터 포맷팅 완료`);
        
        // JSON 파일로 저장
        const savedFile = await scraper.saveResults(formattedProperties);
        
        // 유효한 데이터만 필터링
        const validProperties = formattedProperties.filter(prop => 
            prop.address.length > 10 && 
            prop.minimum_sale_price > 0 &&
            !prop.case_number.includes('REAL-')
        );
        
        if (validProperties.length === 0) {
            console.log('❌ 유효한 경매물건 데이터가 없습니다.');
            console.log('💡 수집된 데이터를 확인해보세요:', savedFile);
            return;
        }
        
        console.log(`\n📊 유효한 데이터: ${validProperties.length}개`);
        
        // 데이터베이스에 저장
        console.log('\n💾 데이터베이스 저장 중...');
        
        const insertQuery = `
            INSERT INTO auction_service.properties (
                case_number, court_name, property_type, address, 
                appraisal_value, minimum_sale_price, auction_date,
                current_status, source_url, scraped_at, is_real_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (case_number) DO UPDATE SET
                court_name = EXCLUDED.court_name,
                property_type = EXCLUDED.property_type,
                address = EXCLUDED.address,
                appraisal_value = EXCLUDED.appraisal_value,
                minimum_sale_price = EXCLUDED.minimum_sale_price,
                auction_date = EXCLUDED.auction_date,
                current_status = EXCLUDED.current_status,
                scraped_at = EXCLUDED.scraped_at,
                is_real_data = EXCLUDED.is_real_data
        `;
        
        let savedCount = 0;
        let skippedCount = 0;
        
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
                console.log(`✅ ${savedCount}. ${property.case_number} - ${property.address.substring(0, 50)}...`);
                
            } catch (error) {
                skippedCount++;
                console.log(`⚠️ 스킵: ${property.case_number} - ${error.message.substring(0, 50)}`);
            }
        }
        
        console.log(`\n🎉 데이터베이스 저장 완료!`);
        console.log(`   - 저장됨: ${savedCount}개`);
        console.log(`   - 스킵됨: ${skippedCount}개`);
        
        // 저장된 데이터 통계 출력
        const statsQuery = `
            SELECT 
                COUNT(*) as total_count,
                COUNT(*) FILTER (WHERE is_real_data = true) as real_data_count,
                COUNT(DISTINCT court_name) as court_count,
                COUNT(DISTINCT property_type) as type_count
            FROM auction_service.properties
        `;
        
        const statsResult = await pool.query(statsQuery);
        const stats = statsResult.rows[0];
        
        console.log(`\n📈 현재 데이터베이스 통계:`);
        console.log(`   - 전체 물건: ${stats.total_count}개`);
        console.log(`   - 실제 데이터: ${stats.real_data_count}개`);
        console.log(`   - 법원 수: ${stats.court_count}개`);
        console.log(`   - 물건 유형: ${stats.type_count}개`);
        
        // 지역별 통계
        const regionStats = await pool.query(`
            SELECT court_name, COUNT(*) as count 
            FROM auction_service.properties 
            WHERE is_real_data = true 
            GROUP BY court_name 
            ORDER BY count DESC
            LIMIT 10
        `);
        
        if (regionStats.rows.length > 0) {
            console.log(`\n🏛️ 법원별 통계:`);
            regionStats.rows.forEach(row => {
                console.log(`   - ${row.court_name}: ${row.count}개`);
            });
        }
        
        console.log(`\n✨ 성공! 웹사이트에서 실제 경매물건을 확인하세요: http://localhost:3002`);
        
    } catch (error) {
        console.error('❌ 스크래핑 실패:', error);
        
        if (error.message.includes('다수 관심물건 메뉴를 찾을 수 없습니다')) {
            console.log('\n💡 해결 방법:');
            console.log('   1. 브라우저에서 https://www.courtauction.go.kr 직접 접속');
            console.log('   2. "다수 관심물건" 또는 "부동산 검색" 메뉴 찾기');
            console.log('   3. 해당 메뉴의 정확한 URL 확인 후 스크립트 수정');
        }
        
        throw error;
    } finally {
        await scraper.close();
    }
}

// 실행
if (require.main === module) {
    scrapeRealCourtAuction()
        .then(() => {
            console.log('\n🎊 법원경매정보 실제 데이터 스크래핑 완료!');
            console.log('💡 이제 웹사이트에 진짜 경매물건이 표시됩니다.');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 스크래핑 중 오류 발생:', error.message);
            console.log('\n🔍 문제 해결을 위해 다음을 확인하세요:');
            console.log('   1. 인터넷 연결 상태');
            console.log('   2. 법원경매정보 사이트 접속 가능 여부');
            console.log('   3. Puppeteer 브라우저 실행 권한');
            process.exit(1);
        });
}

module.exports = { scrapeRealCourtAuction };