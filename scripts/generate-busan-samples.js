const pool = require('../config/database');

// 부산 지역 데이터
const busanDistricts = [
  '해운대구', '수영구', '남구', '동래구', '금정구', '부산진구', 
  '서구', '동구', '영도구', '사하구', '사상구', '북구', 
  '강서구', '연제구', '중구', '기장군'
];

const propertyTypes = [
  { type: '아파트', weight: 40 },
  { type: '오피스텔', weight: 20 },
  { type: '다세대주택', weight: 15 },
  { type: '단독주택', weight: 10 },
  { type: '상가', weight: 10 },
  { type: '토지', weight: 5 }
];

const apartmentNames = [
  '래미안', '아이파크', '푸르지오', '자이', '힐스테이트', 
  'e편한세상', '더샵', '롯데캐슬', '센텀파크', '마린시티',
  '해운대엘시티', '센트럴파크', '더베이', '파크리오', '센텀스타'
];

// 랜덤 헬퍼 함수들
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getWeightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.type;
  }
  return items[0].type;
}

function getRandomPrice(min, max) {
  return Math.floor(Math.random() * (max - min) + min) * 1000000;
}

function getRandomArea(type) {
  const areas = {
    '아파트': [59, 74, 84, 101, 114, 125],
    '오피스텔': [23, 33, 45, 59, 84],
    '다세대주택': [40, 60, 80, 100],
    '단독주택': [100, 150, 200, 250, 300],
    '상가': [30, 50, 80, 120, 200],
    '토지': [100, 200, 330, 500, 660, 1000]
  };
  return getRandomElement(areas[type] || [84]);
}

function generateAddress(district, type) {
  const dong = ['우동', '재송동', '센텀동', '대연동', '광안동', '남천동', '수영동', '민락동'];
  const bun = Math.floor(Math.random() * 500) + 1;
  const ho = Math.floor(Math.random() * 30) + 1;
  
  let address = `부산광역시 ${district} ${getRandomElement(dong)} ${bun}`;
  if (type === '아파트' || type === '오피스텔') {
    address += `-${ho}`;
  }
  return address;
}

function calculateInvestmentScore(discountRate, failureCount, propertyType, district) {
  let score = 50;
  
  // 할인율에 따른 점수 (할인율이 클수록 높은 점수)
  score += Math.min(discountRate * 0.8, 30);
  
  // 유찰 횟수에 따른 감점
  score -= failureCount * 5;
  
  // 물건 종류에 따른 가중치
  const typeScores = {
    '아파트': 10,
    '오피스텔': 8,
    '상가': 5,
    '다세대주택': 3,
    '단독주택': 2,
    '토지': 0
  };
  score += typeScores[propertyType] || 0;
  
  // 지역별 가중치
  const districtScores = {
    '해운대구': 10,
    '수영구': 8,
    '남구': 7,
    '동래구': 6,
    '부산진구': 5
  };
  score += districtScores[district] || 3;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function generateSampleProperties(count = 100) {
  console.log(`🏗️ ${count}개의 부산 지역 샘플 물건 생성 중...`);
  
  const properties = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2025-03-31');
  
  for (let i = 1; i <= count; i++) {
    const district = getRandomElement(busanDistricts);
    const propertyType = getWeightedRandom(propertyTypes);
    const area = getRandomArea(propertyType);
    
    // 감정가 계산 (지역과 평수에 따라)
    const pricePerPyeong = propertyType === '아파트' 
      ? (district === '해운대구' ? 25000000 : 15000000)
      : 10000000;
    const appraisalValue = Math.floor(area * pricePerPyeong / 3.3);
    
    // 할인율 (20% ~ 50%)
    const discountRate = Math.floor(Math.random() * 30 + 20);
    const minimumSalePrice = Math.floor(appraisalValue * (100 - discountRate) / 100);
    const bidDeposit = Math.floor(minimumSalePrice * 0.1);
    
    // 유찰 횟수
    const failureCount = Math.floor(Math.random() * 4);
    
    // 경매 날짜 (2024년 12월 ~ 2025년 3월)
    const auctionDate = new Date(startDate);
    auctionDate.setDate(auctionDate.getDate() + Math.floor(Math.random() * 120));
    
    // 건물명 생성
    const buildingName = propertyType === '아파트' 
      ? `${getRandomElement(apartmentNames)} ${district}`
      : propertyType === '오피스텔'
      ? `${district} 오피스텔`
      : '';
    
    // 투자 점수 계산
    const investmentScore = calculateInvestmentScore(discountRate, failureCount, propertyType, district);
    
    // 낙찰 예상가
    const estimatedFinalPrice = minimumSalePrice * (1 + Math.random() * 0.15);
    
    // 성공 확률
    const successProbability = Math.max(20, Math.min(95, 100 - failureCount * 20 + Math.random() * 30));
    
    const property = {
      case_number: `2024타경${String(10000 + i).padStart(5, '0')}`,
      item_number: '1',
      court_name: '부산지방법원',
      address: generateAddress(district, propertyType),
      property_type: propertyType,
      building_name: buildingName,
      appraisal_value: appraisalValue,
      minimum_sale_price: minimumSalePrice,
      bid_deposit: bidDeposit,
      auction_date: auctionDate.toISOString().split('T')[0],
      auction_time: `${Math.floor(Math.random() * 4) + 10}:${Math.random() > 0.5 ? '00' : '30'}`,
      failure_count: failureCount,
      current_status: 'active',
      tenant_status: Math.random() > 0.6 ? '무' : '임차인있음',
      building_year: String(2000 + Math.floor(Math.random() * 24)),
      floor_info: propertyType === '아파트' || propertyType === '오피스텔' 
        ? `${Math.floor(Math.random() * 20) + 1}층/${Math.floor(Math.random() * 10) + 20}층`
        : '',
      area: area,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // analysis_results 테이블용 데이터
    property.analysis = {
      property_id: i,
      investment_score: investmentScore,
      profitability_score: Math.round(discountRate * 2),
      risk_score: Math.max(20, 100 - failureCount * 25),
      liquidity_score: propertyType === '아파트' ? 90 : propertyType === '오피스텔' ? 70 : 50,
      discount_rate: discountRate,
      success_probability: Math.round(successProbability),
      estimated_final_price: Math.round(estimatedFinalPrice),
      analyzed_at: new Date().toISOString()
    };
    
    properties.push(property);
  }
  
  return properties;
}

async function insertToDatabase(properties) {
  console.log('💾 데이터베이스에 저장 중...');
  
  let savedCount = 0;
  let errorCount = 0;
  
  for (const property of properties) {
    try {
      // properties 테이블에 삽입
      const propertyQuery = `
        INSERT INTO properties (
          case_number, item_number, court_name, address, property_type,
          building_name, appraisal_value, minimum_sale_price, bid_deposit,
          auction_date, auction_time, failure_count, current_status,
          tenant_status, building_year, floor_info, area, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (case_number, item_number) 
        DO UPDATE SET updated_at = EXCLUDED.updated_at
        RETURNING id
      `;
      
      const values = [
        property.case_number, property.item_number, property.court_name,
        property.address, property.property_type, property.building_name,
        property.appraisal_value, property.minimum_sale_price, property.bid_deposit,
        property.auction_date, property.auction_time, property.failure_count,
        property.current_status, property.tenant_status, property.building_year,
        property.floor_info, property.area, property.created_at, property.updated_at
      ];
      
      const result = await pool.query(propertyQuery, values);
      const propertyId = result.rows[0].id;
      
      // analysis_results 테이블에 삽입
      if (property.analysis) {
        const analysisQuery = `
          INSERT INTO analysis_results (
            property_id, investment_score, profitability_score, risk_score,
            liquidity_score, discount_rate, success_probability,
            estimated_final_price, analyzed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (property_id) 
          DO UPDATE SET 
            investment_score = EXCLUDED.investment_score,
            analyzed_at = EXCLUDED.analyzed_at
        `;
        
        await pool.query(analysisQuery, [
          propertyId,
          property.analysis.investment_score,
          property.analysis.profitability_score,
          property.analysis.risk_score,
          property.analysis.liquidity_score,
          property.analysis.discount_rate,
          property.analysis.success_probability,
          property.analysis.estimated_final_price,
          property.analysis.analyzed_at
        ]);
      }
      
      savedCount++;
      
      if (savedCount % 10 === 0) {
        console.log(`📊 진행상황: ${savedCount}/${properties.length} 저장 완료`);
      }
      
    } catch (error) {
      console.error(`❌ 저장 실패 (${property.case_number}):`, error.message);
      errorCount++;
    }
  }
  
  return { savedCount, errorCount };
}

async function main() {
  try {
    console.log('🚀 부산 경매 샘플 데이터 생성 시작\n');
    
    // 100개의 샘플 물건 생성
    const properties = await generateSampleProperties(100);
    
    console.log(`\n✅ ${properties.length}개 물건 생성 완료`);
    console.log('📊 물건 유형 분포:');
    const typeCounts = {};
    properties.forEach(p => {
      typeCounts[p.property_type] = (typeCounts[p.property_type] || 0) + 1;
    });
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}개`);
    });
    
    console.log('\n📍 지역 분포:');
    const districtCounts = {};
    properties.forEach(p => {
      const district = p.address.split(' ')[1];
      districtCounts[district] = (districtCounts[district] || 0) + 1;
    });
    Object.entries(districtCounts).slice(0, 5).forEach(([district, count]) => {
      console.log(`  - ${district}: ${count}개`);
    });
    
    // 데이터베이스 저장 여부 확인
    console.log('\n💾 데이터베이스에 저장하시겠습니까?');
    const result = await insertToDatabase(properties);
    
    console.log('\n🎉 작업 완료!');
    console.log(`✅ 성공: ${result.savedCount}개`);
    console.log(`❌ 실패: ${result.errorCount}개`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await pool.end();
  }
}

// 스크립트 직접 실행시
if (require.main === module) {
  main();
}

module.exports = { generateSampleProperties };