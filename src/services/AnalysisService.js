const AIInvestmentAnalyzer = require('../analyzer/AIInvestmentAnalyzer');
const pool = require('../../config/database');

/**
 * 분석 서비스 - 일괄 처리 및 스케줄링
 */
class AnalysisService {
  constructor() {
    this.analyzer = new AIInvestmentAnalyzer();
    this.isRunning = false;
    this.batchSize = 50; // 한 번에 처리할 물건 수
  }

  /**
   * 미분석 물건 일괄 분석
   */
  async analyzeUnprocessedProperties() {
    if (this.isRunning) {
      console.log('⚠️ 분석이 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let totalAnalyzed = 0;
    let totalErrors = 0;

    try {
      console.log('🚀 미분석 물건 일괄 분석 시작...');

      // 미분석 물건 목록 조회
      const unprocessedProperties = await this.getUnprocessedProperties();
      console.log(`📊 미분석 물건 수: ${unprocessedProperties.length}개`);

      if (unprocessedProperties.length === 0) {
        console.log('✅ 분석할 물건이 없습니다.');
        return { analyzed: 0, errors: 0, duration: 0 };
      }

      // 배치 단위로 분석 실행
      for (let i = 0; i < unprocessedProperties.length; i += this.batchSize) {
        const batch = unprocessedProperties.slice(i, i + this.batchSize);
        console.log(`📦 배치 ${Math.floor(i / this.batchSize) + 1} 처리 중... (${batch.length}개 물건)`);

        const batchResults = await this.processBatch(batch);
        totalAnalyzed += batchResults.success;
        totalErrors += batchResults.errors;

        // 배치 간 잠시 대기 (시스템 부하 방지)
        if (i + this.batchSize < unprocessedProperties.length) {
          await this.sleep(1000);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ 일괄 분석 완료: ${totalAnalyzed}개 성공, ${totalErrors}개 실패, 소요시간: ${duration}초`);

      return {
        analyzed: totalAnalyzed,
        errors: totalErrors,
        duration
      };

    } catch (error) {
      console.error('❌ 일괄 분석 중 오류:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 특정 조건의 물건들 재분석
   */
  async reanalyzeProperties(criteria = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🔄 물건 재분석 시작...');
      console.log('📋 재분석 조건:', criteria);

      const properties = await this.getPropertiesForReanalysis(criteria);
      console.log(`📊 재분석 대상: ${properties.length}개`);

      let analyzed = 0;
      let errors = 0;

      for (const property of properties) {
        try {
          await this.analyzer.analyzeProperty(property.id);
          analyzed++;
          
          if (analyzed % 10 === 0) {
            console.log(`📈 진행률: ${analyzed}/${properties.length} (${Math.round(analyzed / properties.length * 100)}%)`);
          }
        } catch (error) {
          console.error(`❌ 물건 ${property.id} 재분석 실패:`, error.message);
          errors++;
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ 재분석 완료: ${analyzed}개 성공, ${errors}개 실패, 소요시간: ${duration}초`);

      return { analyzed, errors, duration };

    } catch (error) {
      console.error('❌ 재분석 중 오류:', error);
      throw error;
    }
  }

  /**
   * 고점수 물건 업데이트 (매일 실행)
   */
  async updateHighScoreProperties() {
    try {
      console.log('⭐ 고점수 물건 업데이트 시작...');

      const query = `
        SELECT p.id, p.case_number, p.address, ar.investment_score, ar.analysis_date
        FROM properties p
        JOIN analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
          AND ar.investment_score >= 70
          AND ar.analysis_date < NOW() - INTERVAL '7 days'
        ORDER BY ar.investment_score DESC
        LIMIT 100
      `;

      const result = await pool.query(query);
      const properties = result.rows;

      console.log(`📊 업데이트 대상 고점수 물건: ${properties.length}개`);

      let updated = 0;
      for (const property of properties) {
        try {
          await this.analyzer.analyzeProperty(property.id);
          updated++;
        } catch (error) {
          console.error(`❌ 고점수 물건 ${property.id} 업데이트 실패:`, error.message);
        }
      }

      console.log(`✅ 고점수 물건 업데이트 완료: ${updated}개`);
      return updated;

    } catch (error) {
      console.error('❌ 고점수 물건 업데이트 중 오류:', error);
      throw error;
    }
  }

  /**
   * 시장 트렌드 분석 업데이트
   */
  async updateMarketTrends() {
    try {
      console.log('📈 시장 트렌드 분석 업데이트 시작...');

      const regions = [
        '해운대구', '서면', '센텀시티', '광안리', '남포동',
        '사상구', '강서구', '금정구', '북구', '사하구'
      ];

      const propertyTypes = ['아파트', '오피스텔', '빌라', '단독주택', '상가'];

      let totalUpdated = 0;

      for (const region of regions) {
        for (const propertyType of propertyTypes) {
          try {
            const trendData = await this.calculateMarketTrend(region, propertyType);
            await this.saveMarketTrend(region, propertyType, trendData);
            totalUpdated++;
          } catch (error) {
            console.warn(`⚠️ ${region} ${propertyType} 트렌드 업데이트 실패:`, error.message);
          }
        }
      }

      console.log(`✅ 시장 트렌드 업데이트 완료: ${totalUpdated}개 항목`);
      return totalUpdated;

    } catch (error) {
      console.error('❌ 시장 트렌드 업데이트 중 오류:', error);
      throw error;
    }
  }

  /**
   * 일일 리포트 생성
   */
  async generateDailyReport() {
    try {
      console.log('📋 일일 리포트 생성 시작...');

      const today = new Date().toISOString().split('T')[0];

      // 전체 통계 조회
      const statsQuery = `
        SELECT 
          COUNT(*) as total_properties,
          COUNT(CASE WHEN DATE(p.created_at) = CURRENT_DATE THEN 1 END) as new_today,
          COUNT(CASE WHEN p.current_status = 'sold' AND DATE(p.updated_at) = CURRENT_DATE THEN 1 END) as sold_today,
          COUNT(CASE WHEN p.current_status = 'failed' AND DATE(p.updated_at) = CURRENT_DATE THEN 1 END) as failed_today,
          ROUND(AVG(ar.investment_score), 1) as avg_investment_score,
          ROUND(AVG(CASE WHEN p.appraisal_value > 0 THEN 
            (p.appraisal_value - p.minimum_sale_price) * 100.0 / p.appraisal_value 
          END), 2) as avg_discount_rate,
          SUM(p.appraisal_value) as total_appraisal_value,
          SUM(p.minimum_sale_price) as total_minimum_price
        FROM properties p
        LEFT JOIN analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
      `;

      const statsResult = await pool.query(statsQuery);
      const stats = statsResult.rows[0];

      // 인기 지역 조회
      const regionQuery = `
        SELECT 
          CASE 
            WHEN p.address LIKE '%해운대%' THEN '해운대구'
            WHEN p.address LIKE '%서면%' THEN '서면'
            WHEN p.address LIKE '%센텀%' THEN '센텀시티'
            WHEN p.address LIKE '%광안%' THEN '광안리'
            ELSE '기타'
          END as region,
          COUNT(*) as property_count,
          ROUND(AVG(ar.investment_score), 1) as avg_score,
          ROUND(AVG(p.minimum_sale_price), -6) as avg_price
        FROM properties p
        LEFT JOIN analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
        GROUP BY region
        ORDER BY property_count DESC
        LIMIT 5
      `;

      const regionResult = await pool.query(regionQuery);
      const popularRegions = regionResult.rows;

      // 고가 물건 조회
      const highValueQuery = `
        SELECT 
          p.case_number,
          p.address,
          p.property_type,
          p.minimum_sale_price,
          ar.investment_score
        FROM properties p
        LEFT JOIN analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
          AND p.minimum_sale_price >= 1000000000
        ORDER BY p.minimum_sale_price DESC
        LIMIT 10
      `;

      const highValueResult = await pool.query(highValueQuery);
      const highValueProperties = highValueResult.rows;

      // 일일 리포트 저장
      const reportData = {
        ...stats,
        popular_regions: JSON.stringify(popularRegions),
        high_value_properties: JSON.stringify(highValueProperties)
      };

      const insertQuery = `
        INSERT INTO daily_reports (
          report_date, total_properties, new_properties, sold_properties, failed_properties,
          average_discount_rate, total_appraisal_value, total_minimum_sale_price,
          popular_regions, high_value_properties
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (report_date) DO UPDATE SET
          total_properties = EXCLUDED.total_properties,
          new_properties = EXCLUDED.new_properties,
          sold_properties = EXCLUDED.sold_properties,
          failed_properties = EXCLUDED.failed_properties,
          average_discount_rate = EXCLUDED.average_discount_rate,
          total_appraisal_value = EXCLUDED.total_appraisal_value,
          total_minimum_sale_price = EXCLUDED.total_minimum_sale_price,
          popular_regions = EXCLUDED.popular_regions,
          high_value_properties = EXCLUDED.high_value_properties
      `;

      await pool.query(insertQuery, [
        today,
        reportData.total_properties,
        reportData.new_today,
        reportData.sold_today,
        reportData.failed_today,
        reportData.avg_discount_rate,
        reportData.total_appraisal_value,
        reportData.total_minimum_price,
        reportData.popular_regions,
        reportData.high_value_properties
      ]);

      console.log('✅ 일일 리포트 생성 완료');
      return reportData;

    } catch (error) {
      console.error('❌ 일일 리포트 생성 중 오류:', error);
      throw error;
    }
  }

  // Private 헬퍼 메서드들

  async getUnprocessedProperties() {
    const query = `
      SELECT p.id, p.case_number, p.address
      FROM properties p
      LEFT JOIN analysis_results ar ON p.id = ar.property_id
      WHERE p.current_status = 'active'
        AND ar.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 1000
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  async getPropertiesForReanalysis(criteria) {
    let whereConditions = ["p.current_status = 'active'"];
    let params = [];
    let paramCount = 0;

    if (criteria.minScore) {
      paramCount++;
      whereConditions.push(`ar.investment_score >= $${paramCount}`);
      params.push(criteria.minScore);
    }

    if (criteria.maxScore) {
      paramCount++;
      whereConditions.push(`ar.investment_score <= $${paramCount}`);
      params.push(criteria.maxScore);
    }

    if (criteria.daysSinceAnalysis) {
      paramCount++;
      whereConditions.push(`ar.analysis_date < NOW() - INTERVAL '${criteria.daysSinceAnalysis} days'`);
    }

    if (criteria.region) {
      paramCount++;
      whereConditions.push(`p.address LIKE $${paramCount}`);
      params.push(`%${criteria.region}%`);
    }

    if (criteria.propertyType) {
      paramCount++;
      whereConditions.push(`p.property_type = $${paramCount}`);
      params.push(criteria.propertyType);
    }

    const query = `
      SELECT p.id, p.case_number, p.address, ar.investment_score, ar.analysis_date
      FROM properties p
      LEFT JOIN analysis_results ar ON p.id = ar.property_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ar.analysis_date ASC NULLS FIRST
      LIMIT 500
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async processBatch(properties) {
    const promises = properties.map(async (property) => {
      try {
        await this.analyzer.analyzeProperty(property.id);
        return { success: true, error: null };
      } catch (error) {
        console.error(`❌ 물건 ${property.id} 분석 실패:`, error.message);
        return { success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(promises);
    
    const success = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errors = results.length - success;

    return { success, errors };
  }

  async calculateMarketTrend(region, propertyType) {
    const query = `
      SELECT 
        COUNT(*) as transaction_volume,
        ROUND(AVG(p.minimum_sale_price), -4) as average_price,
        ROUND(AVG(ar.success_probability), 2) as success_rate,
        ROUND(STDDEV(p.minimum_sale_price) / AVG(p.minimum_sale_price) * 100, 2) as price_volatility,
        ROUND(AVG(p.failure_count), 1) as average_failure_count
      FROM properties p
      LEFT JOIN analysis_results ar ON p.id = ar.property_id
      WHERE p.address LIKE $1
        AND p.property_type = $2
        AND p.created_at >= NOW() - INTERVAL '3 months'
    `;

    const result = await pool.query(query, [`%${region}%`, propertyType]);
    const data = result.rows[0];

    // 가격 트렌드 계산 (3개월 전 대비)
    const trendQuery = `
      SELECT 
        ROUND(AVG(CASE WHEN p.created_at >= NOW() - INTERVAL '1 month' THEN p.minimum_sale_price END), -4) as recent_price,
        ROUND(AVG(CASE WHEN p.created_at >= NOW() - INTERVAL '3 months' 
                       AND p.created_at < NOW() - INTERVAL '2 months' 
                       THEN p.minimum_sale_price END), -4) as old_price
      FROM properties p
      WHERE p.address LIKE $1
        AND p.property_type = $2
    `;

    const trendResult = await pool.query(trendQuery, [`%${region}%`, propertyType]);
    const trendData = trendResult.rows[0];

    const priceTrend = trendData.old_price ? 
      ((trendData.recent_price - trendData.old_price) / trendData.old_price * 100) : 0;

    return {
      transaction_volume: data.transaction_volume || 0,
      average_price_trend: priceTrend,
      median_price_trend: priceTrend * 0.8, // 근사값
      price_volatility: data.price_volatility || 5,
      success_rate: data.success_rate || 60,
      average_failure_count: data.average_failure_count || 1,
      average_bidders: Math.max(2, Math.round(data.success_rate / 20)),
      competition_intensity: Math.min(10, Math.max(1, data.success_rate / 10))
    };
  }

  async saveMarketTrend(region, propertyType, trendData) {
    const query = `
      INSERT INTO market_trends (
        region_code, property_type, analysis_period,
        average_price_trend, median_price_trend, price_volatility,
        transaction_volume, success_rate, average_failure_count,
        average_bidders, competition_intensity
      ) VALUES ($1, $2, '3M', $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (region_code, property_type, analysis_period) 
      WHERE region_code = $1 AND property_type = $2 AND analysis_period = '3M'
      DO UPDATE SET
        average_price_trend = EXCLUDED.average_price_trend,
        median_price_trend = EXCLUDED.median_price_trend,
        price_volatility = EXCLUDED.price_volatility,
        transaction_volume = EXCLUDED.transaction_volume,
        success_rate = EXCLUDED.success_rate,
        average_failure_count = EXCLUDED.average_failure_count,
        average_bidders = EXCLUDED.average_bidders,
        competition_intensity = EXCLUDED.competition_intensity,
        analysis_date = NOW()
    `;

    await pool.query(query, [
      region,
      propertyType,
      trendData.average_price_trend,
      trendData.median_price_trend,
      trendData.price_volatility,
      trendData.transaction_volume,
      trendData.success_rate,
      trendData.average_failure_count,
      trendData.average_bidders,
      trendData.competition_intensity
    ]);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AnalysisService;