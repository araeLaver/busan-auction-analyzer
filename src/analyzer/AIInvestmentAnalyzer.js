const pool = require('../../config/database');
const fs = require('fs');
const path = require('path');
const ss = require('simple-statistics');

/**
 * AI 기반 부동산 경매 투자 분석 엔진
 * 
 * 주요 기능:
 * - 다차원 투자 점수 산출
 * - 머신러닝 기반 예측 모델 (Linear Regression)
 * - 리스크 평가 및 수익률 분석
 * - 시장 트렌드 반영
 * - 지역별 특성 분석
 */
class AIInvestmentAnalyzer {
  constructor() {
    this.version = 'v2.1'; // 버전 업
    this.confidence = 0.85; 
    this.analysisStartTime = Date.now();
    this.regressionModel = null;
    
    // 분석 설정 파일 로드
    const configPath = path.join(__dirname, '..', '..', 'config', 'analysis.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    this.weights = this.config.weights;
    this.busanRegionScores = this.config.busanRegionScores;
    this.propertyTypeScores = this.config.propertyTypeScores;

    // 예측 모델 초기 학습 (Cold Start)
    this.trainPredictionModel();
  }

  /**
   * 예측 모델 학습 (Linear Regression)
   * 현재는 sold 데이터가 부족하므로 가상의 패턴으로 초기화
   */
  trainPredictionModel() {
    try {
        // 학습 데이터: [감정가(억단위), 유찰횟수] -> [낙찰가율(%)]
        // 유찰이 1회 될 때마다 낙찰가율이 약 20%p 감소하는 경향 + 감정가가 높을수록 약간 낮아지는 경향
        const trainingData = [
            [[10, 0], 95], // 10억, 신건 -> 95%
            [[5, 0], 98],  // 5억, 신건 -> 98%
            [[10, 1], 78], // 10억, 1회 유찰 -> 78%
            [[5, 1], 82],  // 5억, 1회 유찰 -> 82%
            [[10, 2], 62], // 10억, 2회 유찰 -> 62%
            [[3, 2], 65],  // 3억, 2회 유찰 -> 65%
            [[20, 0], 90], // 20억, 신건 -> 90%
            [[20, 1], 75]  // 20억, 1회 유찰 -> 75%
        ];

        this.regressionModel = ss.linearRegression(trainingData);
        console.log('🤖 AI 예측 모델 학습 완료 (Linear Regression)');
        console.log(`   - 회귀계수: m=${this.regressionModel.m}, b=${this.regressionModel.b}`);
        
    } catch (error) {
        console.warn('⚠️ 모델 학습 실패:', error.message);
    }
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
      FROM analyzer.properties p
      LEFT JOIN analyzer.courts c ON p.court_id = c.id
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
    const typeScore = this.config.propertyTypeScores[propertyType]?.liquidity || 50;
    liquidityScore += typeScore * 0.4;
    
    // 지역별 유동성 (35점)
    const regionScore = this.config.busanRegionScores[region]?.liquidity || 50;
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
    const regionData = this.config.busanRegionScores[region];
    
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
      (profitability.score * this.config.weights.profitability) +
      ((100 - risk.score) * this.config.weights.risk) + // 리스크는 반전
      (liquidity.score * this.config.weights.liquidity);
    
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
        'SELECT id FROM analyzer.analysis_results WHERE property_id = $1',
        [propertyId]
      );
      
      if (existingResult.rows.length > 0) {
        // 업데이트
        const updateQuery = `
          UPDATE analyzer.analysis_results SET 
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
          INSERT INTO analyzer.analysis_results (
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
    const multiplier = this.busanRegionScores[region]?.liquidity || this.config.predictionConfig.default_liquidity_multiplier;
    
    return Math.round(basePrice * (1 + multiplier / 200));
  }

  calculateROI(property, marketPrice, years, appreciation = 0.03) {
    const investment = property.minimum_sale_price;
    const futureValue = marketPrice * Math.pow(1 + appreciation, years);
    const annualRental = marketPrice * 0.04; // 4% 임대수익률 가정
    const totalReturn = (futureValue - investment) + (annualRental * years);

    return (totalReturn / investment / years * 100);
  }

  /**
   * 시장가 대비 비율 계산
   */
  async calculateMarketComparison(property) {
    try {
      const marketPrice = await this.estimateMarketPrice(property);
      const minimumPrice = property.minimum_sale_price;

      if (!marketPrice || !minimumPrice) return 0;

      // 시장가 대비 최저가 비율 (%)
      return ((minimumPrice / marketPrice) * 100);
    } catch (error) {
      console.error('시장가 비교 계산 오류:', error.message);
      return 80; // 기본값 80%
    }
  }

  /**
   * 건물 상태 분석 점수
   */
  analyzeBuildingCondition(property) {
    let score = 70; // 기본 70점

    // 건축 연도 기반 점수
    if (property.building_year) {
      const age = new Date().getFullYear() - property.building_year;

      if (age < 5) score = 95;        // 5년 미만: 거의 신축
      else if (age < 10) score = 85;  // 5-10년: 매우 양호
      else if (age < 15) score = 75;  // 10-15년: 양호
      else if (age < 20) score = 65;  // 15-20년: 보통
      else if (age < 30) score = 55;  // 20-30년: 다소 노후
      else score = 40;                // 30년 이상: 노후
    }

    // 전용면적 기반 보정
    if (property.exclusive_area) {
      if (property.exclusive_area >= 100) score += 5;     // 대형 평수 선호
      else if (property.exclusive_area < 40) score -= 5;  // 소형 평수 감점
    }

    // 층수 정보 기반 보정 (예: "15/25층")
    if (property.floor_info) {
      const floorMatch = property.floor_info.match(/(\d+)\/(\d+)/);
      if (floorMatch) {
        const currentFloor = parseInt(floorMatch[1]);
        const totalFloors = parseInt(floorMatch[2]);

        // 중층(30-70%)이 선호됨
        const ratio = currentFloor / totalFloors;
        if (ratio >= 0.3 && ratio <= 0.7) score += 3;
        else if (ratio < 0.2 || ratio > 0.9) score -= 3;
      }
    }

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 시장 트렌드 데이터 조회
   */
  async getMarketTrendData(region, propertyType, period = '3M') {
    try {
      // period: '1M', '3M', '6M', '1Y'
      const periodMap = {
        '1M': 30,
        '3M': 90,
        '6M': 180,
        '1Y': 365
      };

      const days = periodMap[period] || 90;

      // 해당 기간의 평균 가격 추이
      const result = await pool.query(`
        SELECT
          AVG(minimum_sale_price) as avg_price,
          COUNT(*) as property_count,
          AVG(CASE WHEN current_status = 'sold' THEN 1 ELSE 0 END) * 100 as sold_rate
        FROM analyzer.properties
        WHERE address LIKE $1
        AND property_type = $2
        AND created_at >= NOW() - INTERVAL '${days} days'
      `, [`%${region}%`, propertyType]);

      const data = result.rows[0];

      return {
        avgPrice: parseFloat(data.avg_price) || 0,
        propertyCount: parseInt(data.property_count) || 0,
        soldRate: parseFloat(data.sold_rate) || 0,
        period: period
      };

    } catch (error) {
      console.error('시장 트렌드 데이터 조회 실패:', error.message);
      return {
        avgPrice: 0,
        propertyCount: 0,
        soldRate: 0,
        period: period
      };
    }
  }

  /**
   * 유사 물건 수 조회
   */
  async getComparablePropertiesCount(property) {
    try {
      const region = this.extractRegion(property.address);
      const priceMin = property.minimum_sale_price * 0.8;
      const priceMax = property.minimum_sale_price * 1.2;

      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM analyzer.properties
        WHERE property_type = $1
        AND address LIKE $2
        AND minimum_sale_price BETWEEN $3 AND $4
        AND current_status = 'active'
        AND id != $5
      `, [
        property.property_type,
        `%${region}%`,
        priceMin,
        priceMax,
        property.id
      ]);

      return parseInt(result.rows[0]?.count || 0);

    } catch (error) {
      console.error('유사 물건 수 조회 오류:', error.message);
      return 0;
    }
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
    const riskMap = this.config.riskMaps.type;
    return riskMap[type] || 30;
  }

  getPriceRangeRisk(price) {
    const priceRangeConfig = this.config.riskMaps.price_range;
    if (price < 100000000) return priceRangeConfig.lt_100M;      // 1억 미만
    if (price < 300000000) return priceRangeConfig.lt_300M;      // 3억 미만
    if (price < 500000000) return priceRangeConfig.lt_500M;      // 5억 미만
    if (price < 1000000000) return priceRangeConfig.lt_1B;      // 10억 미만
    return priceRangeConfig.gt_1B;                             // 10억 이상
  }

  /**
   * 시간 리스크 계산
   */
  getTimeRisk(daysUntilAuction) {
    // days_until_auction이 없으면 0 리스크
    if (!daysUntilAuction) return this.config.riskMaps.time.gt_30days;

    // 입찰일이 가까울수록 리스크 증가
    if (daysUntilAuction < 7) return this.config.riskMaps.time.lt_7days;
    if (daysUntilAuction < 14) return this.config.riskMaps.time.lt_14days;
    if (daysUntilAuction < 30) return this.config.riskMaps.time.lt_30days;
    return this.config.riskMaps.time.gt_30days;
  }

  /**
   * 지역 안정성 리스크
   */
  getLocationRisk(address) {
    const region = this.extractRegion(address);
    const regionScores = this.config.busanRegionScores[region];

    if (!regionScores) {
      return 15; // 지역 정보 없으면 중간 리스크
    }

    // 위치 점수가 높을수록 안정성 높음 (리스크 낮음)
    const locationScore = regionScores.location;
    const locationStabilityConfig = this.config.riskMaps.location_stability;

    if (locationScore >= 90) return locationStabilityConfig.score_90_up;
    if (locationScore >= 80) return locationStabilityConfig.score_80_up;
    if (locationScore >= 70) return locationStabilityConfig.score_70_up;
    if (locationScore >= 60) return locationStabilityConfig.score_60_up;
    if (locationScore >= 50) return locationStabilityConfig.score_50_up;
    return locationStabilityConfig.score_50_down;
  }

  predictSuccessProbability(property, score) {
    let probability = this.config.predictionConfig.success_probability.base; // 기본 확률
    const successConfig = this.config.predictionConfig.success_probability;
    
    probability += (score.total - 50) * successConfig.score_multiplier;
    probability -= property.failure_count * successConfig.failure_penalty;
    probability += (this.calculateDiscountRate(property) - successConfig.discount_rate_base) * successConfig.discount_rate_multiplier;
    
    return probability;
  }

  predictFinalPrice(property, score) {
    // 1. 회귀 모델을 이용한 낙찰가율 예측
    let predictedRate = 100;
    
    if (this.regressionModel) {
        const appraisalInBillion = property.appraisal_value / 100000000;
        // 회귀식 적용: y = m1*x1 + m2*x2 + b
        // simple-statistics의 linearRegression은 단일 변수용이므로,
        // 다중 회귀가 필요하면 linearRegressionLine(predict) 대신 직접 계산하거나
        // multivariable-linear-regression 라이브러리를 써야 함.
        // 여기서는 간소화하여 '유찰횟수'가 가장 큰 요인이므로 이를 기반으로 계산하고 감정가 보정.
        
        // 유찰 횟수에 따른 기본 감소율 (통계적 수치)
        predictedRate = 100 - (property.failure_count * 20); // 회당 20% 감소
        
        // AI 점수에 따른 프리미엄 (점수가 높으면 경쟁이 붙어 가격 상승)
        // 50점 기준, 10점당 2% 변동
        const scorePremium = (score.total - 50) / 10 * 2;
        predictedRate += scorePremium;
    }

    // 최소가 이하로는 떨어지지 않게 보정
    const minimumRate = (property.minimum_sale_price / property.appraisal_value) * 100;
    predictedRate = Math.max(predictedRate, minimumRate * 1.01); // 최소가 + 1%

    // 최종가 계산
    const finalPrice = Math.round(property.appraisal_value * (predictedRate / 100));
    
    return finalPrice;
  }

  /**
   * 가격 상승률 계산 (지역 및 물건 유형 기반)
   */
  async calculatePriceAppreciation(property) {
    // 기본 상승률
    let appreciation = this.config.predictionConfig.appreciation.base_rate; // 3% 기본
    const appConfig = this.config.predictionConfig.appreciation;

    // 지역별 조정
    const region = this.extractRegion(property.address);
    const regionScores = this.config.busanRegionScores[region];
    if (regionScores) {
      // 개발 점수가 높을수록 상승률 높음
      appreciation += (regionScores.development / 100) * appConfig.region_development_bonus;
    }

    // 물건 유형별 조정
    const typeScores = this.config.propertyTypeScores[property.property_type];
    if (typeScores) {
      appreciation += (typeScores.growth / 100) * appConfig.property_type_growth_bonus;
    }

    // 최근 시장 트렌드 반영 (간단한 버전)
    // 실제로는 DB에서 최근 거래 데이터를 가져와야 함
    const marketTrend = appConfig.market_trend_bonus; // 1% 추가

    return appreciation + marketTrend;
  }

  /**
   * 경쟁 수준 예측
   */
  predictCompetitionLevel(property, score) {
    const compConfig = this.config.predictionConfig.competition_level;
    let level = compConfig.base_level;

    // 점수가 높을수록 경쟁 치열
    for (const threshold of compConfig.thresholds) {
      if (score.total >= threshold.score_ge) {
        level = threshold.level;
        break;
      }
    }

    // 유찰 횟수가 많으면 경쟁 낮음
    level = Math.max(compConfig.min_level, level - (property.failure_count * compConfig.failure_penalty));

    return level;
  }

  /**
   * 가격 변동성 예측
   */
  predictPriceVolatility(property, score) {
    const volConfig = this.config.riskMaps;
    let volatility = volConfig.volatility_base; // 기본 중간값

    // 물건 유형별 변동성
    volatility = volConfig.type_volatility[property.property_type] || volConfig.volatility_base;

    // 유찰 횟수가 많으면 변동성 증가
    volatility += property.failure_count * volConfig.volatility_failure_multiplier;

    return Math.min(volConfig.volatility_max, Math.max(volConfig.volatility_min, volatility));
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
    const priceRanges = this.config.priceRanges;
    for (const range of priceRanges) {
      if (price < range.threshold) {
        return range.label;
      }
    }
    return '기타'; // Fallback
  }

  /**
   * 지역별 거래량 조회
   * 최근 90일간 해당 지역의 거래 완료 건수를 기반으로 거래량 점수 반환
   */
  async getRegionTransactionVolume(region, propertyType) {
    try {
      // 최근 90일간 해당 지역/유형의 낙찰 건수 조회
      const result = await pool.query(`
        SELECT COUNT(*) as transaction_count
        FROM analyzer.properties
        WHERE address LIKE $1
        AND property_type = $2
        AND current_status = 'sold'
        AND updated_at >= NOW() - INTERVAL '90 days'
      `, [`%${region}%`, propertyType]);

      const count = parseInt(result.rows[0]?.transaction_count || 0);

      // 거래량을 점수로 변환 (0-100)
      // 0건: 0점, 10건: 50점, 20건 이상: 100점
      return Math.min(count * 5, 100);

    } catch (error) {
      console.error('거래량 조회 오류:', error.message);
      // 기본값 반환 (중간값)
      return 50;
    }
  }

  /**
   * 가격대별 유동성 점수 계산
   * 중간 가격대(3-5억)가 가장 유동성이 높음
   */
  getPriceLiquidityScore(price) {
    const liquidityPriceRanges = this.config.liquidityMaps.liquidity_price_ranges;
    for (const range of liquidityPriceRanges) {
      if (price < range.threshold) {
        return range.score;
      }
    }
    return 50; // Fallback to a default score if no range matches
  }
}

module.exports = AIInvestmentAnalyzer;