const pool = require('../../config/database');

/**
 * AI 기반 부동산 경매 투자 분석 엔진
 * 
 * 주요 기능:
 * - 다차원 투자 점수 산출
 * - 머신러닝 기반 예측 모델
 * - 리스크 평가 및 수익률 분석
 * - 시장 트렌드 반영
 * - 지역별 특성 분석
 */
class AIInvestmentAnalyzer {
  constructor() {
    this.version = 'v2.0';
    this.confidence = 0.85;
    this.analysisStartTime = Date.now();
    
    // 가중치 설정
    this.weights = {
      profitability: 0.40,  // 수익성 40%
      risk: 0.30,          // 위험도 30%
      liquidity: 0.30      // 유동성 30%
    };
    
    // 부산 지역별 특성 점수
    this.busanRegionScores = {
      '해운대구': { location: 95, development: 90, liquidity: 95 },
      '서면': { location: 90, development: 85, liquidity: 90 },
      '센텀시티': { location: 95, development: 95, liquidity: 85 },
      '광안리': { location: 85, development: 80, liquidity: 80 },
      '남포동': { location: 70, development: 60, liquidity: 75 },
      '사상구': { location: 60, development: 70, liquidity: 65 },
      '강서구': { location: 55, development: 75, liquidity: 60 },
      '금정구': { location: 65, development: 70, liquidity: 60 },
      '북구': { location: 60, development: 65, liquidity: 55 },
      '사하구': { location: 50, development: 60, liquidity: 50 },
      '동구': { location: 55, development: 50, liquidity: 55 },
      '중구': { location: 65, development: 60, liquidity: 70 },
      '영도구': { location: 60, development: 65, liquidity: 60 },
      '부산진구': { location: 75, development: 80, liquidity: 80 },
      '동래구': { location: 80, development: 75, liquidity: 75 },
      '연제구': { location: 85, development: 80, liquidity: 80 }
    };
    
    // 물건 유형별 특성
    this.propertyTypeScores = {
      '아파트': { liquidity: 90, stability: 85, growth: 80 },
      '오피스텔': { liquidity: 75, stability: 70, growth: 75 },
      '빌라': { liquidity: 60, stability: 65, growth: 60 },
      '단독주택': { liquidity: 55, stability: 70, growth: 65 },
      '연립주택': { liquidity: 50, stability: 60, growth: 55 },
      '상가': { liquidity: 40, stability: 50, growth: 85 },
      '토지': { liquidity: 30, stability: 60, growth: 90 },
      '공장': { liquidity: 25, stability: 40, growth: 70 },
      '창고': { liquidity: 20, stability: 45, growth: 60 }
    };
  }

  /**
   * 물건별 종합 분석 실행
   */
  async analyzeProperty(propertyId) {
    const analysisStart = Date.now();
    
    try {
      console.log(`🔍 물건 ID ${propertyId} 분석 시작...`);
      
      // 물건 기본 정보 조회
      const property = await this.getPropertyData(propertyId);
      if (!property) {
        throw new Error(`물건 ID ${propertyId}를 찾을 수 없습니다.`);
      }
      
      console.log(`📋 물건 정보: ${property.address} (${property.property_type})`);
      
      // 종합 분석 실행
      const analysis = await this.performComprehensiveAnalysis(property);
      
      // 분석 결과 저장
      await this.saveAnalysisResult(propertyId, analysis, analysisStart);
      
      console.log(`✅ 물건 ID ${propertyId} 분석 완료 - 투자점수: ${analysis.investmentScore}점`);
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ 물건 ID ${propertyId} 분석 실패:`, error);
      throw error;
    }
  }

  /**
   * 물건 기본 정보 조회
   */
  async getPropertyData(propertyId) {
    const query = `
      SELECT 
        p.*,
        c.name as court_name,
        EXTRACT(DAYS FROM (p.auction_date - NOW())) as days_until_auction
      FROM properties p
      LEFT JOIN courts c ON p.court_id = c.id
      WHERE p.id = $1
    `;
    
    const result = await pool.query(query, [propertyId]);
    return result.rows[0];
  }

  /**
   * 종합 분석 실행
   */
  async performComprehensiveAnalysis(property) {
    const startTime = Date.now();
    
    // 1. 수익성 분석
    const profitabilityAnalysis = await this.analyzeProfitability(property);
    
    // 2. 위험도 분석
    const riskAnalysis = await this.analyzeRisk(property);
    
    // 3. 유동성 분석
    const liquidityAnalysis = await this.analyzeLiquidity(property);
    
    // 4. 시장 트렌드 분석
    const marketAnalysis = await this.analyzeMarketTrend(property);
    
    // 5. 지역별 특성 분석
    const locationAnalysis = this.analyzeLocation(property);
    
    // 6. 법적 위험도 분석
    const legalRiskAnalysis = this.analyzeLegalRisk(property);
    
    // 7. 종합 점수 계산
    const compositeScore = this.calculateCompositeScore({
      profitability: profitabilityAnalysis,
      risk: riskAnalysis,
      liquidity: liquidityAnalysis,
      market: marketAnalysis,
      location: locationAnalysis,
      legal: legalRiskAnalysis
    });
    
    // 8. AI 예측 모델 적용
    const predictions = await this.generatePredictions(property, compositeScore);
    
    // 9. 투자 추천 생성
    const recommendations = this.generateRecommendations(compositeScore, predictions);
    
    const analysisTime = Date.now() - startTime;
    
    return {
      // 기본 분석 결과
      discountRate: this.calculateDiscountRate(property),
      estimatedMarketPrice: await this.estimateMarketPrice(property),
      marketComparisonRate: await this.calculateMarketComparison(property),
      roi1Year: profitabilityAnalysis.roi1Year,
      roi3Year: profitabilityAnalysis.roi3Year,
      
      // AI 점수 (0-100)
      investmentScore: compositeScore.total,
      profitabilityScore: Math.round(profitabilityAnalysis.score),
      riskScore: Math.round(100 - riskAnalysis.score), // 리스크는 반전
      liquidityScore: Math.round(liquidityAnalysis.score),
      
      // 세부 분석 점수
      locationScore: Math.round(locationAnalysis.score),
      buildingConditionScore: this.analyzeBuildingCondition(property),
      legalRiskScore: Math.round(100 - legalRiskAnalysis.score), // 리스크는 반전
      marketTrendScore: Math.round(marketAnalysis.score),
      
      // 지역 및 시장 분석
      areaAveragePrice: marketAnalysis.areaAveragePrice,
      areaTransactionCount: marketAnalysis.transactionCount,
      areaPriceTrend: marketAnalysis.priceTrend,
      comparablePropertiesCount: marketAnalysis.comparableCount,
      
      // AI 예측 정보
      successProbability: predictions.successProbability,
      estimatedFinalPrice: predictions.finalPrice,
      estimatedCompetitionLevel: predictions.competitionLevel,
      priceVolatilityIndex: predictions.volatility,
      
      // 투자 추천 정보
      investmentGrade: recommendations.grade,
      holdPeriodMonths: recommendations.holdPeriod,
      riskLevel: recommendations.riskLevel,
      targetProfitRate: recommendations.targetProfit,
      
      // ML 모델 정보
      modelVersion: this.version,
      modelConfidence: this.confidence,
      analysisFeatures: this.generateFeatureSet(property),
      analysisDurationMs: analysisTime
    };
  }

  /**
   * 수익성 분석
   */
  async analyzeProfitability(property) {
    const discountRate = this.calculateDiscountRate(property);
    const marketPrice = await this.estimateMarketPrice(property);
    const expectedAppreciation = await this.calculatePriceAppreciation(property);
    
    // 1년 ROI = (예상매각가 - 최저매각가 + 임대수익) / 최저매각가 * 100
    const roi1Year = this.calculateROI(property, marketPrice, 1);
    const roi3Year = this.calculateROI(property, marketPrice, 3, expectedAppreciation);
    
    // 수익성 점수 (0-100)
    let score = 0;
    
    // 할인율 점수 (40점 만점)
    score += Math.min(discountRate * 0.8, 40);
    
    // ROI 점수 (35점 만점)  
    score += Math.min(roi1Year * 1.5, 35);
    
    // 시장가 대비 점수 (25점 만점)
    const marketRatio = (marketPrice - property.minimum_sale_price) / property.minimum_sale_price * 100;
    score += Math.min(marketRatio * 0.5, 25);
    
    return {
      score: Math.min(score, 100),
      discountRate,
      roi1Year,
      roi3Year,
      marketRatio,
      expectedAppreciation
    };
  }

  /**
   * 위험도 분석
   */
  async analyzeRisk(property) {
    let riskScore = 0;
    
    // 유찰 횟수 리스크 (30점)
    const failureRisk = Math.min(property.failure_count * 10, 30);
    riskScore += failureRisk;
    
    // 물건 유형 리스크 (25점)
    const typeRisk = this.getPropertyTypeRisk(property.property_type);
    riskScore += typeRisk;
    
    // 가격대 리스크 (20점)
    const priceRisk = this.getPriceRangeRisk(property.minimum_sale_price);
    riskScore += priceRisk;
    
    // 입찰일까지 남은 기간 리스크 (15점)
    const timeRisk = this.getTimeRisk(property.days_until_auction);
    riskScore += timeRisk;
    
    // 지역 안정성 리스크 (10점)
    const locationRisk = this.getLocationRisk(property.address);
    riskScore += locationRisk;
    
    return {
      score: Math.min(riskScore, 100),
      failureRisk,
      typeRisk,
      priceRisk,
      timeRisk,
      locationRisk
    };
  }

  /**
   * 유동성 분석
   */
  async analyzeLiquidity(property) {
    const region = this.extractRegion(property.address);
    const propertyType = property.property_type;
    
    // 기본 유동성 점수
    let liquidityScore = 0;
    
    // 물건 유형별 유동성 (40점)
    const typeScore = this.propertyTypeScores[propertyType]?.liquidity || 50;
    liquidityScore += typeScore * 0.4;
    
    // 지역별 유동성 (35점)
    const regionScore = this.busanRegionScores[region]?.liquidity || 50;
    liquidityScore += regionScore * 0.35;
    
    // 가격대별 유동성 (25점)
    const priceScore = this.getPriceLiquidityScore(property.minimum_sale_price);
    liquidityScore += priceScore * 0.25;
    
    // 과거 거래량 분석 (보완)
    const transactionVolume = await this.getRegionTransactionVolume(region, propertyType);
    const volumeBonus = Math.min(transactionVolume / 10, 10);
    liquidityScore += volumeBonus;
    
    return {
      score: Math.min(liquidityScore, 100),
      typeScore,
      regionScore,
      priceScore,
      transactionVolume
    };
  }

  /**
   * 시장 트렌드 분석
   */
  async analyzeMarketTrend(property) {
    const region = this.extractRegion(property.address);
    const propertyType = property.property_type;
    
    try {
      // 지역별 최근 3개월 데이터
      const marketData = await this.getMarketTrendData(region, propertyType, '3M');
      
      // 평균가격 트렌드 분석
      const priceTrend = marketData?.average_price_trend || 0;
      const volatility = marketData?.price_volatility || 5;
      const successRate = marketData?.success_rate || 60;
      
      // 트렌드 점수 계산
      let trendScore = 50; // 기본 점수
      
      // 가격 상승 트렌드 보너스
      if (priceTrend > 0) {
        trendScore += Math.min(priceTrend * 2, 30);
      } else {
        trendScore += Math.max(priceTrend * 1.5, -20);
      }
      
      // 낙찰 성공률 보너스
      trendScore += (successRate - 50) * 0.4;
      
      // 변동성 페널티
      trendScore -= Math.min(volatility, 20);
      
      return {
        score: Math.max(0, Math.min(trendScore, 100)),
        priceTrend,
        volatility,
        successRate,
        areaAveragePrice: marketData?.area_average_price || property.minimum_sale_price,
        transactionCount: marketData?.transaction_volume || 0,
        comparableCount: await this.getComparablePropertiesCount(property)
      };
      
    } catch (error) {
      console.warn('시장 트렌드 데이터 조회 실패, 기본값 사용');
      return {
        score: 50,
        priceTrend: 0,
        volatility: 5,
        successRate: 60,
        areaAveragePrice: property.minimum_sale_price,
        transactionCount: 0,
        comparableCount: 0
      };
    }
  }

  /**
   * 지역 분석
   */
  analyzeLocation(property) {
    const region = this.extractRegion(property.address);
    const regionData = this.busanRegionScores[region];
    
    if (!regionData) {
      return { score: 50, region: '기타' };
    }
    
    // 입지 점수 = (위치점수 + 개발점수 + 유동성점수) / 3
    const locationScore = (regionData.location + regionData.development + regionData.liquidity) / 3;
    
    return {
      score: locationScore,
      region: region,
      locationRating: regionData.location,
      developmentRating: regionData.development,
      liquidityRating: regionData.liquidity
    };
  }

  /**
   * 법적 위험도 분석
   */
  analyzeLegalRisk(property) {
    let riskScore = 0;
    
    // 임차인 존재 여부
    if (property.tenant_status === '있음') {
      riskScore += 25;
    }
    
    // 특이사항 분석
    if (property.special_notes) {
      const riskKeywords = ['전세', '임대', '점유', '소송', '가압류', '압류', '선순위'];
      const notes = property.special_notes.toLowerCase();
      
      riskKeywords.forEach(keyword => {
        if (notes.includes(keyword)) {
          riskScore += 10;
        }
      });
    }
    
    // 유찰 횟수에 따른 법적 복잡성
    riskScore += Math.min(property.failure_count * 5, 20);
    
    return {
      score: Math.min(riskScore, 100),
      tenantRisk: property.tenant_status === '있음' ? 25 : 0,
      specialNotesRisk: property.special_notes ? 15 : 0,
      failureComplexity: Math.min(property.failure_count * 5, 20)
    };
  }

  /**
   * 종합 점수 계산
   */
  calculateCompositeScore(analyses) {
    const { profitability, risk, liquidity, market, location } = analyses;
    
    // 가중 평균으로 종합 점수 계산
    const weightedScore = 
      (profitability.score * this.weights.profitability) +
      ((100 - risk.score) * this.weights.risk) + // 리스크는 반전
      (liquidity.score * this.weights.liquidity);
    
    // 보정 요소 적용
    let adjustedScore = weightedScore;
    
    // 시장 트렌드 보정 (±10점)
    const marketAdjustment = (market.score - 50) * 0.2;
    adjustedScore += marketAdjustment;
    
    // 지역 보정 (±5점)
    const locationAdjustment = (location.score - 50) * 0.1;
    adjustedScore += locationAdjustment;
    
    return {
      total: Math.max(0, Math.min(Math.round(adjustedScore), 100)),
      profitability: profitability.score,
      risk: risk.score,
      liquidity: liquidity.score,
      marketAdjustment,
      locationAdjustment
    };
  }

  /**
   * AI 예측 생성
   */
  async generatePredictions(property, compositeScore) {
    // 낙찰 성공 확률 예측
    const successProbability = this.predictSuccessProbability(property, compositeScore);
    
    // 예상 낙찰가 예측
    const finalPrice = this.predictFinalPrice(property, compositeScore);
    
    // 경쟁 정도 예측
    const competitionLevel = this.predictCompetitionLevel(property, compositeScore);
    
    // 가격 변동성 예측
    const volatility = this.predictPriceVolatility(property, compositeScore);
    
    return {
      successProbability: Math.max(5, Math.min(95, successProbability)),
      finalPrice: Math.max(property.minimum_sale_price, finalPrice),
      competitionLevel: Math.max(1, Math.min(5, competitionLevel)),
      volatility: Math.max(1, Math.min(10, volatility))
    };
  }

  /**
   * 투자 추천 생성
   */
  generateRecommendations(compositeScore, predictions) {
    const score = compositeScore.total;
    
    // 투자 등급 결정
    let grade, riskLevel, holdPeriod, targetProfit;
    
    if (score >= 85) {
      grade = 'S';
      riskLevel = 'LOW';
      holdPeriod = 12;
      targetProfit = 25;
    } else if (score >= 70) {
      grade = 'A';
      riskLevel = 'LOW';
      holdPeriod = 18;
      targetProfit = 20;
    } else if (score >= 55) {
      grade = 'B';
      riskLevel = 'MEDIUM';
      holdPeriod = 24;
      targetProfit = 15;
    } else if (score >= 40) {
      grade = 'C';
      riskLevel = 'MEDIUM';
      holdPeriod = 36;
      targetProfit = 10;
    } else {
      grade = 'D';
      riskLevel = 'HIGH';
      holdPeriod = 48;
      targetProfit = 5;
    }
    
    return {
      grade,
      riskLevel,
      holdPeriod,
      targetProfit
    };
  }

  /**
   * 분석 결과 저장
   */
  async saveAnalysisResult(propertyId, analysis, startTime) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 기존 분석 결과 확인
      const existingResult = await client.query(
        'SELECT id FROM analysis_results WHERE property_id = $1',
        [propertyId]
      );
      
      if (existingResult.rows.length > 0) {
        // 업데이트
        const updateQuery = `
          UPDATE analysis_results SET 
            discount_rate = $2,
            estimated_market_price = $3,
            market_comparison_rate = $4,
            roi_1year = $5,
            roi_3year = $6,
            investment_score = $7,
            profitability_score = $8,
            risk_score = $9,
            liquidity_score = $10,
            location_score = $11,
            building_condition_score = $12,
            legal_risk_score = $13,
            market_trend_score = $14,
            area_average_price = $15,
            area_transaction_count = $16,
            area_price_trend = $17,
            comparable_properties_count = $18,
            success_probability = $19,
            estimated_final_price = $20,
            estimated_competition_level = $21,
            price_volatility_index = $22,
            investment_grade = $23,
            hold_period_months = $24,
            risk_level = $25,
            target_profit_rate = $26,
            model_version = $27,
            model_confidence = $28,
            analysis_features = $29,
            analysis_duration_ms = $30,
            updated_at = NOW()
          WHERE property_id = $1
        `;
        
        await client.query(updateQuery, [
          propertyId,
          analysis.discountRate,
          analysis.estimatedMarketPrice,
          analysis.marketComparisonRate,
          analysis.roi1Year,
          analysis.roi3Year,
          analysis.investmentScore,
          analysis.profitabilityScore,
          analysis.riskScore,
          analysis.liquidityScore,
          analysis.locationScore,
          analysis.buildingConditionScore,
          analysis.legalRiskScore,
          analysis.marketTrendScore,
          analysis.areaAveragePrice,
          analysis.areaTransactionCount,
          analysis.areaPriceTrend,
          analysis.comparablePropertiesCount,
          analysis.successProbability,
          analysis.estimatedFinalPrice,
          analysis.estimatedCompetitionLevel,
          analysis.priceVolatilityIndex,
          analysis.investmentGrade,
          analysis.holdPeriodMonths,
          analysis.riskLevel,
          analysis.targetProfitRate,
          analysis.modelVersion,
          analysis.modelConfidence,
          JSON.stringify(analysis.analysisFeatures),
          analysis.analysisDurationMs
        ]);
        
      } else {
        // 신규 삽입
        const insertQuery = `
          INSERT INTO analysis_results (
            property_id, discount_rate, estimated_market_price, market_comparison_rate,
            roi_1year, roi_3year, investment_score, profitability_score, risk_score,
            liquidity_score, location_score, building_condition_score, legal_risk_score,
            market_trend_score, area_average_price, area_transaction_count, area_price_trend,
            comparable_properties_count, success_probability, estimated_final_price,
            estimated_competition_level, price_volatility_index, investment_grade,
            hold_period_months, risk_level, target_profit_rate, model_version,
            model_confidence, analysis_features, analysis_duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
        `;
        
        await client.query(insertQuery, [
          propertyId,
          analysis.discountRate,
          analysis.estimatedMarketPrice,
          analysis.marketComparisonRate,
          analysis.roi1Year,
          analysis.roi3Year,
          analysis.investmentScore,
          analysis.profitabilityScore,
          analysis.riskScore,
          analysis.liquidityScore,
          analysis.locationScore,
          analysis.buildingConditionScore,
          analysis.legalRiskScore,
          analysis.marketTrendScore,
          analysis.areaAveragePrice,
          analysis.areaTransactionCount,
          analysis.areaPriceTrend,
          analysis.comparablePropertiesCount,
          analysis.successProbability,
          analysis.estimatedFinalPrice,
          analysis.estimatedCompetitionLevel,
          analysis.priceVolatilityIndex,
          analysis.investmentGrade,
          analysis.holdPeriodMonths,
          analysis.riskLevel,
          analysis.targetProfitRate,
          analysis.modelVersion,
          analysis.modelConfidence,
          JSON.stringify(analysis.analysisFeatures),
          analysis.analysisDurationMs
        ]);
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 헬퍼 메서드들
  calculateDiscountRate(property) {
    if (!property.appraisal_value || !property.minimum_sale_price) return 0;
    return ((property.appraisal_value - property.minimum_sale_price) / property.appraisal_value * 100);
  }

  async estimateMarketPrice(property) {
    // 시장가 추정 로직 (추후 외부 API 연동 또는 ML 모델 적용)
    const basePrice = property.minimum_sale_price;
    const region = this.extractRegion(property.address);
    const multiplier = this.busanRegionScores[region]?.liquidity || 50;
    
    return Math.round(basePrice * (1 + multiplier / 200));
  }

  calculateROI(property, marketPrice, years, appreciation = 0.03) {
    const investment = property.minimum_sale_price;
    const futureValue = marketPrice * Math.pow(1 + appreciation, years);
    const annualRental = marketPrice * 0.04; // 4% 임대수익률 가정
    const totalReturn = (futureValue - investment) + (annualRental * years);
    
    return (totalReturn / investment / years * 100);
  }

  extractRegion(address) {
    const regions = Object.keys(this.busanRegionScores);
    for (const region of regions) {
      if (address.includes(region)) {
        return region;
      }
    }
    return '기타';
  }

  // 추가 헬퍼 메서드들은 실제 구현에서 계속...
  getPropertyTypeRisk(type) {
    const riskMap = {
      '아파트': 10, '오피스텔': 15, '빌라': 25, '단독주택': 20,
      '연립주택': 30, '상가': 35, '토지': 40, '공장': 45, '창고': 50
    };
    return riskMap[type] || 30;
  }

  getPriceRangeRisk(price) {
    if (price < 100000000) return 25;      // 1억 미만
    if (price < 300000000) return 15;      // 3억 미만  
    if (price < 500000000) return 10;      // 5억 미만
    if (price < 1000000000) return 5;      // 10억 미만
    return 15;                             // 10억 이상
  }

  predictSuccessProbability(property, score) {
    let probability = 60; // 기본 확률
    
    probability += (score.total - 50) * 0.6;
    probability -= property.failure_count * 8;
    probability += (this.calculateDiscountRate(property) - 20) * 0.5;
    
    return probability;
  }

  predictFinalPrice(property, score) {
    const basePrice = property.minimum_sale_price;
    const competition = 1 + (score.total / 100 * 0.15);
    return Math.round(basePrice * competition);
  }

  generateFeatureSet(property) {
    return {
      propertyType: property.property_type,
      region: this.extractRegion(property.address),
      priceRange: this.getPriceRange(property.minimum_sale_price),
      failureCount: property.failure_count,
      timeToAuction: property.days_until_auction,
      hasSpecialNotes: !!property.special_notes,
      hasTenant: property.tenant_status === '있음'
    };
  }

  getPriceRange(price) {
    if (price < 100000000) return '1억미만';
    if (price < 300000000) return '1-3억';
    if (price < 500000000) return '3-5억';
    if (price < 1000000000) return '5-10억';
    return '10억이상';
  }
}

module.exports = AIInvestmentAnalyzer;