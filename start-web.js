// 웹 서버만 시작하는 스크립트 (DB 연결 없이)
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log('🌐 웹 서버 시작 중...');
console.log(`📁 정적 파일 경로: ${path.join(__dirname, 'public')}`);

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '서울경매 분석 서비스',
    timestamp: new Date().toISOString() 
  });
});

// 대시보드 통계 (더미 데이터)
app.get('/api/dashboard/stats', (req, res) => {
  console.log('📊 대시보드 통계 요청');
  res.json({
    totalActiveProperties: 1250,
    newTodayCount: 23,
    averageInvestmentScore: 67,
    highScoreCount: 180
  });
});

// 물건 목록 조회 (더미 데이터)
app.get('/api/properties', (req, res) => {
  console.log('🏠 물건 목록 요청');
  
  const dummyProperties = [
    {
      id: 1,
      case_number: '2024타경12345',
      item_number: '1',
      court_name: '서울중앙지법',
      address: '서울특별시 강남구 테헤란로 1234-56 강남센텀아파트 101동 1501호',
      property_type: '아파트',
      building_name: '해운대센텀아파트',
      appraisal_value: 500000000,
      minimum_sale_price: 400000000,
      auction_date: '2024-09-15T10:30:00',
      failure_count: 0,
      current_status: 'active',
      investment_score: 85,
      discount_rate: 20.0,
      success_probability: 75,
      estimated_final_price: 420000000,
      created_at: '2024-08-08T06:00:00.000Z'
    },
    {
      id: 2,
      case_number: '2024타경12346',
      item_number: '1',
      court_name: '서울중앙지법',
      address: '서울특별시 중구 을지로 567-89 을지오피스빌딩 15층',
      property_type: '오피스텔',
      building_name: '서면오피스빌딩',
      appraisal_value: 300000000,
      minimum_sale_price: 240000000,
      auction_date: '2024-09-20T14:00:00',
      failure_count: 1,
      current_status: 'active',
      investment_score: 72,
      discount_rate: 20.0,
      success_probability: 65,
      estimated_final_price: 250000000,
      created_at: '2024-08-07T10:00:00.000Z'
    },
    {
      id: 3,
      case_number: '2024타경12347',
      item_number: '1',
      court_name: '서울중앙지법',
      address: '서울특별시 송파구 올림픽로 890-12 올림픽베스트빌라 201호',
      property_type: '다세대주택',
      building_name: '광안베스트빌라',
      appraisal_value: 180000000,
      minimum_sale_price: 144000000,
      auction_date: '2024-09-25T11:00:00',
      failure_count: 0,
      current_status: 'active',
      investment_score: 68,
      discount_rate: 20.0,
      success_probability: 70,
      estimated_final_price: 150000000,
      created_at: '2024-08-06T14:30:00.000Z'
    },
    {
      id: 4,
      case_number: '2024타경12348',
      item_number: '1',
      court_name: '서울중앙지법',
      address: '서울특별시 용산구 이태원로 345-67 이태원상가 1층 101호',
      property_type: '상가',
      building_name: '명륜상가',
      appraisal_value: 120000000,
      minimum_sale_price: 96000000,
      auction_date: '2024-09-30T15:30:00',
      failure_count: 2,
      current_status: 'active',
      investment_score: 45,
      discount_rate: 20.0,
      success_probability: 40,
      estimated_final_price: 100000000,
      created_at: '2024-08-05T09:15:00.000Z'
    },
    {
      id: 5,
      case_number: '2024타경12349',
      item_number: '1',
      court_name: '서울중앙지법',
      address: '서울특별시 서초구 강남대로 123-45 서초파크타운 205동 2301호',
      property_type: '아파트',
      building_name: '연산파크타운',
      appraisal_value: 350000000,
      minimum_sale_price: 280000000,
      auction_date: '2024-10-05T10:00:00',
      failure_count: 0,
      current_status: 'active',
      investment_score: 78,
      discount_rate: 20.0,
      success_probability: 80,
      estimated_final_price: 290000000,
      created_at: '2024-08-08T08:45:00.000Z'
    }
  ];

  res.json({
    properties: dummyProperties,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalCount: dummyProperties.length,
      hasNext: false,
      hasPrev: false
    }
  });
});

// 물건 상세 정보 조회 (더미 데이터)
app.get('/api/properties/:id', (req, res) => {
  const { id } = req.params;
  console.log(`🔍 물건 상세 정보 요청: ID ${id}`);
  
  const dummyProperty = {
    id: parseInt(id),
    case_number: '2024타경12345',
    item_number: '1',
    court_name: '서울중앙지법',
    court_address: '서울특별시 서초구 서초대로 219',
    address: '서울특별시 강남구 테헤란로 1234-56 강남센텀아파트 101동 1501호',
    property_type: '아파트',
    building_name: '해운대센텀아파트',
    
    // 면적 정보
    land_area: 84.95,
    building_area: 84.95,
    exclusive_area: 59.47,
    floor_info: '15층',
    building_year: 2018,
    
    // 가격 정보
    appraisal_value: 500000000,
    minimum_sale_price: 400000000,
    bid_deposit: 40000000,
    
    // 입찰 정보
    auction_date: '2024-09-15T10:30:00',
    failure_count: 0,
    current_status: 'active',
    tenant_status: '임차인 없음',
    special_notes: '해운대 센텀시티 인근 신축 아파트, 교통 편리',
    
    // 분석 결과
    investment_score: 85,
    profitability_score: 88,
    risk_score: 82,
    liquidity_score: 85,
    discount_rate: 20.0,
    estimated_market_price: 480000000,
    market_comparison_rate: 16.67,
    success_probability: 75,
    estimated_final_price: 420000000,
    
    // 지역 분석
    area_average_price: 5800000, // 평방미터당 가격
    area_transaction_count: 45,
    
    // 메타 정보
    source_site: 'courtauction',
    source_url: 'https://www.courtauction.go.kr/pta/details/12345',
    last_scraped_at: '2024-08-08T06:00:00.000Z',
    analysis_date: '2024-08-08T06:30:00.000Z',
    
    // 이미지 (더미)
    images: [
      {
        image_url: '/images/property1-exterior.jpg',
        image_type: 'exterior',
        description: '건물 외관',
        display_order: 1
      },
      {
        image_url: '/images/property1-interior.jpg', 
        image_type: 'interior',
        description: '실내 전경',
        display_order: 2
      }
    ]
  };
  
  res.json(dummyProperty);
});

// 지역별 통계 (더미 데이터)
app.get('/api/stats/regions', (req, res) => {
  console.log('📍 지역별 통계 요청');
  
  const regionStats = [
    { region: '강남구', propertyCount: 245, averageScore: 88, averageDiscountRate: 15.5 },
    { region: '서초구', propertyCount: 198, averageScore: 82, averageDiscountRate: 16.2 },
    { region: '송파구', propertyCount: 156, averageScore: 79, averageDiscountRate: 17.1 },
    { region: '용산구', propertyCount: 134, averageScore: 76, averageDiscountRate: 18.3 },
    { region: '종로구', propertyCount: 98, averageScore: 74, averageDiscountRate: 19.2 }
  ];
  
  res.json(regionStats);
});

// 메인 페이지 서빙
app.get('/', (req, res) => {
  console.log('🏠 메인 페이지 요청');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 핸들러
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('❌ 서버 오류:', err.stack);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log('\n🎉 웹 서버 시작 완료!');
  console.log('=' .repeat(50));
  console.log(`🌐 서버 URL: http://localhost:${PORT}`);
  console.log(`📱 웹 페이지: http://localhost:${PORT}`);
  console.log(`🔍 API 상태: http://localhost:${PORT}/api/health`);
  console.log('=' .repeat(50));
  console.log('\n📊 사용 가능한 API:');
  console.log('  GET /api/dashboard/stats  - 대시보드 통계');
  console.log('  GET /api/properties       - 물건 목록');
  console.log('  GET /api/properties/:id   - 물건 상세');
  console.log('  GET /api/stats/regions    - 지역별 통계');
  console.log('\n💡 브라우저에서 http://localhost:3000 접속해주세요!');
});

module.exports = app;