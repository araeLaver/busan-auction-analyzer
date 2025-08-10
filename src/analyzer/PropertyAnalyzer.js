const pool = require('../../config/database');

class PropertyAnalyzer {
  constructor() {
    this.analysisVersion = '1.0';
  }

  async analyzeAllProperties() {
    console.log('📊 전체 물건 분석 시작...');
    
    try {
      const query = `
        SELECT p.*, c.name as court_name 
        FROM properties p 
        LEFT JOIN courts c ON p.court_id = c.id 
        WHERE p.current_status = 'active'
        AND (p.id NOT IN (SELECT property_id FROM analysis_results) 
             OR p.updated_at > (SELECT MAX(analysis_date) FROM analysis_results WHERE property_id = p.id))
        ORDER BY p.created_at DESC
      `;
      
      const result = await pool.query(query);
      const properties = result.rows;
      
      console.log(`🎯 분석할 물건 수: ${properties.length}개`);
      
      for (const property of properties) {
        try {
          await this.analyzeProperty(property);
          console.log(`✅ 분석 완료: ${property.case_number}-${property.item_number}`);
        } catch (error) {
          console.error(`❌ 분석 오류 (${property.case_number}):`, error.message);
        }
      }
      
      console.log('📊 전체 분석 완료');
      
    } catch (error) {
      console.error('❌ 분석 프로세스 오류:', error);
      throw error;
    }
  }

  async analyzeProperty(property) {
    const analysis = {
      propertyId: property.id,
      discountRate: this.calculateDiscountRate(property),
      estimatedMarketPrice: await this.estimateMarketPrice(property),
      investmentScore: 0,
      profitabilityScore: 0,
      riskScore: 0,
      liquidityScore: 0,
      successProbability: 0
    };

    // 지역 평균 데이터 조회
    const regionData = await this.getRegionData(property.address);
    analysis.areaAveragePrice = regionData.averagePrice;
    analysis.areaTransactionCount = regionData.transactionCount;

    // 시세 비교율 계산
    if (analysis.estimatedMarketPrice && property.minimum_sale_price) {
      analysis.marketComparisonRate = 
        (analysis.estimatedMarketPrice - property.minimum_sale_price) * 100.0 / analysis.estimatedMarketPrice;
    }

    // 투자 점수 계산
    analysis.profitabilityScore = this.calculateProfitabilityScore(property, analysis);
    analysis.riskScore = this.calculateRiskScore(property, analysis);
    analysis.liquidityScore = this.calculateLiquidityScore(property, analysis);
    analysis.investmentScore = this.calculateInvestmentScore(analysis);
    
    // 낙찰 확률 예측
    analysis.successProbability = this.predictSuccessProbability(property, analysis);
    
    // 예상 낙찰가 계산
    analysis.estimatedFinalPrice = this.estimateFinalPrice(property, analysis);

    // 데이터베이스 저장
    await this.saveAnalysisResult(analysis);

    return analysis;
  }

  calculateDiscountRate(property) {
    if (!property.appraisal_value || !property.minimum_sale_price) return null;
    
    return Math.round(
      (property.appraisal_value - property.minimum_sale_price) * 100.0 / property.appraisal_value * 100
    ) / 100;
  }

  async estimateMarketPrice(property) {
    try {
      // 간단한 추정: 감정가의 90-95% 정도로 추정
      if (!property.appraisal_value) return null;
      
      // 지역별, 물건 유형별 보정 계수 적용
      const regionMultiplier = await this.getRegionMultiplier(property.address);
      const typeMultiplier = this.getPropertyTypeMultiplier(property.property_type);
      
      const basePrice = property.appraisal_value * 0.92; // 기본 92%
      return Math.round(basePrice * regionMultiplier * typeMultiplier);
      
    } catch (error) {
      console.error('시세 추정 오류:', error);
      return property.appraisal_value ? Math.round(property.appraisal_value * 0.9) : null;
    }
  }

  async getRegionData(address) {
    try {
      // 주소에서 구/동 추출
      const addressParts = address.split(' ');
      const sido = '서울특별시';
      const sigungu = addressParts.find(part => part.includes('구')) || '';
      const dong = addressParts.find(part => part.includes('동')) || '';

      const query = `
        SELECT average_price_per_sqm, total_auction_count 
        FROM regions 
        WHERE sido = $1 AND sigungu ILIKE $2 AND dong ILIKE $3
      `;
      
      const result = await pool.query(query, [sido, `%${sigungu}%`, `%${dong}%`]);
      
      if (result.rows.length > 0) {
        return {
          averagePrice: result.rows[0].average_price_per_sqm,
          transactionCount: result.rows[0].total_auction_count
        };
      }
      
      return { averagePrice: null, transactionCount: 0 };
      
    } catch (error) {
      console.error('지역 데이터 조회 오류:', error);
      return { averagePrice: null, transactionCount: 0 };
    }
  }

  async getRegionMultiplier(address) {
    // 지역별 보정 계수 (서울 지역 특성 반영)
    const regionMultipliers = {
      '강남구': 1.2,
      '서초구': 1.15,
      '송파구': 1.1,
      '중구': 1.0,
      '용산구': 0.98,
      '마포구': 0.95,
      '영등포구': 0.93,
      '동작구': 0.9,
      '강서구': 0.88,
      '서대문구': 0.85,
      '구로구': 0.82,
      '성동구': 0.8,
      '노원구': 0.78,
      '은평구': 0.82,
      '종로구': 1.05,
      '강북구': 0.8
    };

    for (const [region, multiplier] of Object.entries(regionMultipliers)) {
      if (address.includes(region)) {
        return multiplier;
      }
    }
    
    return 0.9; // 기본값
  }

  getPropertyTypeMultiplier(propertyType) {
    const typeMultipliers = {
      '아파트': 1.0,
      '오피스텔': 0.95,
      '단독주택': 0.9,
      '다세대주택': 0.85,
      '상가': 0.8,
      '토지': 0.75,
      '기타': 0.7
    };

    return typeMultipliers[propertyType] || 0.8;
  }

  calculateProfitabilityScore(property, analysis) {
    let score = 50; // 기본 점수

    // 할인율 점수 (높을수록 좋음)
    if (analysis.discountRate) {
      if (analysis.discountRate >= 30) score += 30;
      else if (analysis.discountRate >= 20) score += 20;
      else if (analysis.discountRate >= 10) score += 10;
    }

    // 시세 비교 점수
    if (analysis.marketComparisonRate) {
      if (analysis.marketComparisonRate >= 20) score += 20;
      else if (analysis.marketComparisonRate >= 10) score += 10;
      else if (analysis.marketComparisonRate >= 0) score += 5;
      else score -= 10; // 시세보다 높으면 감점
    }

    return Math.min(100, Math.max(0, score));
  }

  calculateRiskScore(property, analysis) {
    let score = 50; // 기본 점수 (낮을수록 위험)

    // 유찰 횟수 (많을수록 위험)
    if (property.failure_count) {
      score -= property.failure_count * 15;
    }

    // 물건 유형별 위험도
    const riskByType = {
      '아파트': 10,
      '오피스텔': 5,
      '단독주택': -5,
      '상가': -10,
      '토지': -15
    };
    
    score += riskByType[property.property_type] || -5;

    // 지역별 유동성 (해운대, 수영구 등 인기 지역은 위험도 낮음)
    if (property.address) {
      if (property.address.includes('해운대') || property.address.includes('수영구')) {
        score += 15;
      } else if (property.address.includes('강남구') || property.address.includes('서초구')) {
        score += 10;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  calculateLiquidityScore(property, analysis) {
    let score = 50; // 기본 점수

    // 물건 유형별 유동성
    const liquidityByType = {
      '아파트': 20,
      '오피스텔': 15,
      '단독주택': 5,
      '상가': 0,
      '토지': -10
    };
    
    score += liquidityByType[property.property_type] || 0;

    // 가격대별 유동성 (너무 비싸거나 너무 저렴하면 유동성 낮음)
    if (property.minimum_sale_price) {
      const price = property.minimum_sale_price / 100000000; // 억 단위
      if (price >= 1 && price <= 10) {
        score += 20; // 1-10억 구간이 가장 유동성 좋음
      } else if (price <= 20) {
        score += 10;
      } else {
        score -= 10; // 20억 초과는 유동성 낮음
      }
    }

    // 지역 거래량 반영
    if (analysis.areaTransactionCount > 10) {
      score += 15;
    } else if (analysis.areaTransactionCount > 5) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  calculateInvestmentScore(analysis) {
    // 가중 평균으로 종합 점수 계산
    const weights = {
      profitability: 0.4,  // 수익성 40%
      risk: 0.3,          // 위험도 30%
      liquidity: 0.3      // 유동성 30%
    };

    const score = 
      analysis.profitabilityScore * weights.profitability +
      analysis.riskScore * weights.risk +
      analysis.liquidityScore * weights.liquidity;

    return Math.round(score);
  }

  predictSuccessProbability(property, analysis) {
    let probability = 50; // 기본 50%

    // 할인율이 높을수록 낙찰 확률 증가
    if (analysis.discountRate) {
      if (analysis.discountRate >= 30) probability += 30;
      else if (analysis.discountRate >= 20) probability += 20;
      else if (analysis.discountRate >= 10) probability += 10;
    }

    // 유찰 횟수 (많을수록 낙찰 확률 감소)
    probability -= (property.failure_count || 0) * 8;

    // 투자 점수 반영
    probability += (analysis.investmentScore - 50) * 0.3;

    return Math.round(Math.min(95, Math.max(5, probability)));
  }

  estimateFinalPrice(property, analysis) {
    if (!property.minimum_sale_price) return null;

    // 기본적으로 최저가의 100-110% 예상
    let multiplier = 1.0;

    // 투자 점수가 높을수록 경쟁이 치열할 것으로 예상
    if (analysis.investmentScore >= 80) {
      multiplier = 1.1;
    } else if (analysis.investmentScore >= 60) {
      multiplier = 1.05;
    }

    // 유찰 횟수가 많으면 낙찰가 낮을 것으로 예상
    if (property.failure_count >= 2) {
      multiplier *= 0.95;
    }

    return Math.round(property.minimum_sale_price * multiplier);
  }

  async saveAnalysisResult(analysis) {
    const query = `
      INSERT INTO analysis_results (
        property_id, discount_rate, estimated_market_price, market_comparison_rate,
        investment_score, profitability_score, risk_score, liquidity_score,
        area_average_price, area_transaction_count, success_probability,
        estimated_final_price, analysis_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (property_id) 
      DO UPDATE SET
        discount_rate = EXCLUDED.discount_rate,
        estimated_market_price = EXCLUDED.estimated_market_price,
        market_comparison_rate = EXCLUDED.market_comparison_rate,
        investment_score = EXCLUDED.investment_score,
        profitability_score = EXCLUDED.profitability_score,
        risk_score = EXCLUDED.risk_score,
        liquidity_score = EXCLUDED.liquidity_score,
        area_average_price = EXCLUDED.area_average_price,
        area_transaction_count = EXCLUDED.area_transaction_count,
        success_probability = EXCLUDED.success_probability,
        estimated_final_price = EXCLUDED.estimated_final_price,
        analysis_date = NOW(),
        updated_at = NOW()
    `;

    await pool.query(query, [
      analysis.propertyId,
      analysis.discountRate,
      analysis.estimatedMarketPrice,
      analysis.marketComparisonRate,
      analysis.investmentScore,
      analysis.profitabilityScore,
      analysis.riskScore,
      analysis.liquidityScore,
      analysis.areaAveragePrice,
      analysis.areaTransactionCount,
      analysis.successProbability,
      analysis.estimatedFinalPrice,
      this.analysisVersion
    ]);
  }
}

module.exports = PropertyAnalyzer;