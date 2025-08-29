#!/usr/bin/env node

const RealApiScraper = require('../src/scraper/RealApiScraper');

/**
 * 패킷 분석으로 발견한 실제 API 테스트
 */
async function testRealAPI() {
    const scraper = new RealApiScraper();
    
    try {
        console.log('🧪 실제 법원경매정보 API 테스트 시작');
        console.log('📡 패킷 분석으로 발견한 API 엔드포인트들을 테스트합니다...\n');
        
        // 1. 법원 목록 조회 테스트
        const courts = await scraper.getCourts();
        
        if (courts.length > 0) {
            console.log(`\n🏛️ 발견된 법원들:`);
            courts.slice(0, 10).forEach((court, index) => {
                console.log(`   ${index + 1}. ${court.name} (${court.code})`);
            });
        }
        
        // 2. 지역 목록 조회 테스트  
        const regions = await scraper.getRegions();
        
        if (regions.length > 0) {
            console.log(`\n🗺️ 발견된 지역들:`);
            regions.slice(0, 10).forEach((region, index) => {
                console.log(`   ${index + 1}. ${region.name} (${region.code})`);
            });
        }
        
        // 3. 경매 물건 검색 테스트
        console.log('\n🔍 경매 물건 검색 API 테스트...');
        const properties = await scraper.searchProperties({
            'cortOfcCd': 'B000210', // 서울중앙지방법원
            'pageIndex': '1',
            'pageUnit': '10'
        });
        
        if (properties.length > 0) {
            console.log(`\n🎉 실제 경매 물건 ${properties.length}개 발견!`);
            
            properties.slice(0, 3).forEach((property, index) => {
                console.log(`\n${index + 1}. ${property.case_number}`);
                console.log(`   법원: ${property.court_name}`);
                console.log(`   종류: ${property.property_type}`);
                console.log(`   주소: ${property.address}`);
                console.log(`   감정가: ${property.appraisal_value?.toLocaleString()}원`);
                console.log(`   최저가: ${property.minimum_sale_price?.toLocaleString()}원`);
            });
            
            console.log('\n💾 이 데이터들을 데이터베이스에 저장하시겠습니까?');
            
        } else {
            console.log('❌ 아직 경매 물건 검색 API를 찾지 못했습니다.');
            console.log('💡 추가 패킷 분석이 필요합니다:');
            console.log('   1. 브라우저에서 실제 검색 실행');
            console.log('   2. Network 탭에서 새로운 API 호출 확인');
            console.log('   3. 발견된 검색 API 추가 구현');
        }
        
    } catch (error) {
        console.error('❌ 실제 API 테스트 실패:', error);
    }
}

// 실행
if (require.main === module) {
    testRealAPI()
        .then(() => {
            console.log('\n✅ 실제 API 테스트 완료');
            process.exit(0);
        })
        .catch(error => {
            console.error('실패:', error);
            process.exit(1);
        });
}

module.exports = { testRealAPI };