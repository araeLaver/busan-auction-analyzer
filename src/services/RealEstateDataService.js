const axios = require('axios');

class RealEstateDataService {
  constructor() {
    // 공공데이터포털 API 키 (발급받아야 함)
    this.apiKey = process.env.REAL_ESTATE_API_KEY || 'YOUR_API_KEY_HERE';
    this.baseUrl = 'http://openapi.molit.go.kr';
  }

  /**
   * 아파트 매매 실거래가 조회
   * @param {string} lawd_cd - 지역코드 (5자리)
   * @param {string} deal_ymd - 계약년월 (YYYYMM)
   */
  async getApartmentTransactions(lawd_cd, deal_ymd) {
    try {
      const url = `${this.baseUrl}/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptTradeDev`;
      
      const params = {
        serviceKey: this.apiKey,
        LAWD_CD: lawd_cd,
        DEAL_YMD: deal_ymd,
        pageNo: 1,
        numOfRows: 100
      };

      console.log(`🏠 아파트 실거래가 조회: ${lawd_cd}, ${deal_ymd}`);
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.response && response.data.response.body) {
        const items = response.data.response.body.items?.item || [];
        return Array.isArray(items) ? items : [items];
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ 아파트 실거래가 조회 오류:', error.message);
      return [];
    }
  }

  /**
   * 오피스텔 매매 실거래가 조회
   */
  async getOfficetelTransactions(lawd_cd, deal_ymd) {
    try {
      const url = `${this.baseUrl}/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcOffiTrade`;
      
      const params = {
        serviceKey: this.apiKey,
        LAWD_CD: lawd_cd,
        DEAL_YMD: deal_ymd,
        pageNo: 1,
        numOfRows: 100
      };

      console.log(`🏢 오피스텔 실거래가 조회: ${lawd_cd}, ${deal_ymd}`);
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.response && response.data.response.body) {
        const items = response.data.response.body.items?.item || [];
        return Array.isArray(items) ? items : [items];
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ 오피스텔 실거래가 조회 오류:', error.message);
      return [];
    }
  }

  /**
   * 주소로 지역코드 매핑
   */
  getRegionCode(address) {
    const regionCodes = {
      '서울특별시 강남구': '11680',
      '서울특별시 강동구': '11740',
      '서울특별시 강북구': '11305',
      '서울특별시 강서구': '11500',
      '서울특별시 관악구': '11620',
      '서울특별시 광진구': '11215',
      '서울특별시 구로구': '11530',
      '서울특별시 금천구': '11545',
      '서울특별시 노원구': '11350',
      '서울특별시 도봉구': '11320',
      '서울특별시 동대문구': '11230',
      '서울특별시 동작구': '11590',
      '서울특별시 마포구': '11440',
      '서울특별시 서대문구': '11410',
      '서울특별시 서초구': '11650',
      '서울특별시 성동구': '11200',
      '서울특별시 성북구': '11290',
      '서울특별시 송파구': '11710',
      '서울특별시 양천구': '11470',
      '서울특별시 영등포구': '11560',
      '서울특별시 용산구': '11170',
      '서울특별시 은평구': '11380',
      '서울특별시 종로구': '11110',
      '서울특별시 중구': '11140',
      '서울특별시 중랑구': '11260'
    };

    for (const [region, code] of Object.entries(regionCodes)) {
      if (address.includes(region.replace('서울특별시 ', ''))) {
        return code;
      }
    }
    
    // 기본값: 서울 강남구
    return '11680';
  }

  /**
   * 경매 물건 주변 시세 분석
   */
  async analyzeMarketPrice(address, propertyType = '아파트') {
    try {
      const regionCode = this.getRegionCode(address);
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const dealYmd = lastMonth.toISOString().slice(0, 7).replace('-', '');

      console.log(`📊 시세 분석 시작: ${address} (${regionCode}, ${dealYmd})`);

      let transactions = [];
      
      if (propertyType.includes('아파트')) {
        transactions = await this.getApartmentTransactions(regionCode, dealYmd);
      } else if (propertyType.includes('오피스텔')) {
        transactions = await this.getOfficetelTransactions(regionCode, dealYmd);
      }

      if (transactions.length === 0) {
        console.log('⚠️ 실거래가 데이터 없음');
        return null;
      }

      // 가격 통계 계산
      const prices = transactions.map(t => parseInt(t.거래금액?.replace(/,/g, '') || '0')).filter(p => p > 0);
      
      if (prices.length === 0) {
        return null;
      }

      const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      return {
        regionCode,
        transactionCount: prices.length,
        averagePrice: averagePrice * 10000, // 만원 -> 원
        maxPrice: maxPrice * 10000,
        minPrice: minPrice * 10000,
        pricePerSqm: averagePrice * 10000 / 84, // 84㎡ 기준
        analysisDate: new Date().toISOString(),
        sourceMonth: dealYmd
      };

    } catch (error) {
      console.error('❌ 시세 분석 오류:', error);
      return null;
    }
  }

  /**
   * 더미 시세 데이터 생성 (API 키가 없는 경우 테스트용)
   */
  generateDummyMarketData(address) {
    const basePrice = Math.floor(Math.random() * 500000000) + 300000000; // 3억~8억
    
    return {
      regionCode: this.getRegionCode(address),
      transactionCount: Math.floor(Math.random() * 20) + 5,
      averagePrice: basePrice,
      maxPrice: Math.floor(basePrice * 1.3),
      minPrice: Math.floor(basePrice * 0.7),
      pricePerSqm: Math.floor(basePrice / 84),
      analysisDate: new Date().toISOString(),
      sourceMonth: new Date().toISOString().slice(0, 7).replace('-', ''),
      isDummy: true
    };
  }
}

module.exports = RealEstateDataService;