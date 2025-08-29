#!/usr/bin/env node

const RealApiScraper = require('../src/scraper/RealApiScraper');
const fs = require('fs').promises;

/**
 * 실제 경매 데이터 수집 및 분석
 */
async function collectRealData() {
    const scraper = new RealApiScraper();
    
    try {
        console.log('🔄 실제 경매 데이터 수집 시작');
        
        // 1. 다양한 검색 조건으로 시도
        const searchConditions = [
            { sdCtcd: '26', sdNm: '부산광역시' }, // 부산
            { sdCtcd: '11', sdNm: '서울특별시' }, // 서울
            { realVowelChk: '1' }, // 실제 경매
            { realVowelChk: '2' }, // 재경매
            { pageUnit: '50' }, // 더 많은 결과
        ];
        
        let totalProperties = [];
        
        for (const [index, condition] of searchConditions.entries()) {
            console.log(`\n🔍 검색 조건 ${index + 1}: ${JSON.stringify(condition)}`);
            
            const properties = await scraper.searchProperties(condition);
            
            if (properties.length > 0) {
                console.log(`✅ ${properties.length}개 경매물건 발견!`);
                totalProperties = totalProperties.concat(properties);
                
                // 첫 3개 물건 정보 출력
                properties.slice(0, 3).forEach((property, idx) => {
                    console.log(`\n${idx + 1}. ${property.case_number}`);
                    console.log(`   법원: ${property.court_name}`);
                    console.log(`   종류: ${property.property_type}`);
                    console.log(`   주소: ${property.address}`);
                    console.log(`   감정가: ${property.appraisal_value?.toLocaleString()}원`);
                    console.log(`   최저가: ${property.minimum_sale_price?.toLocaleString()}원`);
                });
            } else {
                console.log('❌ 경매물건을 찾지 못했습니다.');
            }
            
            // 잠시 대기 (서버 부하 방지)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // 2. 수집된 데이터 저장
        if (totalProperties.length > 0) {
            const dataFile = 'collected-auction-data.json';
            await fs.writeFile(dataFile, JSON.stringify({
                collected_at: new Date().toISOString(),
                total_count: totalProperties.length,
                properties: totalProperties
            }, null, 2));
            
            console.log(`\n💾 ${totalProperties.length}개 경매물건 데이터를 ${dataFile}에 저장했습니다.`);
            
            // 통계 정보
            const regions = [...new Set(totalProperties.map(p => p.court_name))];
            const types = [...new Set(totalProperties.map(p => p.property_type))];
            
            console.log(`\n📊 수집 통계:`);
            console.log(`   - 총 물건 수: ${totalProperties.length}개`);
            console.log(`   - 법원 수: ${regions.length}개`);
            console.log(`   - 물건 유형: ${types.join(', ')}`);
            
        } else {
            console.log('\n❌ 수집된 실제 경매 데이터가 없습니다.');
            console.log('💡 다른 접근 방법이 필요합니다:');
            console.log('   1. 다른 API 엔드포인트 시도');
            console.log('   2. 브라우저 자동화를 통한 실제 검색');
            console.log('   3. 웹소켓이나 AJAX 호출 모니터링');
        }
        
    } catch (error) {
        console.error('❌ 실제 데이터 수집 실패:', error.message);
    }
}

// 실행
if (require.main === module) {
    collectRealData()
        .then(() => {
            console.log('\n✅ 실제 데이터 수집 완료');
            process.exit(0);
        })
        .catch(error => {
            console.error('실패:', error);
            process.exit(1);
        });
}

module.exports = { collectRealData };