#!/usr/bin/env node

const { SmartDedupUpdater } = require('./smart-dedup-updater');

/**
 * 테스트용 샘플 데이터 생성기
 * 실제 데이터 수집이 어려울 때 사용
 */
async function generateTestData() {
    console.log('🧪 테스트용 법원경매 데이터 생성 중...');

    const sampleProperties = [
        {
            case_number: '2024타경12345',
            court_name: '서울중앙지방법원',
            property_type: '아파트',
            address: '서울특별시 강남구 역삼동 123-45',
            appraisal_value: 850000000,
            minimum_sale_price: 680000000,
            auction_date: '2024-10-15',
            current_status: 'active'
        },
        {
            case_number: '2024타경23456', 
            court_name: '부산지방법원',
            property_type: '오피스텔',
            address: '부산광역시 해운대구 우동 567-89',
            appraisal_value: 320000000,
            minimum_sale_price: 256000000,
            auction_date: '2024-10-22',
            current_status: 'active'
        },
        {
            case_number: '2024타경34567',
            court_name: '대구지방법원',
            property_type: '단독주택',
            address: '대구광역시 수성구 범어동 234-56',
            appraisal_value: 450000000,
            minimum_sale_price: 360000000,
            auction_date: '2024-11-05',
            current_status: 'active'
        },
        {
            case_number: '2024타경45678',
            court_name: '인천지방법원',
            property_type: '상가',
            address: '인천광역시 남동구 구월동 345-67',
            appraisal_value: 280000000,
            minimum_sale_price: 224000000,
            auction_date: '2024-10-28',
            current_status: 'active'
        },
        {
            case_number: '2024타경56789',
            court_name: '광주지방법원',
            property_type: '토지',
            address: '광주광역시 북구 용봉동 456-78',
            appraisal_value: 180000000,
            minimum_sale_price: 144000000,
            auction_date: '2024-11-12',
            current_status: 'active'
        }
    ];

    console.log(`📊 ${sampleProperties.length}개 테스트 데이터 생성`);

    // 스마트 중복 방지 업데이트 실행
    const updater = new SmartDedupUpdater();
    const result = await updater.processSmartUpdate(sampleProperties, 'test-data-generator');

    console.log('\n🎊 테스트 데이터 추가 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✨ 신규 추가: ${result.new}개`);
    console.log(`🔄 업데이트: ${result.updated}개`);
    console.log(`🔄 중복: ${result.duplicate}개`);
    console.log(`⚠️ 스킵: ${result.skipped}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 웹사이트에서 확인: http://localhost:3002`);

    return result;
}

// 실행
if (require.main === module) {
    generateTestData()
        .then((result) => {
            console.log('\n🎉 테스트 데이터 생성 성공!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 테스트 데이터 생성 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { generateTestData };