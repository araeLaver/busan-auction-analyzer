#!/usr/bin/env node

const AdvancedCourtAuctionScraper = require('../src/scraper/AdvancedCourtAuctionScraper');

/**
 * 실제 법원경매 데이터 수집 스크립트
 * 
 * 사용법:
 * node scripts/run-scraper.js [options]
 * 
 * 옵션:
 * --region=busan     부산지역만 수집
 * --limit=50         수집할 최대 물건 수
 * --deep            상세 정보까지 수집
 * --save            데이터베이스에 저장
 */
async function main() {
    const args = process.argv.slice(2);
    const options = {
        region: 'busan',
        limit: 50,
        deep: args.includes('--deep'),
        save: args.includes('--save')
    };
    
    // 인수 파싱
    args.forEach(arg => {
        if (arg.startsWith('--region=')) {
            options.region = arg.split('=')[1];
        }
        if (arg.startsWith('--limit=')) {
            options.limit = parseInt(arg.split('=')[1]);
        }
    });

    console.log('🚀 부산 경매 데이터 수집 시작');
    console.log('📋 옵션:', JSON.stringify(options, null, 2));
    
    const scraper = new AdvancedCourtAuctionScraper();
    
    try {
        // 스크래퍼 초기화
        await scraper.initialize();
        console.log('✅ 스크래퍼 초기화 완료');
        
        // 부산 지역 데이터 수집
        const properties = await scraper.scrapeBusanAuctions(options.limit);
        
        console.log(`✅ ${properties.length}개 물건 정보 수집 완료`);
        
        if (options.save && properties.length > 0) {
            console.log('💾 데이터베이스에 저장 중...');
            // TODO: 데이터베이스 저장 로직 구현
            console.log(`📝 ${properties.length}개 물건 데이터 준비됨 (DB 저장 기능 구현 필요)`);
        } else {
            // 콘솔에 샘플 출력
            console.log('\n📊 수집된 데이터 샘플:');
            properties.slice(0, 3).forEach((prop, index) => {
                console.log(`\n${index + 1}. ${prop.case_number || '사건번호없음'}`);
                console.log(`   📍 주소: ${prop.address || '주소없음'}`);
                console.log(`   🏠 종류: ${prop.property_type || '미분류'}`);
                console.log(`   💰 감정가: ${prop.appraisal_value ? prop.appraisal_value.toLocaleString() + '원' : '정보없음'}`);
                console.log(`   📅 경매일: ${prop.auction_date || '날짜없음'}`);
            });
        }
        
        // 통계 출력
        console.log('\n📈 수집 통계:');
        const stats = {
            총물건수: properties.length,
            아파트: properties.filter(p => p.property_type?.includes('아파트')).length,
            오피스텔: properties.filter(p => p.property_type?.includes('오피스텔')).length,
            상가: properties.filter(p => p.property_type?.includes('상가')).length,
            기타: properties.filter(p => !p.property_type || (!p.property_type.includes('아파트') && !p.property_type.includes('오피스텔') && !p.property_type.includes('상가'))).length
        };
        console.table(stats);
        
    } catch (error) {
        console.error('❌ 스크래핑 실패:', error.message);
        if (error.stack) {
            console.error('스택 트레이스:', error.stack);
        }
        process.exit(1);
    } finally {
        // 정리
        if (scraper) {
            await scraper.close();
            console.log('🧹 리소스 정리 완료');
        }
    }
    
    console.log('✅ 부산 경매 데이터 수집 완료');
}

// 스크립트 실행
if (require.main === module) {
    main().catch(console.error);
}

module.exports = main;