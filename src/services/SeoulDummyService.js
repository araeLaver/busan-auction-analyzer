// 서울 경매 샘플 데이터를 메모리에서 관리하는 서비스

class SeoulDummyService {
  constructor() {
    this.properties = [];
    this.initializeSeoulData();
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

  initializeSeoulData() {
    console.log('🏗️ 서울시 샘플 데이터 생성 중...');
    
    const seoulDistricts = [
      '강남구', '서초구', '송파구', '강동구', '영등포구', '구로구', 
      '금천구', '동작구', '관악구', '서대문구', '마포구', '은평구',
      '종로구', '중구', '용산구', '성동구', '광진구', '동대문구',
      '중랑구', '성북구', '강북구', '도봉구', '노원구', '강서구', '양천구'
    ];

    const propertyTypes = [
      { type: '아파트', weight: 45 },
      { type: '오피스텔', weight: 25 },
      { type: '다세대주택', weight: 12 },
      { type: '단독주택', weight: 8 },
      { type: '상가', weight: 8 },
      { type: '토지', weight: 2 }
    ];

    const apartmentNames = [
      '래미안', '아이파크', '푸르지오', '자이', '힐스테이트', 
      'e편한세상', '더샵', '롯데캐슬', '아크로', '디에이치',
      '레미안', '센트럴파크', '트리마제', '위브', '꿈의숲'
    ];

    const seoulRealAddresses = {
      '강남구': [
        '서울 강남구 테헤란로 123',
        '서울 강남구 강남대로 456', 
        '서울 강남구 논현로 789',
        '서울 강남구 압구정로 111',
        '서울 강남구 청담동 12-34',
        '서울 강남구 삼성동 456-78',
        '서울 강남구 대치동 123-45'
      ],
      '서초구': [
        '서울 서초구 반포대로 123',
        '서울 서초구 서초대로 456',
        '서울 서초구 강남대로 789',
        '서울 서초구 방배로 111',
        '서울 서초구 양재동 12-34'
      ],
      '송파구': [
        '서울 송파구 올림픽로 123',
        '서울 송파구 송파대로 456',
        '서울 송파구 잠실동 123-45',
        '서울 송파구 문정동 456-78',
        '서울 송파구 석촌동 789-12'
      ],
      '강동구': [
        '서울 강동구 천호대로 123',
        '서울 강동구 성내로 456',
        '서울 강동구 길동 123-45',
        '서울 강동구 둔촌동 456-78'
      ],
      '영등포구': [
        '서울 영등포구 여의대로 123',
        '서울 영등포구 당산로 456',
        '서울 영등포구 영등포로 789',
        '서울 영등포구 신길로 111'
      ],
      '구로구': [
        '서울 구로구 구로중앙로 123',
        '서울 구로구 디지털로 456',
        '서울 구로구 구로동 123-45',
        '서울 구로구 신도림동 456-78'
      ],
      '종로구': [
        '서울 종로구 종로 123',
        '서울 종로구 청계천로 456',
        '서울 종로구 인사동길 789',
        '서울 종로구 삼청로 111'
      ],
      '중구': [
        '서울 중구 을지로 123',
        '서울 중구 명동길 456',
        '서울 중구 퇴계로 789',
        '서울 중구 동호로 111'
      ],
      '용산구': [
        '서울 용산구 한강대로 123',
        '서울 용산구 이태원로 456',
        '서울 용산구 서빙고로 789',
        '서울 용산구 한남대로 111'
      ],
      '마포구': [
        '서울 마포구 마포대로 123',
        '서울 마포구 홍익로 456',
        '서울 마포구 양화로 789'
      ],
      '서대문구': [
        '서울 서대문구 신촌로 123',
        '서울 서대문구 연세로 456',
        '서울 서대문구 독립문로 789'
      ]
    };

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

    function getRandomArea(type) {
      const areas = {
        '아파트': [59, 74, 84, 101, 114, 125, 135],
        '오피스텔': [23, 33, 45, 59, 74, 84],
        '다세대주택': [40, 60, 80, 100, 120],
        '단독주택': [120, 150, 200, 250, 300, 400],
        '상가': [30, 50, 80, 120, 200, 300],
        '토지': [100, 200, 330, 500, 660, 1000, 1500]
      };
      return getRandomElement(areas[type] || [84]);
    }

    function generateAddress(district, type) {
      const addresses = seoulRealAddresses[district] || ['서울 중구 세종대로 110'];
      return getRandomElement(addresses);
    }

    function calculateInvestmentScore(discountRate, failureCount, propertyType, district) {
      let score = 50;
      
      // 할인율에 따른 점수 (할인율이 클수록 높은 점수)
      score += Math.min(discountRate * 0.8, 30);
      
      // 유찰 횟수에 따른 감점
      score -= failureCount * 5;
      
      // 물건 종류에 따른 가중치
      const typeScores = {
        '아파트': 12,
        '오피스텔': 10,
        '상가': 6,
        '다세대주택': 4,
        '단독주택': 3,
        '토지': 1
      };
      score += typeScores[propertyType] || 0;
      
      // 서울 지역별 가중치 (강남, 서초, 송파 등 프리미엄)
      const districtScores = {
        '강남구': 15,
        '서초구': 14,
        '송파구': 12,
        '강동구': 10,
        '영등포구': 9,
        '구로구': 7,
        '종로구': 11,
        '중구': 10,
        '용산구': 13,
        '마포구': 8,
        '서대문구': 7,
        '은평구': 6
      };
      score += districtScores[district] || 5;
      
      return Math.max(30, Math.min(95, Math.round(score)));
    }

    // 150개의 서울 샘플 데이터 생성 (서울이 더 크니까)
    for (let i = 1; i <= 150; i++) {
      const district = getRandomElement(seoulDistricts);
      const propertyType = getWeightedRandom(propertyTypes);
      const apartmentName = getRandomElement(apartmentNames);
      const area = getRandomArea(propertyType);
      
      // 서울 감정가는 부산보다 1.5~2배 높게
      const basePrice = propertyType === '아파트' 
        ? (district.includes('강남') || district.includes('서초') ? 40000000 : 25000000)
        : propertyType === '오피스텔' 
        ? 20000000 
        : 15000000;
      
      const appraisalValue = Math.floor(area * basePrice / 3.3 * (0.8 + Math.random() * 0.4));
      
      // 할인율 (15% ~ 40%)
      const discountRate = Math.floor(Math.random() * 25 + 15);
      const minimumSalePrice = Math.floor(appraisalValue * (100 - discountRate) / 100);
      const failureCount = Math.floor(Math.random() * 4);
      
      // 경매 날짜 (2024년 12월 ~ 2025년 4월)
      const auctionDate = new Date(2024, 11 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 28) + 1);
      
      // 건물명 생성
      const buildingName = propertyType === '아파트' 
        ? `${apartmentName} ${district}`
        : propertyType === '오피스텔'
        ? `${district} ${apartmentName} 오피스텔`
        : '';
      
      // 투자 점수 계산
      const investmentScore = calculateInvestmentScore(discountRate, failureCount, propertyType, district);
      
      // 낙찰 예상가
      const estimatedFinalPrice = minimumSalePrice * (1 + Math.random() * 0.18);
      
      // 성공 확률
      const successProbability = Math.max(25, Math.min(95, 100 - failureCount * 15 + Math.random() * 25));
      
      const property = {
        id: i,
        case_number: `2024타경${String(30000 + i).padStart(5, '0')}`,
        item_number: '1',
        court_name: '서울중앙지방법원',
        address: generateAddress(district, propertyType),
        property_type: propertyType,
        building_name: buildingName,
        appraisal_value: appraisalValue,
        minimum_sale_price: minimumSalePrice,
        bid_deposit: Math.floor(minimumSalePrice * 0.1),
        auction_date: auctionDate.toISOString().split('T')[0],
        auction_time: `${Math.floor(Math.random() * 5) + 10}:${Math.random() > 0.5 ? '00' : '30'}`,
        failure_count: failureCount,
        current_status: 'active',
        tenant_status: Math.random() > 0.65 ? '무' : '임차인있음',
        building_year: String(1995 + Math.floor(Math.random() * 29)),
        floor_info: propertyType === '아파트' || propertyType === '오피스텔' 
          ? `${Math.floor(Math.random() * 25) + 1}층/${Math.floor(Math.random() * 15) + 20}층`
          : '',
        area: area,
        created_at: this.getRandomCreateDate(i),
        updated_at: new Date().toISOString(),
        investment_score: investmentScore,
        discount_rate: discountRate,
        success_probability: Math.round(successProbability),
        estimated_final_price: Math.round(estimatedFinalPrice),
        images: []
      };
      
      this.properties.push(property);
    }
    
    console.log(`✅ ${this.properties.length}개 서울시 샘플 데이터 생성 완료`);
    
    // 생성 통계 출력
    const typeCounts = {};
    const districtCounts = {};
    this.properties.forEach(p => {
      typeCounts[p.property_type] = (typeCounts[p.property_type] || 0) + 1;
      const district = p.address.split(' ')[1];
      districtCounts[district] = (districtCounts[district] || 0) + 1;
    });
    
    console.log('📊 물건 유형 분포:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}개`);
    });
    
    console.log('📍 주요 지역 분포:');
    Object.entries(districtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([district, count]) => {
        console.log(`  - ${district}: ${count}개`);
      });
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
      newTodayCount: todayProperties.length,
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
      const district = p.address.split(' ')[1]; // "서울특별시 강남구 ..."에서 "강남구" 추출
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

    // 물건 수 많은 순으로 정렬
    return Object.values(stats).sort((a, b) => b.totalProperties - a.totalProperties);
  }
}

module.exports = SeoulDummyService;