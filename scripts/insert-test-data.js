const pool = require('../config/database');
const AIInvestmentAnalyzer = require('../src/analyzer/AIInvestmentAnalyzer');

/**
 * 테스트용 실제 법원경매 데이터 입력 및 분석
 */

async function insertTestData() {
  console.log('='.repeat(80));
  console.log('📝 테스트 데이터 입력 및 분석 시작');
  console.log('='.repeat(80));
  console.log();

  const client = await pool.connect();
  const analyzer = new AIInvestmentAnalyzer();

  try {
    await client.query('BEGIN');

    // 1. 법원 정보 확인/추가
    console.log('1️⃣  법원 정보 확인...');
    let courtResult = await client.query(
      'SELECT id FROM analyzer.courts WHERE name = $1',
      ['부산지방법원']
    );

    let courtId;
    if (courtResult.rows.length === 0) {
      const insertCourt = await client.query(
        'INSERT INTO analyzer.courts (name, code, address) VALUES ($1, $2, $3) RETURNING id',
        ['부산지방법원', 'BUSAN', '부산광역시 연제구 중앙대로 1000']
      );
      courtId = insertCourt.rows[0].id;
      console.log(`   ✅ 법원 추가: 부산지방법원 (ID: ${courtId})`);
    } else {
      courtId = courtResult.rows[0].id;
      console.log(`   ✅ 기존 법원 사용: ID ${courtId}`);
    }
    console.log();

    // 2. 테스트 물건 데이터 (실제 법원경매 형식)
    const testProperties = [
      {
        case_number: '2024타경12345',
        item_number: '1',
        address: '부산광역시 해운대구 우동 123-45',
        property_type: '아파트',
        building_name: '우동 센텀파크',
        land_area: 85.5,
        building_area: 84.9,
        exclusive_area: 59.8,
        appraisal_value: 500000000,
        minimum_sale_price: 400000000,
        bid_deposit: 40000000,
        auction_date: new Date('2024-12-15'),
        auction_time: '10:00:00',
        failure_count: 0,
        current_status: 'active',
        tenant_status: '없음',
        building_year: 2015,
        floor_info: '15/25층',
        source_site: 'courtauction',
        source_url: 'https://www.courtauction.go.kr/detail/2024타경12345-1'
      },
      {
        case_number: '2024타경23456',
        item_number: '1',
        address: '부산광역시 부산진구 서면로 45',
        property_type: '상가',
        building_name: '서면 타워',
        land_area: 120.0,
        building_area: 115.5,
        exclusive_area: 110.0,
        appraisal_value: 800000000,
        minimum_sale_price: 560000000,
        bid_deposit: 56000000,
        auction_date: new Date('2024-12-20'),
        auction_time: '14:00:00',
        failure_count: 1,
        current_status: 'active',
        tenant_status: '있음',
        building_year: 2012,
        floor_info: '1층',
        source_site: 'courtauction',
        source_url: 'https://www.courtauction.go.kr/detail/2024타경23456-1'
      },
      {
        case_number: '2024타경34567',
        item_number: '1',
        address: '부산광역시 동래구 온천동 678-90',
        property_type: '아파트',
        building_name: '온천 센트럴시티',
        land_area: 95.0,
        building_area: 94.2,
        exclusive_area: 74.8,
        appraisal_value: 600000000,
        minimum_sale_price: 420000000,
        bid_deposit: 42000000,
        auction_date: new Date('2024-12-25'),
        auction_time: '10:00:00',
        failure_count: 0,
        current_status: 'active',
        tenant_status: '없음',
        building_year: 2018,
        floor_info: '20/30층',
        source_site: 'courtauction',
        source_url: 'https://www.courtauction.go.kr/detail/2024타경34567-1'
      },
      {
        case_number: '2024타경45678',
        item_number: '1',
        address: '부산광역시 사상구 주례동 234-56',
        property_type: '오피스텔',
        building_name: '주례역 센트럴',
        land_area: 45.0,
        building_area: 43.5,
        exclusive_area: 35.8,
        appraisal_value: 200000000,
        minimum_sale_price: 140000000,
        bid_deposit: 14000000,
        auction_date: new Date('2024-12-18'),
        auction_time: '15:00:00',
        failure_count: 2,
        current_status: 'active',
        tenant_status: '있음',
        building_year: 2010,
        floor_info: '8/15층',
        source_site: 'courtauction',
        source_url: 'https://www.courtauction.go.kr/detail/2024타경45678-1'
      },
      {
        case_number: '2024타경56789',
        item_number: '1',
        address: '부산광역시 강서구 녹산산단 345-67',
        property_type: '토지',
        building_name: null,
        land_area: 500.0,
        building_area: null,
        exclusive_area: null,
        appraisal_value: 350000000,
        minimum_sale_price: 245000000,
        bid_deposit: 24500000,
        auction_date: new Date('2024-12-22'),
        auction_time: '11:00:00',
        failure_count: 0,
        current_status: 'active',
        tenant_status: '없음',
        building_year: null,
        floor_info: null,
        source_site: 'courtauction',
        source_url: 'https://www.courtauction.go.kr/detail/2024타경56789-1'
      }
    ];

    console.log('2️⃣  테스트 물건 입력...');
    const insertedProperties = [];

    for (const [index, property] of testProperties.entries()) {
      const insertQuery = `
        INSERT INTO analyzer.properties (
          case_number, item_number, court_id, address, property_type, building_name,
          land_area, building_area, exclusive_area, appraisal_value, minimum_sale_price,
          bid_deposit, auction_date, auction_time, failure_count, current_status,
          tenant_status, building_year, floor_info, source_site, source_url,
          last_scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
        RETURNING id
      `;

      const result = await client.query(insertQuery, [
        property.case_number,
        property.item_number,
        courtId,
        property.address,
        property.property_type,
        property.building_name,
        property.land_area,
        property.building_area,
        property.exclusive_area,
        property.appraisal_value,
        property.minimum_sale_price,
        property.bid_deposit,
        property.auction_date,
        property.auction_time,
        property.failure_count,
        property.current_status,
        property.tenant_status,
        property.building_year,
        property.floor_info,
        property.source_site,
        property.source_url
      ]);

      const propertyId = result.rows[0].id;
      insertedProperties.push({ id: propertyId, ...property });

      console.log(`   [${index + 1}] ✅ ${property.case_number} (ID: ${propertyId})`);
      console.log(`       ${property.address}`);
      console.log(`       ${property.property_type} | ${(property.minimum_sale_price / 10000).toLocaleString()}만원`);
    }
    console.log();

    await client.query('COMMIT');
    console.log('✅ 물건 데이터 입력 완료!');
    console.log();

    // 3. AI 분석 실행
    console.log('3️⃣  AI 투자 분석 실행...');
    console.log('-'.repeat(80));

    for (const [index, property] of insertedProperties.entries()) {
      try {
        console.log(`\n[${index + 1}/${insertedProperties.length}] 분석 중: ${property.case_number}`);
        console.log(`   주소: ${property.address}`);
        console.log(`   유형: ${property.property_type}`);

        const analysis = await analyzer.analyzeProperty(property.id);

        console.log(`   ✅ 분석 완료!`);
        console.log(`      투자점수: ${analysis.investmentScore}점 (${analysis.investmentGrade}등급)`);
        console.log(`      수익성: ${analysis.profitabilityScore}점 | 위험도: ${analysis.riskScore}점 | 유동성: ${analysis.liquidityScore}점`);
        console.log(`      1년 ROI: ${analysis.roi1Year}% | 위험수준: ${analysis.riskLevel}`);
        console.log(`      예상 낙찰확률: ${analysis.successProbability}%`);

      } catch (error) {
        console.error(`   ❌ 분석 실패: ${error.message}`);
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('✅ 모든 작업 완료!');
    console.log('='.repeat(80));
    console.log();
    console.log('📊 최종 통계:');
    console.log(`   - 입력된 물건: ${insertedProperties.length}개`);
    console.log(`   - 분석 완료: ${insertedProperties.length}개`);
    console.log();
    console.log('💡 다음 명령으로 데이터 확인:');
    console.log('   node scripts/check-data-status.js');
    console.log();

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// 실행
insertTestData();
