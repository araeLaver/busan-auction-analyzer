// 데이터베이스 연결 문제 시 사용할 더미 데이터 서비스

const dummyProperties = [
  {
    id: 1,
    case_number: '2024타경12345',
    item_number: '1',
    court_name: '서울중앙지방법원',
    address: '서울특별시 강남구 역삼동 152-33',
    property_type: '아파트',
    building_name: '역삼아이파크아파트',
    appraisal_value: 850000000,
    minimum_sale_price: 595000000,
    bid_deposit: 59500000,
    auction_date: '2024-12-15',
    auction_time: '10:00',
    failure_count: 1,
    current_status: 'active',
    tenant_status: '무',
    building_year: '2018',
    floor_info: '5층/15층',
    area: 84.96,
    created_at: '2024-11-01T00:00:00.000Z',
    investment_score: 78,
    discount_rate: 30.0,
    success_probability: 75,
    estimated_final_price: 624750000,
    images: []
  },
  {
    id: 2,
    case_number: '2024타경12346',
    item_number: '1',
    court_name: '서울중앙지방법원',
    address: '서울특별시 서초구 서초동 1330-16',
    property_type: '오피스텔',
    building_name: '서초타워오피스텔',
    appraisal_value: 650000000,
    minimum_sale_price: 390000000,
    bid_deposit: 39000000,
    auction_date: '2024-12-18',
    auction_time: '14:00',
    failure_count: 2,
    current_status: 'active',
    tenant_status: '임차인 있음',
    building_year: '2015',
    floor_info: '10층/20층',
    area: 59.85,
    created_at: '2024-11-02T00:00:00.000Z',
    investment_score: 82,
    discount_rate: 40.0,
    success_probability: 85,
    estimated_final_price: 409500000,
    images: []
  },
  {
    id: 3,
    case_number: '2024타경12347',
    item_number: '1',
    court_name: '서울중앙지방법원',
    address: '서울특별시 송파구 잠실동 216',
    property_type: '아파트',
    building_name: '잠실리센츠아파트',
    appraisal_value: 1200000000,
    minimum_sale_price: 840000000,
    bid_deposit: 84000000,
    auction_date: '2024-12-20',
    auction_time: '10:30',
    failure_count: 0,
    current_status: 'active',
    tenant_status: '무',
    building_year: '2019',
    floor_info: '3층/25층',
    area: 114.85,
    created_at: '2024-11-03T00:00:00.000Z',
    investment_score: 72,
    discount_rate: 30.0,
    success_probability: 70,
    estimated_final_price: 882000000,
    images: []
  },
  {
    id: 4,
    case_number: '2024타경12348',
    item_number: '1',
    court_name: '서울중앙지방법원',
    address: '서울특별시 마포구 상암동 1654',
    property_type: '아파트',
    building_name: '상암월드컵파크아파트',
    appraisal_value: 780000000,
    minimum_sale_price: 468000000,
    bid_deposit: 46800000,
    auction_date: '2024-12-22',
    auction_time: '11:00',
    failure_count: 2,
    current_status: 'active',
    tenant_status: '무',
    building_year: '2016',
    floor_info: '8층/15층',
    area: 84.92,
    created_at: '2024-11-04T00:00:00.000Z',
    investment_score: 85,
    discount_rate: 40.0,
    success_probability: 90,
    estimated_final_price: 491400000,
    images: []
  },
  {
    id: 5,
    case_number: '2024타경12349',
    item_number: '1',
    court_name: '서울중앙지방법원',
    address: '서울특별시 용산구 한남동 726-16',
    property_type: '아파트',
    building_name: '한남더힐아파트',
    appraisal_value: 1800000000,
    minimum_sale_price: 1260000000,
    bid_deposit: 126000000,
    auction_date: '2024-12-25',
    auction_time: '14:30',
    failure_count: 0,
    current_status: 'active',
    tenant_status: '무',
    building_year: '2020',
    floor_info: '15층/20층',
    area: 134.78,
    created_at: '2024-11-05T00:00:00.000Z',
    investment_score: 68,
    discount_rate: 30.0,
    success_probability: 65,
    estimated_final_price: 1323000000,
    images: []
  }
];

class DummyDataService {
  constructor() {
    this.properties = dummyProperties;
    this.stats = {
      totalActiveProperties: 5,
      newTodayCount: 2,
      averageInvestmentScore: 77,
      highScoreCount: 2
    };
  }

  async getDashboardStats() {
    return this.stats;
  }

  async getProperties(filters = {}) {
    const {
      page = 1,
      limit = 20,
      sort = 'auction_date',
      order = 'ASC',
      region,
      propertyType,
      minPrice,
      maxPrice,
      minScore
    } = filters;

    let filtered = [...this.properties];

    // 필터링
    if (region) {
      filtered = filtered.filter(p => p.address.includes(region));
    }

    if (propertyType) {
      filtered = filtered.filter(p => p.property_type === propertyType);
    }

    if (minPrice) {
      filtered = filtered.filter(p => p.minimum_sale_price >= minPrice * 100000000);
    }

    if (maxPrice) {
      filtered = filtered.filter(p => p.minimum_sale_price <= maxPrice * 100000000);
    }

    if (minScore) {
      filtered = filtered.filter(p => p.investment_score >= minScore);
    }

    // 정렬
    filtered.sort((a, b) => {
      const aVal = a[sort] || 0;
      const bVal = b[sort] || 0;
      
      if (order.toUpperCase() === 'DESC') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // 페이지네이션
    const offset = (page - 1) * limit;
    const paginatedProperties = filtered.slice(offset, offset + limit);

    return {
      properties: paginatedProperties,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filtered.length / limit),
        totalCount: filtered.length,
        hasNext: page < Math.ceil(filtered.length / limit),
        hasPrev: page > 1
      }
    };
  }

  async getPropertyById(id) {
    const property = this.properties.find(p => p.id === parseInt(id));
    return property || null;
  }

  async getRegionStats() {
    const regionStats = [
      { region: '강남구', propertyCount: 2, averageScore: 75, averageDiscountRate: 30.0 },
      { region: '서초구', propertyCount: 1, averageScore: 82, averageDiscountRate: 40.0 },
      { region: '송파구', propertyCount: 1, averageScore: 72, averageDiscountRate: 30.0 },
      { region: '마포구', propertyCount: 1, averageScore: 85, averageDiscountRate: 40.0 },
      { region: '용산구', propertyCount: 1, averageScore: 68, averageDiscountRate: 30.0 }
    ];

    return regionStats;
  }

  async getTopProperties(type = 'score', limit = 10) {
    const sorted = [...this.properties];
    
    if (type === 'score') {
      sorted.sort((a, b) => b.investment_score - a.investment_score);
    } else if (type === 'discount') {
      sorted.sort((a, b) => b.discount_rate - a.discount_rate);
    } else if (type === 'price') {
      sorted.sort((a, b) => b.minimum_sale_price - a.minimum_sale_price);
    }

    return sorted.slice(0, limit);
  }

  async getScrapingLogs(limit = 10) {
    return [
      {
        source_site: 'sample_data',
        scraping_date: '2024-11-09T12:00:00.000Z',
        total_found: 5,
        new_items: 5,
        updated_items: 0,
        error_count: 0,
        status: 'completed',
        execution_time: 0.5
      }
    ];
  }

  // 실시간 업데이트 시뮬레이션
  simulateDataUpdate() {
    // 투자 점수 약간씩 변경
    this.properties.forEach(p => {
      const change = (Math.random() - 0.5) * 4; // -2 ~ +2점 변경
      p.investment_score = Math.max(0, Math.min(100, p.investment_score + change));
    });

    // 통계 업데이트
    const scores = this.properties.map(p => p.investment_score);
    this.stats.averageInvestmentScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    this.stats.highScoreCount = scores.filter(s => s >= 80).length;
    this.stats.newTodayCount = Math.floor(Math.random() * 3) + 1;
  }
}

module.exports = DummyDataService;