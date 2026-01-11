#!/usr/bin/env node

const OnbidApiScraper = require('../src/scraper/OnbidApiScraper');

/**
 * 온비드에서 실제 경매 데이터 수집
 */
async function main() {
    const scraper = new OnbidApiScraper();
    
    try {
        console.log('🚀 온비드 실제 경매 데이터 수집 시작');
        
        // 스크래퍼 초기화
        // await scraper.initialize();
        
        // 전국 경매 데이터 수집 (50개)
        const properties = await scraper.getRealAuctionProperties(50);
        
        console.log('\n📊 수집된 데이터 샘플:');
        properties.slice(0, 3).forEach((property, index) => {
            console.log(`\n${index + 1}. ${property.case_number}`);
            console.log(`   법원: ${property.court_name}`);
            console.log(`   종류: ${property.property_type}`);
            console.log(`   주소: ${property.address}`);
            console.log(`   감정가: ${property.appraisal_value?.toLocaleString()}원`);
            console.log(`   최저가: ${property.minimum_sale_price?.toLocaleString()}원`);
            console.log(`   경매일: ${property.auction_date}`);
        });
        
        console.log('\n📈 수집 통계:');
        const stats = {
            '총물건수': properties.length,
            '아파트': properties.filter(p => p.property_type === '아파트').length,
            '단독주택': properties.filter(p => p.property_type === '단독주택').length,
            '상가': properties.filter(p => p.property_type === '상가').length,
            '기타': properties.filter(p => !['아파트', '단독주택', '상가'].includes(p.property_type)).length
        };
        console.table(stats);
        
        // 데이터베이스에 저장할지 물어보기
        if (properties.length > 0) {
            console.log('\n💾 데이터베이스에 저장하시겠습니까?');
            console.log('   - 저장하려면 scripts/save-real-data.js 실행');
            console.log('   - 또는 수동으로 데이터베이스 업데이트');
            
            // JSON 파일로 임시 저장
            const fs = require('fs').promises;
            const path = require('path');
            
            const dataPath = path.join(__dirname, '../data/onbid-real-data.json');
            await fs.writeFile(dataPath, JSON.stringify({ 
                properties, 
                collected_at: new Date().toISOString(),
                source: 'onbid.co.kr',
                count: properties.length 
            }, null, 2));
            
            console.log(`\n✅ 데이터를 ${dataPath}에 임시 저장했습니다.`);
        }
        
    } catch (error) {
        console.error('❌ 온비드 데이터 수집 실패:', error);
    } finally {
        // await scraper.close();
        console.log('✅ 온비드 데이터 수집 완료');
    }
}

// 스크립트 직접 실행 시
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };