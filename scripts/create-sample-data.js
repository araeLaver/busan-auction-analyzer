const pool = require('../config/database');
const RealEstateDataService = require('../src/services/RealEstateDataService');

const realEstateService = new RealEstateDataService();

// 서울 지역 샘플 경매 물건 데이터
const sampleAuctionProperties = [
  {
    caseNumber: '2024타경12345',
    itemNumber: '1',
    address: '서울특별시 강남구 역삼동 123-45 아파트 101동 502호',
    propertyType: '아파트',
    buildingName: '역삼아이파크아파트',
    appraisalValue: 850000000,
    minimumSalePrice: 595000000, // 70% 수준
    bidDeposit: 59500000,
    auctionDate: new Date('2024-12-15'),
    auctionTime: '10:00',
    failureCount: 1,
    currentStatus: 'active',
    tenantStatus: '무',
    buildingYear: '2018',
    floorInfo: '5층/15층',
    area: 84.96,
    courtId: 1 // 서울중앙지방법원
  },
  {
    caseNumber: '2024타경12346',
    itemNumber: '1',
    address: '서울특별시 서초구 서초동 567-89 오피스텔 101호',
    propertyType: '오피스텔',
    buildingName: '서초타워오피스텔',
    appraisalValue: 650000000,
    minimumSalePrice: 390000000, // 60% 수준 (2차 유찰)
    bidDeposit: 39000000,
    auctionDate: new Date('2024-12-18'),
    auctionTime: '14:00',
    failureCount: 2,
    currentStatus: 'active',
    tenantStatus: '임차인 있음',
    buildingYear: '2015',
    floorInfo: '10층/20층',
    area: 59.85,
    courtId: 1
  },
  {
    caseNumber: '2024타경12347',
    itemNumber: '1',
    address: '서울특별시 송파구 잠실동 234-56 아파트 201동 304호',
    propertyType: '아파트',
    buildingName: '잠실리센츠아파트',
    appraisalValue: 1200000000,
    minimumSalePrice: 840000000, // 70% 수준
    bidDeposit: 84000000,
    auctionDate: new Date('2024-12-20'),
    auctionTime: '10:30',
    failureCount: 0,
    currentStatus: 'active',
    tenantStatus: '무',
    buildingYear: '2019',
    floorInfo: '3층/25층',
    area: 114.85,
    courtId: 1
  },
  {
    caseNumber: '2024타경12348',
    itemNumber: '1',
    address: '서울특별시 마포구 상암동 345-67 아파트 102동 801호',
    propertyType: '아파트',
    buildingName: '상암월드컵파크아파트',
    appraisalValue: 780000000,
    minimumSalePrice: 468000000, // 60% 수준
    bidDeposit: 46800000,
    auctionDate: new Date('2024-12-22'),
    auctionTime: '11:00',
    failureCount: 2,
    currentStatus: 'active',
    tenantStatus: '무',
    buildingYear: '2016',
    floorInfo: '8층/15층',
    area: 84.92,
    courtId: 1
  },
  {
    caseNumber: '2024타경12349',
    itemNumber: '1',
    address: '서울특별시 용산구 한남동 456-78 아파트 301동 1502호',
    propertyType: '아파트',
    buildingName: '한남더힐아파트',
    appraisalValue: 1800000000,
    minimumSalePrice: 1260000000, // 70% 수준
    bidDeposit: 126000000,
    auctionDate: new Date('2024-12-25'),
    auctionTime: '14:30',
    failureCount: 0,
    currentStatus: 'active',
    tenantStatus: '무',
    buildingYear: '2020',
    floorInfo: '15층/20층',
    area: 134.78,
    courtId: 1
  }
];

async function createSampleData() {
  const client = await pool.connect();
  
  try {
    console.log('🏗️ 샘플 경매 데이터 생성 시작...');
    
    await client.query('BEGIN');
    
    // 기존 샘플 데이터 삭제
    await client.query("DELETE FROM properties WHERE case_number LIKE '2024타경%'");
    console.log('🗑️ 기존 샘플 데이터 삭제 완료');
    
    let insertedCount = 0;
    
    for (const property of sampleAuctionProperties) {
      // 물건 정보 삽입
      const insertQuery = `
        INSERT INTO properties (
          case_number, item_number, court_id, address, property_type,
          building_name, appraisal_value, minimum_sale_price, bid_deposit,
          auction_date, auction_time, failure_count, current_status,
          tenant_status, building_year, floor_info, area,
          source_site, source_url, last_scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
        RETURNING id
      `;
      
      const result = await client.query(insertQuery, [
        property.caseNumber,
        property.itemNumber,
        property.courtId,
        property.address,
        property.propertyType,
        property.buildingName,
        property.appraisalValue,
        property.minimumSalePrice,
        property.bidDeposit,
        property.auctionDate,
        property.auctionTime,
        property.failureCount,
        property.currentStatus,
        property.tenantStatus,
        property.buildingYear,
        property.floorInfo,
        property.area,
        'sample_data',
        'http://sample.data/' + property.caseNumber
      ]);
      
      const propertyId = result.rows[0].id;
      insertedCount++;
      
      console.log(`✅ 생성: ${property.caseNumber} - ${property.buildingName}`);
      
      // 시세 분석 데이터 생성 (더미)
      try {
        const marketData = realEstateService.generateDummyMarketData(property.address);
        
        // 투자 점수 계산
        const discountRate = ((property.appraisalValue - property.minimumSalePrice) / property.appraisalValue) * 100;
        const investmentScore = Math.min(100, Math.max(0, 
          50 + 
          (discountRate - 30) * 1.5 + // 할인율 점수
          (property.failureCount * 5) - // 유찰 횟수 보너스
          (property.tenantStatus === '임차인 있음' ? 10 : 0) + // 임차인 있으면 감점
          (property.buildingYear >= 2018 ? 10 : 0) // 신축 보너스
        ));
        
        const successProbability = Math.min(95, Math.max(5, 
          70 - (property.failureCount * 15) + (discountRate > 40 ? 20 : 0)
        ));
        
        // 분석 결과 저장
        const analysisQuery = `
          INSERT INTO analysis_results (
            property_id, investment_score, discount_rate, success_probability,
            market_price_avg, market_price_sqm, expected_final_price,
            analysis_date, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        `;
        
        await client.query(analysisQuery, [
          propertyId,
          Math.round(investmentScore),
          Math.round(discountRate * 100) / 100,
          Math.round(successProbability),
          marketData.averagePrice,
          marketData.pricePerSqm,
          Math.round(property.minimumSalePrice * 1.05), // 예상 최종가 (최저가 + 5%)
          `시세 기반 자동 분석 (할인율: ${Math.round(discountRate)}%)`
        ]);
        
        console.log(`📊 분석 완료: 투자점수 ${Math.round(investmentScore)}점, 할인율 ${Math.round(discountRate)}%`);
        
      } catch (analysisError) {
        console.error('❌ 분석 데이터 생성 오류:', analysisError);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`🎉 샘플 데이터 생성 완료: ${insertedCount}개 물건`);
    
    // 통계 조회
    const statsQuery = `
      SELECT 
        COUNT(*) as total_properties,
        AVG(ar.investment_score) as avg_score,
        COUNT(CASE WHEN ar.investment_score >= 80 THEN 1 END) as high_score_count
      FROM properties p
      LEFT JOIN analysis_results ar ON p.id = ar.property_id
      WHERE p.current_status = 'active'
    `;
    
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];
    
    console.log('\n📈 생성된 데이터 통계:');
    console.log(`- 전체 활성 물건: ${stats.total_properties}개`);
    console.log(`- 평균 투자 점수: ${Math.round(stats.avg_score || 0)}점`);
    console.log(`- 고점수 물건 (80점 이상): ${stats.high_score_count}개`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 샘플 데이터 생성 오류:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  createSampleData()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 스크립트 실행 오류:', error);
      process.exit(1);
    });
}

module.exports = createSampleData;