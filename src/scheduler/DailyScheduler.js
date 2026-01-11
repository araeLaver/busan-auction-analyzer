const cron = require('node-cron');
const AdvancedCourtAuctionScraper = require('../scraper/AdvancedCourtAuctionScraper');
const PropertyAnalyzer = require('../analyzer/PropertyAnalyzer');
const NotificationService = require('../services/NotificationService');
const WatchlistService = require('../services/WatchlistService'); // 추가
const pool = require('../../config/database');

class DailyScheduler {
  constructor() {
    this.scraper = null;
    this.analyzer = null;
    this.notificationService = new NotificationService();
    this.watchlistService = new WatchlistService(); // 추가
    this.isRunning = false;
  }

  start() {
    console.log('⏰ 스케줄러 시작...');
    
    // 매일 오전 6시에 스크래핑 및 분석 실행
    cron.schedule('0 6 * * *', async () => {
      if (this.isRunning) {
        console.log('⚠️ 이미 실행 중입니다. 건너뛰기...');
        return;
      }
      
      await this.runDailyProcess();
    });

    // 매일 오후 2시에 추가 스크래핑 (업데이트된 정보 수집)
    cron.schedule('0 14 * * *', async () => {
      if (this.isRunning) {
        console.log('⚠️ 이미 실행 중입니다. 건너뛰기...');
        return;
      }
      
      await this.runDailyProcess();
    });

    // 매일 밤 11시에 일일 리포트 생성
    cron.schedule('0 23 * * *', async () => {
      await this.generateDailyReport();
    });

    console.log('✅ 스케줄러 등록 완료');
    console.log('📅 실행 시간: 매일 06:00, 14:00 (스크래핑), 23:00 (리포트)');
  }

  async runDailyProcess() {
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('\n🚀 일일 프로세스 시작:', new Date().toLocaleString());
      
      // 1. 스크래핑 실행
      console.log('\n📡 1단계: 스크래핑 시작...');
      this.scraper = new AdvancedCourtAuctionScraper();
      await this.scraper.initialize();
      
      const scrapingResults = await this.scraper.scrapeBusanAuctions();
      await this.scraper.close();
      
      console.log(`✅ 스크래핑 완료: 신규 ${scrapingResults.newItems}개, 업데이트 ${scrapingResults.updatedItems}개`);
      
      // 2. 분석 실행
      console.log('\n📊 2단계: 분석 시작...');
      this.analyzer = new PropertyAnalyzer();
      await this.analyzer.analyzeAllProperties();
      
      // 3. 실행 시간 계산
      const executionTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n✅ 일일 프로세스 완료 (${executionTime}초 소요)`);
      
      // 4. 관심 물건 알림 체크
      await this.checkWatchlistAlerts();
      
      // 5. 성공 알림
      await this.logProcessSuccess(scrapingResults, executionTime);
      
    } catch (error) {
      console.error('❌ 일일 프로세스 오류:', error);
      await this.logProcessError(error);
      
    } finally {
      if (this.scraper) {
        await this.scraper.close();
      }
      this.isRunning = false;
    }
  }

  async checkWatchlistAlerts() {
    try {
      console.log('🔔 관심 물건 알림 체크 시작...');
      
      // 1. 입찰 리마인더 대상 조회
      const reminders = await this.watchlistService.getPropertiesForAuctionReminder();
      
      for (const item of reminders) {
        const auctionDate = new Date(item.auction_date);
        const today = new Date();
        const diffDays = Math.ceil((auctionDate - today) / (1000 * 60 * 60 * 24));
        
        // D-1, D-3, D-7 인 경우에만 알림 생성
        if ([1, 3, 7].includes(diffDays)) {
          await this.notificationService.notifyAuctionReminder(
            { 
              id: item.property_id, 
              address: item.address, 
              auction_date: item.auction_date 
            }, 
            diffDays
          );
        }
      }
      
      console.log(`✅ 관심 물건 알림 체크 완료 (대상: ${reminders.length}건)`);
      
    } catch (error) {
      console.error('❌ 관심 물건 알림 체크 중 오류:', error);
    }
  }

  async generateDailyReport() {
    try {
      console.log('\n📋 일일 리포트 생성 시작...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // 오늘의 통계 수집
      const stats = await this.collectDailyStats(today);
      
      // 인기 지역 TOP 5
      const popularRegions = await this.getPopularRegions();
      
      // 고가 물건 TOP 5
      const highValueProperties = await this.getHighValueProperties();
      
      // 일일 리포트 저장
      const reportQuery = `
        INSERT INTO daily_reports (
          report_date, total_properties, new_properties, sold_properties,
          failed_properties, average_discount_rate, total_appraisal_value,
          total_minimum_sale_price, popular_regions, high_value_properties
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (report_date)
        DO UPDATE SET
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
      
      await pool.query(reportQuery, [
        today,
        stats.totalProperties,
        stats.newProperties,
        stats.soldProperties,
        stats.failedProperties,
        stats.averageDiscountRate,
        stats.totalAppraisalValue,
        stats.totalMinimumSalePrice,
        JSON.stringify(popularRegions),
        JSON.stringify(highValueProperties)
      ]);
      
      console.log('✅ 일일 리포트 생성 완료');
      console.log(`📊 총 물건: ${stats.totalProperties}개, 신규: ${stats.newProperties}개`);
      
    } catch (error) {
      console.error('❌ 일일 리포트 생성 오류:', error);
    }
  }

  async collectDailyStats(date) {
    const queries = {
      // 전체 활성 물건 수
      totalProperties: `
        SELECT COUNT(*) as count FROM properties 
        WHERE current_status = 'active'
      `,
      
      // 오늘 신규 물건 수
      newProperties: `
        SELECT COUNT(*) as count FROM properties 
        WHERE DATE(created_at) = $1
      `,
      
      // 오늘 낙찰된 물건 수
      soldProperties: `
        SELECT COUNT(*) as count FROM properties 
        WHERE current_status = 'sold' AND DATE(updated_at) = $1
      `,
      
      // 오늘 유찰된 물건 수
      failedProperties: `
        SELECT COUNT(*) as count FROM properties 
        WHERE current_status = 'failed' AND DATE(updated_at) = $1
      `,
      
      // 평균 할인율 및 가격 총합
      priceStats: `
        SELECT 
          AVG(ar.discount_rate) as avg_discount_rate,
          SUM(p.appraisal_value) as total_appraisal_value,
          SUM(p.minimum_sale_price) as total_minimum_sale_price
        FROM properties p
        LEFT JOIN analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
      `
    };

    const results = {};
    
    // 각 쿼리 실행
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await pool.query(query, key.includes('today') ? [date] : []);
        
        if (key === 'priceStats') {
          results.averageDiscountRate = result.rows[0].avg_discount_rate || 0;
          results.totalAppraisalValue = result.rows[0].total_appraisal_value || 0;
          results.totalMinimumSalePrice = result.rows[0].total_minimum_sale_price || 0;
        } else {
          results[key] = parseInt(result.rows[0].count) || 0;
        }
      } catch (error) {
        console.error(`쿼리 오류 (${key}):`, error);
        results[key] = 0;
      }
    }
    
    return results;
  }

  async getPopularRegions() {
    const query = `
      SELECT 
        SUBSTRING(address FROM '서울특별시 ([^\\s]+)') as region,
        COUNT(*) as property_count,
        AVG(ar.investment_score) as avg_score
      FROM properties p
      LEFT JOIN analysis_results ar ON p.id = ar.property_id
      WHERE p.current_status = 'active' 
        AND p.address LIKE '서울특별시%'
      GROUP BY region
      HAVING region IS NOT NULL
      ORDER BY property_count DESC, avg_score DESC
      LIMIT 5
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows.map(row => ({
        region: row.region,
        propertyCount: parseInt(row.property_count),
        averageScore: Math.round(row.avg_score || 0)
      }));
    } catch (error) {
      console.error('인기 지역 조회 오류:', error);
      return [];
    }
  }

  async getHighValueProperties() {
    const query = `
      SELECT 
        p.case_number,
        p.item_number,
        p.address,
        p.property_type,
        p.appraisal_value,
        p.minimum_sale_price,
        ar.investment_score,
        ar.discount_rate
      FROM properties p
      LEFT JOIN analysis_results ar ON p.id = ar.property_id
      WHERE p.current_status = 'active'
      ORDER BY p.appraisal_value DESC
      LIMIT 5
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows.map(row => ({
        caseNumber: row.case_number,
        itemNumber: row.item_number,
        address: row.address,
        propertyType: row.property_type,
        appraisalValue: row.appraisal_value,
        minimumSalePrice: row.minimum_sale_price,
        investmentScore: row.investment_score,
        discountRate: row.discount_rate
      }));
    } catch (error) {
      console.error('고가 물건 조회 오류:', error);
      return [];
    }
  }

  async logProcessSuccess(scrapingResults, executionTime) {
    try {
      console.log('\n📝 성공 로그 기록...');
      
      await this.notificationService.createNotification({
        type: 'MARKET_ALERT',
        title: '✅ 일일 스크래핑/분석 완료',
        message: `신규 ${scrapingResults.newItems}건, 업데이트 ${scrapingResults.updatedItems}건이 처리되었습니다. (${executionTime}초 소요)`,
        data: {
          alertType: 'NEW_LISTINGS',
          newCount: scrapingResults.newItems,
          updatedCount: scrapingResults.updatedItems,
          executionTime
        },
        priority: 5 // MEDIUM
      });
      
    } catch (error) {
      console.error('성공 로그 오류:', error);
    }
  }

  async logProcessError(error) {
    try {
      console.log('\n📝 오류 로그 기록...');
      
      const query = `
        INSERT INTO scraping_logs (source_site, status, error_message)
        VALUES ('daily_scheduler', 'failed', $1)
      `;
      
      await pool.query(query, [error.message]);
      
      await this.notificationService.createNotification({
        type: 'MARKET_ALERT',
        title: '❌ 일일 프로세스 오류',
        message: `스크래핑/분석 중 오류가 발생했습니다: ${error.message}`,
        data: {
          alertType: 'SYSTEM_ERROR',
          error: error.message
        },
        priority: 2 // HIGH
      });
      
    } catch (logError) {
      console.error('오류 로그 기록 실패:', logError);
    }
  }

  // 수동 실행 메서드 (테스트용)
  async runManually() {
    console.log('🔧 수동 실행 시작...');
    await this.runDailyProcess();
  }

  // 즉시 리포트 생성 (테스트용)
  async generateReportNow() {
    console.log('📋 즉시 리포트 생성...');
    await this.generateDailyReport();
  }

  stop() {
    console.log('⏰ 스케줄러 중지...');
    // cron.destroy(); // 모든 크론 작업 중지
  }
}

module.exports = DailyScheduler;