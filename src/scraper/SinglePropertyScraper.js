const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class SinglePropertyScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize(headless = true) {
    this.browser = await puppeteer.launch({
      headless: headless,
      slowMo: 300,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    this.page = await this.browser.newPage();
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    console.log('🚀 개별 물건 스크래퍼 초기화 완료');
  }

  async analyzePropertyFromUrl(url) {
    try {
      console.log(`🔍 경매물건 분석 시작: ${url}`);
      
      // 페이지 접속
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('✅ 페이지 로드 완료');
      await this.page.waitForTimeout(3000);
      
      // 페이지 스크린샷 저장
      await this.page.screenshot({ 
        path: 'property-analysis.png', 
        fullPage: true 
      });
      console.log('📸 페이지 스크린샷 저장: property-analysis.png');
      
      // 물건 정보 추출
      const propertyData = await this.extractPropertyInfo();
      
      // 투자 분석 수행
      const analysis = await this.performInvestmentAnalysis(propertyData);
      
      // 결과 통합
      const result = {
        ...propertyData,
        analysis: analysis,
        sourceUrl: url,
        analyzedAt: new Date().toISOString()
      };
      
      console.log('✅ 물건 분석 완료');
      return result;
      
    } catch (error) {
      console.error('❌ 물건 분석 오류:', error);
      throw error;
    }
  }

  async extractPropertyInfo() {
    console.log('📋 물건 정보 추출 중...');
    
    const propertyInfo = await this.page.evaluate(() => {
      const data = {
        // 기본 정보
        caseNumber: '',
        itemNumber: '',
        court: '',
        address: '',
        propertyType: '',
        buildingName: '',
        
        // 면적 정보
        landArea: '',
        buildingArea: '',
        
        // 가격 정보
        appraisalValue: '',
        minimumSalePrice: '',
        bidDeposit: '',
        
        // 입찰 정보
        auctionDate: '',
        auctionTime: '',
        courtRoom: '',
        
        // 추가 정보
        tenantStatus: '',
        managementCost: '',
        specialNotes: '',
        
        // 권리 분석
        rightsAnalysis: '',
        legalStatus: '',
        
        // 이미지
        images: [],
        
        // 원시 텍스트 (분석용)
        rawText: ''
      };
      
      // 페이지의 모든 텍스트 수집
      data.rawText = document.body.textContent || '';
      
      // 테이블에서 정보 추출
      const tables = document.querySelectorAll('table');
      const allCells = [];
      
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          cells.forEach(cell => {
            const text = cell.textContent.trim();
            if (text.length > 0) {
              allCells.push(text);
            }
          });
        });
      });
      
      // 패턴 매칭으로 정보 추출
      const fullText = allCells.join(' ');
      
      // 사건번호
      const caseMatch = fullText.match(/(\d{4}타경\d+)/);
      if (caseMatch) data.caseNumber = caseMatch[1];
      
      // 물건번호
      const itemMatch = fullText.match(/물건\s*(\d+)/);
      if (itemMatch) data.itemNumber = itemMatch[1];
      
      // 법원
      const courtMatch = fullText.match(/(.*지방법원.*)/);
      if (courtMatch) data.court = courtMatch[1];
      
      // 주소 (시/도로 시작하는 긴 주소)
      const addressPatterns = [
        /([가-힣]*특별시[^,\n]*)/,
        /([가-힣]*광역시[^,\n]*)/,
        /([가-힣]*도\s+[가-힣]*시[^,\n]*)/
      ];
      
      for (const pattern of addressPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1].length > 10) {
          data.address = match[1];
          break;
        }
      }
      
      // 물건 유형
      const types = ['아파트', '오피스텔', '단독주택', '다세대', '빌라', '상가', '사무실', '토지', '공장', '창고'];
      for (const type of types) {
        if (fullText.includes(type)) {
          data.propertyType = type;
          break;
        }
      }
      
      // 가격 정보 (원 단위)
      const prices = fullText.match(/[\d,]+원/g);
      if (prices && prices.length >= 2) {
        data.appraisalValue = prices[0];
        data.minimumSalePrice = prices[1];
        if (prices.length >= 3) {
          data.bidDeposit = prices[2];
        }
      }
      
      // 면적 정보
      const areaMatch = fullText.match(/([\d,.]+)㎡/g);
      if (areaMatch) {
        data.landArea = areaMatch[0] || '';
        data.buildingArea = areaMatch[1] || '';
      }
      
      // 입찰 일시
      const dateMatch = fullText.match(/\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/);
      if (dateMatch) data.auctionDate = dateMatch[0];
      
      const timeMatch = fullText.match(/\d{1,2}:\d{2}/);
      if (timeMatch) data.auctionTime = timeMatch[0];
      
      // 법정
      const roomMatch = fullText.match(/(\d+호실?|\d+법정)/);
      if (roomMatch) data.courtRoom = roomMatch[1];
      
      // 임차인 현황
      if (fullText.includes('임차인')) {
        const tenantMatch = fullText.match(/(임차인[^.]*)/);
        if (tenantMatch) data.tenantStatus = tenantMatch[1];
      }
      
      // 관리비
      const mgmtMatch = fullText.match(/(관리비[^.]*)/);
      if (mgmtMatch) data.managementCost = mgmtMatch[1];
      
      // 이미지 수집
      const imgs = document.querySelectorAll('img');
      imgs.forEach((img, index) => {
        if (img.src && !img.src.includes('icon') && !img.src.includes('logo')) {
          data.images.push({
            url: img.src,
            alt: img.alt || '',
            index: index
          });
        }
      });
      
      return data;
    });
    
    console.log('📊 추출된 기본 정보:');
    console.log(`  사건번호: ${propertyInfo.caseNumber}`);
    console.log(`  주소: ${propertyInfo.address}`);
    console.log(`  유형: ${propertyInfo.propertyType}`);
    console.log(`  감정가: ${propertyInfo.appraisalValue}`);
    console.log(`  최저가: ${propertyInfo.minimumSalePrice}`);
    
    return propertyInfo;
  }

  async performInvestmentAnalysis(propertyData) {
    console.log('📈 투자 분석 수행 중...');
    
    const analysis = {
      // 기본 분석
      discountRate: 0,
      investmentScore: 0,
      riskLevel: 'medium',
      
      // 상세 점수
      profitabilityScore: 0,
      riskScore: 0,
      liquidityScore: 0,
      locationScore: 0,
      
      // 예측 정보
      expectedFinalPrice: 0,
      successProbability: 0,
      
      // 분석 의견
      pros: [],
      cons: [],
      recommendation: '',
      
      // 비교 분석
      marketComparison: '',
      areaAnalysis: ''
    };
    
    try {
      // 할인율 계산
      const appraisal = this.parsePrice(propertyData.appraisalValue);
      const minimum = this.parsePrice(propertyData.minimumSalePrice);
      
      if (appraisal && minimum) {
        analysis.discountRate = Math.round((appraisal - minimum) / appraisal * 100);
        analysis.expectedFinalPrice = Math.round(minimum * 1.05); // 5% 상향 예상
      }
      
      // 수익성 점수 (할인율 기준)
      if (analysis.discountRate >= 30) {
        analysis.profitabilityScore = 90;
      } else if (analysis.discountRate >= 20) {
        analysis.profitabilityScore = 75;
      } else if (analysis.discountRate >= 10) {
        analysis.profitabilityScore = 60;
      } else {
        analysis.profitabilityScore = 40;
      }
      
      // 위험도 점수 (물건 유형, 지역 기준)
      const riskFactors = this.assessRiskFactors(propertyData);
      analysis.riskScore = riskFactors.score;
      analysis.riskLevel = riskFactors.level;
      
      // 유동성 점수 (물건 유형 기준)
      analysis.liquidityScore = this.assessLiquidity(propertyData);
      
      // 입지 점수 (주소 기반)
      analysis.locationScore = this.assessLocation(propertyData.address);
      
      // 종합 투자 점수
      analysis.investmentScore = Math.round(
        (analysis.profitabilityScore * 0.4) +
        (analysis.riskScore * 0.25) +
        (analysis.liquidityScore * 0.2) +
        (analysis.locationScore * 0.15)
      );
      
      // 낙찰 확률 예측
      analysis.successProbability = this.predictSuccessProbability(analysis);
      
      // 장단점 분석
      analysis.pros = this.identifyPros(propertyData, analysis);
      analysis.cons = this.identifyCons(propertyData, analysis);
      
      // 투자 추천도
      analysis.recommendation = this.generateRecommendation(analysis);
      
      // 시장 비교 분석
      analysis.marketComparison = this.generateMarketComparison(propertyData, analysis);
      analysis.areaAnalysis = this.generateAreaAnalysis(propertyData.address);
      
    } catch (error) {
      console.error('분석 수행 중 오류:', error);
    }
    
    console.log('📊 투자 분석 결과:');
    console.log(`  종합 점수: ${analysis.investmentScore}점`);
    console.log(`  할인율: ${analysis.discountRate}%`);
    console.log(`  위험도: ${analysis.riskLevel}`);
    console.log(`  낙찰확률: ${analysis.successProbability}%`);
    
    return analysis;
  }

  parsePrice(priceStr) {
    if (!priceStr) return null;
    const numbers = priceStr.replace(/[^0-9]/g, '');
    return numbers ? parseInt(numbers) : null;
  }

  assessRiskFactors(propertyData) {
    let score = 70; // 기본 점수
    let riskFactors = [];
    
    // 물건 유형별 위험도
    const typeRisk = {
      '아파트': 5,
      '오피스텔': 0,
      '단독주택': -10,
      '상가': -15,
      '토지': -20,
      '공장': -25
    };
    
    if (propertyData.propertyType && typeRisk[propertyData.propertyType] !== undefined) {
      score += typeRisk[propertyData.propertyType];
    }
    
    // 임차인 현황
    if (propertyData.tenantStatus && propertyData.tenantStatus.includes('임차인')) {
      if (propertyData.tenantStatus.includes('없음')) {
        score += 10;
      } else {
        score -= 15;
        riskFactors.push('임차인 존재로 인한 명도 위험');
      }
    }
    
    // 지역별 위험도 (주요 도시 기준)
    if (propertyData.address) {
      if (propertyData.address.includes('강남') || propertyData.address.includes('서초')) {
        score += 15;
      } else if (propertyData.address.includes('서울')) {
        score += 10;
      } else if (propertyData.address.includes('서울') || propertyData.address.includes('대구')) {
        score += 5;
      }
    }
    
    // 위험도 등급 결정
    let level = 'medium';
    if (score >= 80) level = 'low';
    else if (score <= 50) level = 'high';
    
    return { score: Math.max(0, Math.min(100, score)), level, factors: riskFactors };
  }

  assessLiquidity(propertyData) {
    let score = 50;
    
    // 물건 유형별 유동성
    const liquidityMap = {
      '아파트': 25,
      '오피스텔': 15,
      '단독주택': 5,
      '상가': -5,
      '토지': -15,
      '공장': -20
    };
    
    if (propertyData.propertyType && liquidityMap[propertyData.propertyType] !== undefined) {
      score += liquidityMap[propertyData.propertyType];
    }
    
    // 가격대별 유동성
    const minPrice = this.parsePrice(propertyData.minimumSalePrice);
    if (minPrice) {
      const priceInBillion = minPrice / 100000000;
      if (priceInBillion >= 1 && priceInBillion <= 5) {
        score += 20; // 1-5억 구간 선호
      } else if (priceInBillion <= 10) {
        score += 10;
      } else if (priceInBillion > 20) {
        score -= 15; // 고가 물건 유동성 저하
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  assessLocation(address) {
    if (!address) return 50;
    
    let score = 50;
    
    // 주요 도시 가점
    const cityScores = {
      '서울특별시': 20,
      '서울특별시': 30,
      '대구광역시': 10,
      '인천광역시': 10,
      '대전광역시': 8,
      '광주광역시': 8
    };
    
    for (const [city, points] of Object.entries(cityScores)) {
      if (address.includes(city)) {
        score += points;
        break;
      }
    }
    
    // 주요 구/동 가점
    const premiumAreas = [
      '강남구', '서초구', '송파구', '강서구',
      '강남구', '서초구', '송파구'
    ];
    
    for (const area of premiumAreas) {
      if (address.includes(area)) {
        score += 15;
        break;
      }
    }
    
    // 교통 관련 키워드
    const transportKeywords = ['역', '지하철', '전철', '버스터미널', '고속도로'];
    for (const keyword of transportKeywords) {
      if (address.includes(keyword)) {
        score += 5;
        break;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  predictSuccessProbability(analysis) {
    let probability = 50;
    
    // 할인율이 높을수록 성공률 증가
    if (analysis.discountRate >= 25) probability += 25;
    else if (analysis.discountRate >= 15) probability += 15;
    else if (analysis.discountRate >= 5) probability += 5;
    else probability -= 10;
    
    // 종합 점수 반영
    if (analysis.investmentScore >= 80) probability += 20;
    else if (analysis.investmentScore >= 60) probability += 10;
    else if (analysis.investmentScore <= 40) probability -= 15;
    
    // 위험도 반영
    if (analysis.riskLevel === 'low') probability += 10;
    else if (analysis.riskLevel === 'high') probability -= 15;
    
    return Math.max(10, Math.min(90, probability));
  }

  identifyPros(propertyData, analysis) {
    const pros = [];
    
    if (analysis.discountRate >= 20) {
      pros.push(`높은 할인율 (${analysis.discountRate}%)`);
    }
    
    if (analysis.locationScore >= 70) {
      pros.push('우수한 입지 조건');
    }
    
    if (analysis.liquidityScore >= 70) {
      pros.push('높은 유동성');
    }
    
    if (propertyData.propertyType === '아파트') {
      pros.push('안정적인 물건 유형');
    }
    
    if (propertyData.tenantStatus && propertyData.tenantStatus.includes('없음')) {
      pros.push('임차인 없어 명도 위험 없음');
    }
    
    return pros;
  }

  identifyCons(propertyData, analysis) {
    const cons = [];
    
    if (analysis.discountRate < 10) {
      cons.push('낮은 할인율');
    }
    
    if (analysis.riskLevel === 'high') {
      cons.push('높은 투자 위험');
    }
    
    if (analysis.liquidityScore < 50) {
      cons.push('상대적으로 낮은 유동성');
    }
    
    if (propertyData.tenantStatus && !propertyData.tenantStatus.includes('없음')) {
      cons.push('임차인 명도 위험');
    }
    
    if (propertyData.propertyType === '상가' || propertyData.propertyType === '토지') {
      cons.push('전문성 요구되는 물건 유형');
    }
    
    return cons;
  }

  generateRecommendation(analysis) {
    if (analysis.investmentScore >= 80) {
      return '적극 추천 - 우수한 투자 기회';
    } else if (analysis.investmentScore >= 70) {
      return '추천 - 양호한 투자 조건';
    } else if (analysis.investmentScore >= 60) {
      return '보통 - 신중한 검토 필요';
    } else if (analysis.investmentScore >= 50) {
      return '주의 - 위험 요소 많음';
    } else {
      return '비추천 - 투자 부적합';
    }
  }

  generateMarketComparison(propertyData, analysis) {
    const minPrice = this.parsePrice(propertyData.minimumSalePrice);
    if (!minPrice) return '시세 비교 불가';
    
    const estimatedMarket = minPrice * 1.2; // 추정 시세 (20% 상향)
    const comparison = Math.round((estimatedMarket - minPrice) / minPrice * 100);
    
    return `추정 시세 대비 ${comparison}% 저렴`;
  }

  generateAreaAnalysis(address) {
    if (!address) return '지역 분석 불가';
    
    if (address.includes('강남') || address.includes('서초')) {
      return '프리미엄 지역 - 높은 가격 안정성과 상승 가능성';
    } else if (address.includes('해운대') || address.includes('센텀')) {
      return '서울 최고급 지역 - 비즈니스 및 교육 중심지';
    } else if (address.includes('서울')) {
      return '서울 지역 - 전반적으로 안정적인 부동산 시장';
    } else if (address.includes('서울')) {
      return '서울 지역 - 대한민국 수도로서의 장점';
    } else {
      return '지방 지역 - 지역 특성을 고려한 투자 필요';
    }
  }

  async saveAnalysisToJSON(analysisResult, filename = null) {
    const fs = require('fs').promises;
    
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `property-analysis-${timestamp}.json`;
    }
    
    try {
      await fs.writeFile(filename, JSON.stringify(analysisResult, null, 2), 'utf8');
      console.log(`✅ 분석 결과 저장: ${filename}`);
      return filename;
    } catch (error) {
      console.error('분석 결과 저장 오류:', error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 브라우저 종료');
    }
  }
}

module.exports = SinglePropertyScraper;