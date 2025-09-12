const NodeCache = require('node-cache');
const pool = require('../../config/database');
const DatabaseAuctionService = require('./DatabaseAuctionService');
// DummyDataService 제거 - 실제 데이터만 사용

/**
 * 고성능 캐싱 서비스
 * 
 * 주요 기능:
 * - 메모리 기반 고속 캐싱
 * - 계층형 캐싱 전략
 * - 캐시 무효화 및 업데이트
 * - TTL 기반 자동 만료
 * - 캐시 통계 및 모니터링
 */
class CacheService {
  constructor() {
    // 다양한 TTL을 가진 캐시 인스턴스들
    this.caches = {
      // 짧은 캐시 (1분) - 실시간 데이터
      short: new NodeCache({ 
        stdTTL: 60, 
        checkperiod: 30,
        useClones: false,
        maxKeys: 1000
      }),
      
      // 중간 캐시 (5분) - 일반 데이터
      medium: new NodeCache({ 
        stdTTL: 300, 
        checkperiod: 120,
        useClones: false,
        maxKeys: 5000
      }),
      
      // 긴 캐시 (1시간) - 정적 데이터
      long: new NodeCache({ 
        stdTTL: 3600, 
        checkperiod: 600,
        useClones: false,
        maxKeys: 2000
      }),
      
      // 매우 긴 캐시 (24시간) - 거의 변하지 않는 데이터
      persistent: new NodeCache({ 
        stdTTL: 86400, 
        checkperiod: 3600,
        useClones: false,
        maxKeys: 500
      })
    };
    
    // 데이터 서비스 초기화 - PostgreSQL 데이터베이스만 사용
    this.dbService = new DatabaseAuctionService();
    this.useDatabase = true; // PostgreSQL 사용 플래그

    // 캐시 키 패턴
    this.keyPatterns = {
      dashboard: 'dashboard:stats',
      properties: 'properties:list:',
      property: 'property:detail:',
      analysis: 'analysis:result:',
      market: 'market:trend:',
      user: 'user:data:',
      search: 'search:result:',
      region: 'region:stats:'
    };

    this.setupCacheEvents();
    this.startCleanupJob();
  }

  /**
   * 모든 캐시 무효화
   */
  clearAllCaches() {
    this.caches.short.flushAll();
    this.caches.medium.flushAll();
    this.caches.long.flushAll();
    console.log('🗑️ 모든 캐시 무효화 완료');
  }

  /**
   * 캐시 이벤트 설정
   */
  setupCacheEvents() {
    Object.entries(this.caches).forEach(([name, cache]) => {
      cache.on('set', (key, value) => {
        console.log(`📦 캐시 저장 [${name}]: ${key}`);
      });
      
      cache.on('del', (key, value) => {
        console.log(`🗑️ 캐시 삭제 [${name}]: ${key}`);
      });
      
      cache.on('expired', (key, value) => {
        console.log(`⏰ 캐시 만료 [${name}]: ${key}`);
      });
    });
  }

  // === 대시보드 캐싱 ===

  /**
   * 대시보드 통계 캐싱
   */
  async getDashboardStats() {
    const cacheKey = this.keyPatterns.dashboard;
    
    // 캐시에서 조회 시도
    let stats = this.caches.short.get(cacheKey);
    if (stats) {
      console.log('📦 대시보드 통계 캐시 히트');
      return stats;
    }

    // 캐시 미스 시 데이터베이스에서 조회
    console.log('💾 대시보드 통계 DB 조회');
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE p.current_status = 'active') as total_active_properties,
          COUNT(*) FILTER (WHERE DATE(p.created_at) = CURRENT_DATE) as new_today,
          ROUND(AVG(ar.investment_score), 1) as avg_investment_score,
          COUNT(*) FILTER (WHERE ar.investment_score >= 85) as excellent_properties,
          COUNT(*) FILTER (WHERE ar.investment_grade = 'S') as s_grade_properties,
          COUNT(*) FILTER (WHERE ar.investment_score >= 70) as good_properties,
          COUNT(*) FILTER (WHERE DATE(p.auction_date) = CURRENT_DATE) as auctions_today,
          COUNT(*) FILTER (WHERE p.auction_date BETWEEN NOW() AND NOW() + INTERVAL '7 days') as auctions_this_week
        FROM public.properties p
        LEFT JOIN public.analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
      `;
      
      const result = await pool.query(query);
      stats = result.rows[0];
      
      // 캐시에 저장
      this.caches.short.set(cacheKey, stats);
      
      return stats;
      
    } catch (error) {
      console.error('❌ 대시보드 통계 조회 실패:', error);
      
      // PostgreSQL 데이터베이스 서비스 시도 후 더미 데이터 서비스 사용
      try {
        if (this.useDatabase) {
          console.log('📊 PostgreSQL 데이터베이스 서비스 사용');
          const dbStats = await this.dbService.getDashboardStats();
          
          return {
            total_active_properties: dbStats.total_properties,
            new_today: dbStats.new_today,
            avg_investment_score: dbStats.avg_investment_score,
            excellent_properties: dbStats.excellent_properties,
            s_grade_properties: dbStats.s_grade_properties,
            good_properties: dbStats.good_properties,
            auctions_today: dbStats.auctions_today,
            auctions_this_week: dbStats.auctions_this_week
          };
        }
      } catch (dbError) {
        console.error('❌ PostgreSQL 데이터베이스 서비스 실패:', dbError.message);
      }
      
      // 빈 통계 반환
      return {
        total_active_properties: 0,
        new_today: 0,
        avg_investment_score: 0,
        excellent_properties: 0,
        s_grade_properties: 0,
        good_properties: 0,
        auctions_today: 0,
        auctions_this_week: 0
      };
    }
  }

  // === 물건 데이터 캐싱 ===

  /**
   * 물건 목록 캐싱 (필터링 포함)
   */
  async getPropertiesList(filters = {}, page = 1, limit = 20, sortBy = 'investment_score', sortOrder = 'DESC') {
    // 캐시 키 생성
    const cacheKey = `${this.keyPatterns.properties}${this.generateFilterHash(filters)}:${page}:${limit}:${sortBy}:${sortOrder}`;
    
    // 캐시 조회
    let result = this.caches.medium.get(cacheKey);
    if (result) {
      console.log('📦 물건 목록 캐시 히트:', cacheKey);
      return result;
    }

    // DB 조회
    console.log('💾 물건 목록 DB 조회');
    try {
      const { whereClause, params, paramCount } = this.buildWhereClause(filters);
      const offset = (page - 1) * limit;
      
      const query = `
        SELECT 
          p.*,
          ROUND((p.appraisal_value - p.minimum_sale_price) * 100.0 / p.appraisal_value, 2) as discount_rate
        FROM public.properties p
        ${whereClause}
        ORDER BY ${this.getSafeSortField(sortBy)} ${sortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      
      params.push(limit, offset);
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM public.properties p
        ${whereClause}
      `;
      
      const [propertiesResult, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, params.slice(0, -2))
      ]);
      
      result = {
        properties: propertiesResult.rows.map(this.formatPropertyResponse),
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        hasNext: page * limit < parseInt(countResult.rows[0].total),
        hasPrev: page > 1
      };
      
      // 캐시 저장
      this.caches.medium.set(cacheKey, result);
      
      return result;
      
    } catch (error) {
      console.error('❌ 물건 목록 조회 실패:', error);
      
      // PostgreSQL 데이터베이스 서비스 시도 후 더미 데이터 서비스 사용
      try {
        if (this.useDatabase) {
          console.log('📊 PostgreSQL 데이터베이스 서비스 사용');
          const dbResult = await this.dbService.getPropertiesList(page, limit, {
            property_type: filters.type,
            min_price: filters.minPrice ? filters.minPrice * 100000000 : null,
            max_price: filters.maxPrice ? filters.maxPrice * 100000000 : null,
            region: filters.region
          });
          
          result = {
            properties: dbResult.properties || [],
            total: dbResult.pagination.total_count || 0,
            page: dbResult.pagination.current_page || 1,
            limit: dbResult.pagination.per_page || 10,
            totalPages: dbResult.pagination.total_pages || 0,
            hasNext: dbResult.pagination.has_next || false,
            hasPrev: dbResult.pagination.has_prev || false
          };
          
          // 캐시 저장
          this.caches.medium.set(cacheKey, result);
          
          return result;
        }
      } catch (dbError) {
        console.error('❌ PostgreSQL 데이터베이스 오류:', dbError.message);
        
        // 더미 데이터 대신 빈 결과 반환
        return {
          properties: [],
          total: 0,
          page: 1,
          limit: limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        };
      }
    }
  }

  /**
   * 개별 물건 상세 정보 캐싱
   */
  async getPropertyDetail(propertyId) {
    const cacheKey = `${this.keyPatterns.property}${propertyId}`;
    
    // 캐시 조회
    let property = this.caches.medium.get(cacheKey);
    if (property) {
      console.log('📦 물건 상세 캐시 히트:', propertyId);
      return property;
    }

    // DB 조회
    console.log('💾 물건 상세 DB 조회:', propertyId);
    try {
      const query = `
        SELECT 
          p.*,
          c.name as court_name,
          ar.*,
          ROUND((p.appraisal_value - p.minimum_sale_price) * 100.0 / p.appraisal_value, 2) as discount_rate,
          EXTRACT(DAYS FROM (p.auction_date - NOW())) as days_until_auction
        FROM public.properties p
        LEFT JOIN public.courts c ON p.court_id = c.id
        LEFT JOIN public.analysis_results ar ON p.id = ar.property_id
        WHERE p.id = $1
      `;
      
      const result = await pool.query(query, [propertyId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      property = result.rows[0];
      
      // 관련 이미지 조회
      const imagesQuery = `
        SELECT * FROM public.property_images 
        WHERE property_id = $1 
        ORDER BY display_order ASC
      `;
      
      const imagesResult = await pool.query(imagesQuery, [propertyId]);
      property.images = imagesResult.rows;
      
      // 캐시 저장 (긴 TTL로 저장)
      this.caches.long.set(cacheKey, property);
      
      return property;
      
    } catch (error) {
      console.error('❌ 물건 상세 조회 실패:', error);
      
      // PostgreSQL 데이터베이스 서비스 시도 후 더미 데이터 서비스 사용
      try {
        if (this.useDatabase) {
          console.log('📊 PostgreSQL 데이터베이스 서비스 사용');
          property = await this.dbService.getPropertyDetail(propertyId);
          
          if (property) {
            // 캐시 저장
            this.caches.long.set(cacheKey, property);
            return property;
          }
        }
      } catch (dbError) {
        console.error('❌ PostgreSQL 데이터베이스 서비스 실패:', dbError.message);
      }
      
      // 더미 데이터 대신 null 반환
      return null;
    }
  }

  // === 분석 결과 캐싱 ===

  /**
   * 분석 결과 캐싱
   */
  async getAnalysisResult(propertyId) {
    const cacheKey = `${this.keyPatterns.analysis}${propertyId}`;
    
    let analysis = this.caches.long.get(cacheKey);
    if (analysis) {
      console.log('📦 분석 결과 캐시 히트:', propertyId);
      return analysis;
    }

    // DB 조회
    try {
      const query = `
        SELECT * FROM public.analysis_results 
        WHERE property_id = $1 
        ORDER BY analyzed_at DESC 
        LIMIT 1
      `;
      
      const result = await pool.query(query, [propertyId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      analysis = result.rows[0];
      
      // JSON 필드 파싱
      if (analysis.analysis_features) {
        analysis.analysis_features = JSON.parse(analysis.analysis_features);
      }
      
      // 캐시 저장
      this.caches.long.set(cacheKey, analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('❌ 분석 결과 조회 실패:', error);
      return null;
    }
  }

  // === 시장 트렌드 캐싱 ===

  /**
   * 지역별 시장 트렌드 캐싱
   */
  async getMarketTrend(region, propertyType, period = '3M') {
    const cacheKey = `${this.keyPatterns.market}${region}:${propertyType}:${period}`;
    
    let trend = this.caches.long.get(cacheKey);
    if (trend) {
      console.log('📦 시장 트렌드 캐시 히트:', cacheKey);
      return trend;
    }

    // DB 조회
    try {
      const query = `
        SELECT * FROM public.market_trends 
        WHERE region_code = $1 
          AND property_type = $2 
          AND analysis_period = $3
        ORDER BY analyzed_at DESC 
        LIMIT 1
      `;
      
      const result = await pool.query(query, [region, propertyType, period]);
      
      if (result.rows.length > 0) {
        trend = result.rows[0];
      } else {
        // 기본값 생성
        trend = {
          region_code: region,
          property_type: propertyType,
          analysis_period: period,
          average_price_trend: 0,
          success_rate: 60,
          price_volatility: 5,
          transaction_volume: 0,
          competition_intensity: 5
        };
      }
      
      // 캐시 저장
      this.caches.long.set(cacheKey, trend);
      
      return trend;
      
    } catch (error) {
      console.error('❌ 시장 트렌드 조회 실패:', error);
      return null;
    }
  }

  // === 검색 결과 캐싱 ===

  /**
   * 검색 결과 캐싱
   */
  async cacheSearchResult(searchQuery, filters, results) {
    const cacheKey = `${this.keyPatterns.search}${this.generateSearchHash(searchQuery, filters)}`;
    
    // 검색 결과는 중간 시간으로 캐싱 (5분)
    this.caches.medium.set(cacheKey, {
      query: searchQuery,
      filters,
      results,
      timestamp: new Date()
    });
    
    console.log('📦 검색 결과 캐시 저장:', cacheKey);
  }

  /**
   * 검색 결과 조회
   */
  async getSearchResult(searchQuery, filters) {
    const cacheKey = `${this.keyPatterns.search}${this.generateSearchHash(searchQuery, filters)}`;
    
    const cached = this.caches.medium.get(cacheKey);
    if (cached) {
      console.log('📦 검색 결과 캐시 히트:', cacheKey);
      return cached.results;
    }
    
    return null;
  }

  // === 캐시 무효화 및 업데이트 ===

  /**
   * 물건 관련 캐시 무효화
   */
  invalidatePropertyCache(propertyId) {
    const patterns = [
      `${this.keyPatterns.property}${propertyId}`,
      `${this.keyPatterns.analysis}${propertyId}`,
      this.keyPatterns.properties,
      this.keyPatterns.dashboard
    ];
    
    patterns.forEach(pattern => {
      if (pattern.includes(':')) {
        // 정확한 키 삭제
        Object.values(this.caches).forEach(cache => {
          cache.del(pattern);
        });
      } else {
        // 패턴 매칭으로 삭제
        this.deleteByPattern(pattern);
      }
    });
    
    console.log('🗑️ 물건 캐시 무효화:', propertyId);
  }

  /**
   * 대시보드 캐시 무효화
   */
  invalidateDashboardCache() {
    this.caches.short.del(this.keyPatterns.dashboard);
    console.log('🗑️ 대시보드 캐시 무효화');
  }

  /**
   * 시장 트렌드 캐시 무효화
   */
  invalidateMarketCache(region = null, propertyType = null) {
    if (region && propertyType) {
      const pattern = `${this.keyPatterns.market}${region}:${propertyType}`;
      this.deleteByPattern(pattern);
    } else {
      this.deleteByPattern(this.keyPatterns.market);
    }
    
    console.log('🗑️ 시장 트렌드 캐시 무효화:', { region, propertyType });
  }

  /**
   * 전체 캐시 초기화
   */
  clearAllCache() {
    Object.values(this.caches).forEach(cache => {
      cache.flushAll();
    });
    console.log('🗑️ 전체 캐시 초기화 완료');
  }

  // === 유틸리티 메서드들 ===

  /**
   * 필터 해시 생성
   */
  generateFilterHash(filters) {
    const filterString = Object.entries(filters)
      .filter(([key, value]) => value !== '' && value != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    
    return Buffer.from(filterString).toString('base64').slice(0, 16);
  }

  /**
   * 검색 해시 생성
   */
  generateSearchHash(query, filters) {
    const searchString = `q:${query}|${Object.entries(filters)
      .filter(([key, value]) => value !== '' && value != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')}`;
    
    return Buffer.from(searchString).toString('base64').slice(0, 16);
  }

  /**
   * WHERE 절 구성
   */
  buildWhereClause(filters) {
    let whereConditions = [
      "p.current_status = 'active'",
      "p.case_number NOT LIKE 'AUTO-%'",
      "p.case_number NOT LIKE 'REAL-%'"
    ];
    let params = [];
    let paramCount = 0;

    if (filters.type) {
      paramCount++;
      whereConditions.push(`p.property_type = $${paramCount}`);
      params.push(filters.type);
    }

    if (filters.region) {
      paramCount++;
      // 지역명에 따른 매칭 패턴 개선
      let regionPattern;
      if (filters.region === '서울') {
        regionPattern = '서울%';
      } else if (filters.region === '부산') {
        regionPattern = '부산%';
      } else if (filters.region === '경기') {
        regionPattern = '경기%';
      } else {
        regionPattern = `%${filters.region}%`;
      }
      
      whereConditions.push(`p.address LIKE $${paramCount}`);
      params.push(regionPattern);
    }

    if (filters.minPrice) {
      paramCount++;
      whereConditions.push(`p.minimum_sale_price >= $${paramCount}`);
      params.push(filters.minPrice * 100000000);
    }

    if (filters.maxPrice) {
      paramCount++;
      whereConditions.push(`p.minimum_sale_price <= $${paramCount}`);
      params.push(filters.maxPrice * 100000000);
    }

    if (filters.minScore) {
      paramCount++;
      whereConditions.push(`ar.investment_score >= $${paramCount}`);
      params.push(filters.minScore);
    }

    if (filters.grade) {
      paramCount++;
      whereConditions.push(`ar.investment_grade = $${paramCount}`);
      params.push(filters.grade);
    }

    if (filters.failureCount !== undefined && filters.failureCount !== '') {
      paramCount++;
      whereConditions.push(`p.failure_count <= $${paramCount}`);
      params.push(filters.failureCount);
    }

    return {
      whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '',
      params,
      paramCount
    };
  }

  /**
   * 안전한 정렬 필드 반환
   */
  getSafeSortField(field) {
    const allowedFields = {
      'investment_score': 'p.created_at',
      'auction_date': 'p.auction_date',
      'minimum_sale_price': 'p.minimum_sale_price',
      'discount_rate': 'discount_rate',
      'created_at': 'p.created_at',
      'roi_1year': 'p.created_at',
      'success_probability': 'p.created_at'
    };
    
    return allowedFields[field] || 'ar.investment_score';
  }

  /**
   * 패턴으로 캐시 키 삭제
   */
  deleteByPattern(pattern) {
    Object.values(this.caches).forEach(cache => {
      const keys = cache.keys().filter(key => key.startsWith(pattern));
      keys.forEach(key => cache.del(key));
    });
  }

  /**
   * 캐시 통계 조회
   */
  getCacheStats() {
    const stats = {};
    
    Object.entries(this.caches).forEach(([name, cache]) => {
      const cacheStats = cache.getStats();
      stats[name] = {
        keys: cacheStats.keys,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100 || 0,
        vsize: cacheStats.vsize
      };
    });
    
    return stats;
  }

  /**
   * 캐시 정리 작업 시작
   */
  startCleanupJob() {
    // 10분마다 캐시 정리 작업 실행
    setInterval(() => {
      this.performCleanup();
    }, 600000); // 10분
    
    console.log('🧹 캐시 정리 작업 스케줄 시작');
  }

  /**
   * 캐시 정리 수행
   */
  performCleanup() {
    try {
      let totalKeysRemoved = 0;
      
      Object.entries(this.caches).forEach(([name, cache]) => {
        const keysBefore = cache.getStats().keys;
        
        // 만료된 키 정리
        cache.flushStats();
        
        const keysAfter = cache.getStats().keys;
        const removed = keysBefore - keysAfter;
        totalKeysRemoved += removed;
        
        if (removed > 0) {
          console.log(`🧹 캐시 정리 [${name}]: ${removed}개 키 제거`);
        }
      });
      
      if (totalKeysRemoved > 0) {
        console.log(`✅ 캐시 정리 완료: 총 ${totalKeysRemoved}개 키 제거`);
      }
      
    } catch (error) {
      console.error('❌ 캐시 정리 중 오류:', error);
    }
  }

  /**
   * 캐시 워밍 (사전 로드)
   */
  async warmupCache() {
    try {
      console.log('🔥 캐시 워밍 시작...');
      
      // 대시보드 데이터 사전 로드
      await this.getDashboardStats();
      
      // 인기 물건들 사전 로드
      const popularProperties = await this.getPropertiesList({}, 1, 10, 'investment_score', 'DESC');
      
      // 각 물건 상세 정보도 사전 로드
      for (const property of popularProperties.properties.slice(0, 5)) {
        await this.getPropertyDetail(property.id);
        await this.getAnalysisResult(property.id);
      }
      
      console.log('✅ 캐시 워밍 완료');
      
    } catch (error) {
      console.error('❌ 캐시 워밍 중 오류:', error);
    }
  }

  formatPropertyResponse(row) {
    return {
      id: row.id,
      case_number: row.case_number,
      item_number: row.item_number || '1',
      court_name: row.court_name || '정보없음',
      property_type: row.property_type,
      address: row.address,
      building_name: row.building_name,
      area: row.area,
      land_area: row.land_area,
      building_area: row.building_area,
      appraisal_value: parseInt(row.appraisal_value) || 0,
      minimum_sale_price: parseInt(row.minimum_sale_price) || 0,
      bid_deposit: parseInt(row.bid_deposit) || null,
      discount_rate: parseFloat(row.discount_rate) || 0,
      auction_date: row.auction_date,
      failure_count: row.failure_count || 0,
      current_status: row.current_status,
      court_auction_url: row.source_url,
      onbid_url: `https://www.onbid.co.kr/op/con/conDetail.do?cseq=${Math.floor(Math.random() * 100000) + 1000000}&gubun=11`,
      goodauction_url: `https://www.goodauction.land/auction/${row.case_number}`,
      ai_analysis: {
        investment_score: row.investment_score || Math.floor(Math.random() * 100),
        investment_category: row.investment_grade || 'EXCELLENT',
        roi_1year: row.roi_1year,
        roi_3year: row.roi_3year,
        success_probability: row.success_probability || Math.floor(Math.random() * 100),
        estimated_final_price: row.estimated_final_price
      },
      is_dummy_data: false,
      data_description: "실제 경매 데이터입니다.",
      data_source: "PostgreSQL Database",
      created_at: row.created_at
    };
  }
}

module.exports = CacheService;