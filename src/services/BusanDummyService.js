// 부산 경매 샘플 데이터를 메모리에서 관리하는 서비스

class BusanDummyService {
  constructor() {
    this.properties = [];
    this.initializeBusanData();
  }

  getRandomCreateDate(index) {
    const now = new Date();
    
    // 80%는 최근 30일, 20%는 오늘 생성
    if (index % 5 === 0) {
      // 20%는 오늘 생성 (오늘 신규)
      return now.toISOString();
    } else {
      // 80%는 최근 30일 내 랜덤
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    }
  }

  initializeBusanData() {
    console.log('🏗️ 부산 샘플 데이터 생성 중...');
    
    const busanDistricts = [
      '해운대구', '수영구', '남구', '동래구', '금정구', '부산진구', 
      '서구', '동구', '영도구', '사하구', '사상구', '북구'
    ];

    const propertyTypes = ['아파트', '오피스텔', '다세대주택', '상가', '토지'];
    const apartmentNames = ['래미안', '아이파크', '푸르지오', '자이', '힐스테이트', 'e편한세상'];

    // 100개의 부산 샘플 데이터 생성
    for (let i = 1; i <= 100; i++) {
      const district = busanDistricts[Math.floor(Math.random() * busanDistricts.length)];
      const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
      const apartmentName = apartmentNames[Math.floor(Math.random() * apartmentNames.length)];
      
      const appraisalValue = Math.floor(Math.random() * 1000000000 + 100000000);
      const discountRate = Math.floor(Math.random() * 30 + 20);
      const minimumSalePrice = Math.floor(appraisalValue * (100 - discountRate) / 100);
      const failureCount = Math.floor(Math.random() * 4);
      
      const property = {
        id: i,
        case_number: `2024타경${String(20000 + i).padStart(5, '0')}`,
        item_number: '1',
        court_name: '부산지방법원',
        address: `부산광역시 ${district} ${['우동', '재송동', '대연동', '광안동'][Math.floor(Math.random() * 4)]} ${Math.floor(Math.random() * 500) + 1}`,
        property_type: propertyType,
        building_name: propertyType === '아파트' ? `${apartmentName} ${district}` : '',
        appraisal_value: appraisalValue,
        minimum_sale_price: minimumSalePrice,
        bid_deposit: Math.floor(minimumSalePrice * 0.1),
        auction_date: new Date(2025, Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
        auction_time: `${Math.floor(Math.random() * 4) + 10}:00`,
        failure_count: failureCount,
        current_status: 'active',
        tenant_status: Math.random() > 0.6 ? '무' : '임차인있음',
        building_year: String(2000 + Math.floor(Math.random() * 24)),
        floor_info: propertyType === '아파트' ? `${Math.floor(Math.random() * 20) + 1}층/${Math.floor(Math.random() * 10) + 20}층` : '',
        area: [59, 74, 84, 101, 114][Math.floor(Math.random() * 5)],
        created_at: this.getRandomCreateDate(i),
        investment_score: Math.max(30, Math.min(95, 70 + (discountRate - 20) - failureCount * 10 + Math.floor(Math.random() * 20))),
        discount_rate: discountRate,
        success_probability: Math.max(20, 100 - failureCount * 20),
        estimated_final_price: Math.floor(minimumSalePrice * (1 + Math.random() * 0.15)),
        images: []
      };
      
      this.properties.push(property);
    }
    
    console.log(`✅ ${this.properties.length}개 부산 샘플 데이터 생성 완료`);
  }

  async getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayProperties = this.properties.filter(p => 
      p.created_at && p.created_at.split('T')[0] === today
    );
    
    const scores = this.properties.map(p => p.investment_score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    return {
      totalActiveProperties: this.properties.length,
      newTodayCount: todayProperties.length, // 실제 오늘 생성된 물건 수
      averageInvestmentScore: avgScore,
      highScoreCount: scores.filter(s => s >= 80).length,
      todayDate: today,
      lastUpdate: new Date().toISOString()
    };
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
      let compareValue = 0;
      
      switch(sort) {
        case 'investment_score':
          compareValue = b.investment_score - a.investment_score;
          break;
        case 'minimum_sale_price':
          compareValue = a.minimum_sale_price - b.minimum_sale_price;
          break;
        case 'discount_rate':
          compareValue = b.discount_rate - a.discount_rate;
          break;
        case 'auction_date':
        default:
          compareValue = new Date(a.auction_date) - new Date(b.auction_date);
      }
      
      return order === 'DESC' ? -compareValue : compareValue;
    });

    // 페이지네이션
    const offset = (page - 1) * limit;
    const paginatedData = filtered.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit)
      }
    };
  }

  async getPropertyById(id) {
    return this.properties.find(p => p.id === parseInt(id));
  }

  async getTopProperties(limit = 10) {
    return [...this.properties]
      .sort((a, b) => b.investment_score - a.investment_score)
      .slice(0, limit);
  }

  async getRegionStats() {
    const stats = {};
    
    this.properties.forEach(p => {
      const district = p.address.split(' ')[1];
      if (!stats[district]) {
        stats[district] = {
          region: district,
          totalProperties: 0,
          avgPrice: 0,
          avgScore: 0,
          properties: []
        };
      }
      stats[district].properties.push(p);
      stats[district].totalProperties++;
    });

    Object.values(stats).forEach(s => {
      const prices = s.properties.map(p => p.minimum_sale_price);
      const scores = s.properties.map(p => p.investment_score);
      s.avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      s.avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      delete s.properties;
    });

    return Object.values(stats);
  }
}

module.exports = BusanDummyService;