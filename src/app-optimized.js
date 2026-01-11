const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 서비스 클래스들
const SocketService = require('./services/SocketService');
const NotificationService = require('./services/NotificationService');
const CacheService = require('./services/CacheService');
const AnalysisService = require('./services/AnalysisService');
const AdvancedCourtAuctionScraper = require('./scraper/AdvancedCourtAuctionScraper');
const AIInvestmentAnalyzer = require('./analyzer/AIInvestmentAnalyzer');

const DailyScheduler = require('./scheduler/DailyScheduler');
const WatchlistService = require('./services/WatchlistService'); // 추가

// 데이터베이스
const pool = require('../config/database');

/**
 * 고성능 부산경매 AI 분석 시스템
 * 
 * 주요 특징:
 * - 실시간 Socket.IO 연동
 * - 다단계 캐싱 시스템
 * - AI 기반 투자 분석
 * - 고급 스크래핑 엔진
 * - 성능 최적화 및 모니터링
 */
class OptimizedBusanAuctionApp {
  constructor() {
    this.app = express();
    this.server = null;
    
    // 서비스 인스턴스들
    this.socketService = new SocketService();
    this.cacheService = new CacheService();
    this.notificationService = new NotificationService();
    this.analysisService = new AnalysisService();
    this.scraper = new AdvancedCourtAuctionScraper();
    this.analyzer = new AIInvestmentAnalyzer();
    this.scheduler = new DailyScheduler();
    this.watchlistService = new WatchlistService(); // 추가
    
    // 앱 상태
    this.isRunning = false;
    this.startTime = Date.now();
    
    // 성능 메트릭
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      memoryUsage: [],
      cpuUsage: []
    };
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    try {
      console.log('🚀 부산경매 AI 분석 시스템 초기화 중...');
      
      // Express 앱 설정
      await this.setupExpress();
      
      // HTTP 서버 생성
      this.server = http.createServer(this.app);
      
      // Socket.IO 초기화
      const io = this.socketService.initialize(this.server);
      this.notificationService.setSocketIO(io);
      
      // API 라우트 설정
      await this.setupRoutes();
      
      // 에러 핸들링
      this.setupErrorHandling();
      
      // 성능 모니터링
      this.setupPerformanceMonitoring();
      
      // 캐시 워밍 (DB 연결 실패 시 스킵)
      console.log('⚠️ 캐시 워밍 스킵 (초기 구동 속도 최적화)');
      // 백그라운드에서 캐시 워밍 실행
      setTimeout(async () => {
        try {
          console.log('🔥 백그라운드 캐시 워밍 시작...');
          await this.cacheService.warmupCache();
          console.log('✅ 백그라운드 캐시 워밍 완료');
        } catch (error) {
          console.log('⚠️ 캐시 워밍 실패 (DB 연결 없음):', error.message);
        }
      }, 3000);
      
      console.log('✅ 애플리케이션 초기화 완료');
      
    } catch (error) {
      console.error('❌ 애플리케이션 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * Express 앱 설정
   */
  async setupExpress() {
    // 보안 미들웨어
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"], // unsafe-eval은 일부 라이브러리 호환성을 위해 필요할 수 있음
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:", "https://api.github.com"], // GitHub API 등 외부 API 허용
          frameSrc: ["'self'", "https:"], // 지도나 외부 콘텐츠 iframe 허용
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        }
      },
      crossOriginEmbedderPolicy: false, // 일부 리소스 로딩 문제 해결
    }));

    // GZIP 압축
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024,
      level: 6
    }));

    // CORS 설정
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:3002', 'http://127.0.0.1:3002'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 1000, // 최대 1000 요청
      message: {
        error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
        retryAfter: '15분'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Socket.IO 연결은 제외
        return req.path.startsWith('/socket.io/');
      }
    });

    this.app.use('/api', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 요청 로깅 및 메트릭
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      this.metrics.requests++;
      
      // 응답 완료 시 성능 메트릭 기록
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.metrics.responseTime.push(duration);
        
        // 응답 시간 배열이 너무 커지지 않도록 제한
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime.shift();
        }
        
        // 느린 응답 로깅
        if (duration > 1000) {
          console.warn(`⚠️ 느린 응답: ${req.method} ${req.path} - ${duration}ms`);
        }
      });
      
      next();
    });

    // 정적 파일 서빙 (캐싱 최적화)
    this.app.use(express.static(path.join(__dirname, '../public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // JS, CSS 파일은 더 긴 캐시
        if (path.endsWith('.js') || path.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 1일
        }
        // 이미지 파일들
        if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=604800'); // 1주
        }
      }
    }));
  }

  /**
   * API 라우트 설정
   */
  async setupRoutes() {
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: 'connected',
          cache: 'active',
          socketIO: this.socketService.getConnectedUsersCount(),
          scraper: 'ready'
        },
        metrics: {
          totalRequests: this.metrics.requests,
          totalErrors: this.metrics.errors,
          avgResponseTime: this.getAverageResponseTime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };
      
      res.json(health);
    });

    // API 라우트들
    this.setupApiRoutes();
    
    // 메인 페이지
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // SPA를 위한 catch-all 라우트
    this.app.get('*', (req, res) => {
      // API 경로가 아닌 경우에만 메인 페이지 반환
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
      } else {
        res.status(404).json({ error: 'API endpoint not found' });
      }
    });
  }

  /**
   * API 엔드포인트 설정
   */
  setupApiRoutes() {
    const router = express.Router();

    // === 인증 API ===
    router.use('/auth', authRoutes);

    // === 대시보드 API ===
    router.get('/dashboard/stats', async (req, res) => {
      try {
        const stats = await this.cacheService.getDashboardStats();

        // 프론트엔드 형식에 맞게 변환
        const response = {
          totalActiveProperties: parseInt(stats.total_active_properties) || 0,
          newTodayCount: parseInt(stats.new_today) || 0,
          averageInvestmentScore: parseFloat(stats.avg_investment_score) || 0,
          highScoreCount: parseInt(stats.good_properties) || 0,
          excellentProperties: parseInt(stats.excellent_properties) || 0,
          sGradeProperties: parseInt(stats.s_grade_properties) || 0,
          auctionsToday: parseInt(stats.auctions_today) || 0,
          auctionsThisWeek: parseInt(stats.auctions_this_week) || 0
        };

        res.json(response);
      } catch (error) {
        console.error('❌ 대시보드 통계 API 오류:', error);
        res.status(500).json({
          error: '대시보드 통계 조회 실패',
          message: error.message
        });
      }
    });

    // === 물건 목록 API ===
    router.get('/properties', async (req, res) => {
      try {
        const {
          page = 1,
          limit = 10,
          sort = 'investment_score',
          order = 'DESC',
          type,
          region,
          minPrice,
          maxPrice,
          minScore,
          grade,
          failureCount,
          roi,
          tenant
        } = req.query;

        const filters = {
          propertyType: type,
          region,
          minPrice: minPrice ? parseInt(minPrice) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
          minScore: minScore ? parseInt(minScore) : undefined
        };

        // CacheService를 통해 데이터 조회
        const result = await this.cacheService.getPropertiesList(
          filters, 
          parseInt(page), 
          parseInt(limit), 
          sort, 
          order
        );

        // 프론트엔드가 기대하는 구조로 변환
        const formattedResponse = {
          data: result.properties || [],
          pagination: {
            page: result.page || 1,
            limit: result.limit || 10,
            total: result.total || 0,
            totalPages: result.totalPages || 0,
            hasNext: result.hasNext || false,
            hasPrev: result.hasPrev || false
          }
        };
        
        res.json(formattedResponse);

      } catch (error) {
        console.error('❌ 물건 목록 조회 실패:', error);
        res.status(500).json({ 
          error: '물건 목록 조회 실패',
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        });
      }
    });

    // === 물건 상세 API ===
    router.get('/properties/:id', async (req, res) => {
      try {
        const propertyId = parseInt(req.params.id);
        
        if (isNaN(propertyId)) {
          return res.status(400).json({ error: '올바르지 않은 물건 ID' });
        }

        const property = await this.cacheService.getPropertyDetail(propertyId);
        
        if (!property) {
          return res.status(404).json({ error: '물건을 찾을 수 없습니다' });
        }

        res.json(property);

      } catch (error) {
        console.error('❌ 물건 상세 조회 실패:', error);
        res.status(500).json({ error: '물건 상세 조회 실패' });
      }
    });

    // === 실시간 분석 API ===
    router.post('/properties/:id/analyze', authenticateToken, async (req, res) => { // 인증 필요
      try {
        const propertyId = parseInt(req.params.id);
        
        if (isNaN(propertyId)) {
          return res.status(400).json({ error: '올바르지 않은 물건 ID' });
        }

        // 비동기로 분석 시작
        this.analyzer.analyzeProperty(propertyId)
          .then((result) => {
            // Socket.IO로 결과 전송
            this.socketService.io?.emit('analysis-complete', {
              propertyId,
              result
            });
            
            // 캐시 무효화
            this.cacheService.invalidatePropertyCache(propertyId);
          })
          .catch((error) => {
            console.error(`❌ 물건 ${propertyId} 분석 실패:`, error);
            this.socketService.io?.emit('analysis-failed', {
              propertyId,
              error: error.message
            });
          });

        res.json({ 
          message: '분석이 시작되었습니다',
          propertyId,
          estimatedTime: '2-3분'
        });

      } catch (error) {
        console.error('❌ 분석 요청 처리 실패:', error);
        res.status(500).json({ error: '분석 요청 처리 실패' });
      }
    });

    // === 시장 트렌드 API ===
    router.get('/market/trends', async (req, res) => {
      try {
        const { region, propertyType = '아파트', period = '3M' } = req.query;
        
        if (!region) {
          return res.status(400).json({ error: '지역 파라미터가 필요합니다' });
        }

        const trend = await this.cacheService.getMarketTrend(region, propertyType, period);
        res.json(trend);

      } catch (error) {
        console.error('❌ 시장 트렌드 조회 실패:', error);
        res.status(500).json({ error: '시장 트렌드 조회 실패' });
      }
    });

    // === 관심목록 API ===
    router.get('/watchlist', optionalAuth, async (req, res) => {
      try {
        const userId = req.user?.id || 'temp_user'; 
        const { page = 1, limit = 20 } = req.query;
        
        const result = await this.watchlistService.getUserWatchlist(userId, {
          page: parseInt(page),
          limit: parseInt(limit)
        });
        
        res.json(result);
      } catch (error) {
        console.error('❌ 관심목록 조회 실패:', error);
        res.status(500).json({ error: '관심목록 조회 실패' });
      }
    });

    router.get('/watchlist/:propertyId/check', optionalAuth, async (req, res) => {
      try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = req.user?.id || 'temp_user';
        
        const isInWatchlist = await this.watchlistService.isInWatchlist(userId, propertyId);
        res.json({ isInWatchlist });
      } catch (error) {
        res.status(500).json({ error: '관심목록 확인 실패' });
      }
    });

    router.post('/watchlist/:propertyId', optionalAuth, async (req, res) => {
      try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = req.user?.id || 'temp_user';
        const settings = req.body.settings || {};

        const result = await this.watchlistService.addToWatchlist(userId, propertyId, settings);
        
        // 캐시 무효화 (관심 물건 목록 캐시 등)
        this.cacheService.deleteByPattern(`watchlist:${userId}`);
        
        res.json({ 
          message: '관심목록에 추가되었습니다',
          data: result 
        });

      } catch (error) {
        console.error('❌ 관심목록 추가 실패:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
      }
    });

    router.delete('/watchlist/:propertyId', optionalAuth, async (req, res) => {
      try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = req.user?.id || 'temp_user';

        await this.watchlistService.removeFromWatchlist(userId, propertyId);
        
        this.cacheService.deleteByPattern(`watchlist:${userId}`);
        
        res.json({ message: '관심목록에서 제거되었습니다' });
      } catch (error) {
        console.error('❌ 관심목록 제거 실패:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
      }
    });

    // === 스크래핑 API (관리자용) ===
    router.post('/admin/scrape', async (req, res) => {
      try {
        // TODO: 관리자 권한 확인

        // 비동기로 스크래핑 시작
        this.scraper.scrapeBusanAuctions()
          .then((result) => {
            console.log('✅ 스크래핑 완료:', result);
            
            // 캐시 무효화
            this.cacheService.clearAllCaches();
            
            // Socket.IO로 업데이트 알림
            this.socketService.io?.emit('scraping-complete', result);
          })
          .catch((error) => {
            console.error('❌ 스크래핑 실패:', error);
          });

        res.json({ 
          message: '스크래핑이 시작되었습니다',
          estimatedTime: '5-10분'
        });

      } catch (error) {
        console.error('❌ 스크래핑 시작 실패:', error);
        res.status(500).json({ error: '스크래핑 시작 실패' });
      }
    });

    // === 캐시 관리 API (관리자용) ===
    router.get('/admin/cache/stats', (req, res) => {
      try {
        const stats = this.cacheService.getCacheStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: '캐시 통계 조회 실패' });
      }
    });

    router.delete('/admin/cache', (req, res) => {
      try {
        this.cacheService.clearAllCaches();
        res.json({ message: '캐시가 초기화되었습니다' });
      } catch (error) {
        res.status(500).json({ error: '캐시 초기화 실패' });
      }
    });

    // === 시스템 상태 API ===
    router.get('/system/status', (req, res) => {
      const status = {
        app: {
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        services: {
          socketIO: this.socketService.getServiceStatus(),
          cache: this.cacheService.getCacheStats(),
          database: 'connected', // TODO: 실제 DB 상태 확인
          notifications: 'active'
        },
        metrics: {
          requests: this.metrics.requests,
          errors: this.metrics.errors,
          avgResponseTime: this.getAverageResponseTime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };
      
      res.json(status);
    });

    this.app.use('/api', router);
  }

  /**
   * 에러 핸들링 설정
   */
  setupErrorHandling() {
    const { errorHandler, notFoundHandler } = require('./utils/errorHandler');

    // 404 핸들러
    this.app.use(notFoundHandler);

    // 전역 에러 핸들러
    this.app.use((err, req, res, next) => {
      this.metrics.errors++;
      errorHandler(err, req, res, next);
    });

    // Promise rejection 핸들링
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
      // 로그 기록하지만 서버는 계속 실행
    });

    // 예외 처리
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      console.error('서버를 안전하게 종료합니다...');

      // 안전한 종료
      setTimeout(() => {
        this.gracefulShutdown();
      }, 1000);
    });

    // SIGTERM, SIGINT 핸들링
    process.on('SIGTERM', () => {
      console.log('📡 SIGTERM 신호 수신');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      console.log('📡 SIGINT 신호 수신 (Ctrl+C)');
      this.gracefulShutdown();
    });
  }

  /**
   * 성능 모니터링 설정
   */
  setupPerformanceMonitoring() {
    // 5분마다 성능 메트릭 로깅
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.memoryUsage.push(memoryUsage);
      this.metrics.cpuUsage.push(cpuUsage);
      
      // 배열 크기 제한
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage.shift();
      }
      if (this.metrics.cpuUsage.length > 100) {
        this.metrics.cpuUsage.shift();
      }
      
      console.log('📊 성능 메트릭:', {
        requests: this.metrics.requests,
        avgResponseTime: this.getAverageResponseTime(),
        memoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        connectedUsers: this.socketService.getConnectedUsersCount()
      });
      
    }, 300000); // 5분

    // 1시간마다 상세 리포트
    setInterval(() => {
      this.generatePerformanceReport();
    }, 3600000); // 1시간
  }

  /**
   * 서버 시작
   */
  async start(port = 3000) {
    try {
      if (this.isRunning) {
        console.log('⚠️ 서버가 이미 실행 중입니다');
        return;
      }

      await this.initialize();

      this.server.listen(port, () => {
        this.isRunning = true;
        console.log(`🚀 부산경매 AI 분석 시스템이 포트 ${port}에서 실행 중입니다`);
        console.log(`🌐 URL: http://localhost:${port}`);
        console.log(`📊 관리자: http://localhost:${port}/admin`);
        console.log(`🔗 실시간 연결: ${this.socketService.getConnectedUsersCount()}개`);
      });

      // 정기 작업 시작
      this.startScheduledTasks();

    } catch (error) {
      console.error('❌ 서버 시작 실패:', error);
      throw error;
    }
  }

  /**
   * 정기 작업 시작
   */
  startScheduledTasks() {
    console.log('⏰ 정기 작업 스케줄 시작');

    // 일일 스케줄러 시작 (스크래핑, 분석, 리포트)
    this.scheduler.start();

    // 10분마다 알림 처리
    setInterval(async () => {
      try {
        await this.notificationService.runPeriodicTasks();
      } catch (error) {
        console.error('❌ 알림 처리 중 오류:', error);
      }
    }, 600000); // 10분

    // 1시간마다 대시보드 캐시 갱신
    setInterval(() => {
      this.cacheService.invalidateDashboardCache();
    }, 3600000); // 1시간
  }

  /**
   * 안전한 종료
   */
  async gracefulShutdown() {
    console.log('🔄 안전한 서버 종료 시작...');

    this.isRunning = false;

    try {
      // Socket.IO 연결 정리
      if (this.socketService.io) {
        this.socketService.io.close();
      }

      // 서버 종료
      if (this.server) {
        this.server.close();
      }

      // 데이터베이스 연결 정리
      if (pool) {
        await pool.end();
      }

      console.log('✅ 서버 종료 완료');
      process.exit(0);

    } catch (error) {
      console.error('❌ 서버 종료 중 오류:', error);
      process.exit(1);
    }
  }

  // === 유틸리티 메서드들 ===

  getAverageResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    
    const sum = this.metrics.responseTime.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.responseTime.length);
  }

  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: (this.metrics.errors / this.metrics.requests * 100).toFixed(2) + '%',
      avgResponseTime: this.getAverageResponseTime(),
      connectedUsers: this.socketService.getConnectedUsersCount(),
      cacheStats: this.cacheService.getCacheStats(),
      memoryUsage: process.memoryUsage()
    };

    console.log('📋 성능 리포트:', report);
    
    // TODO: 로그 파일에 저장 또는 모니터링 시스템에 전송
  }
}

module.exports = OptimizedBusanAuctionApp;

// 직접 실행 시
if (require.main === module) {
  const app = new OptimizedBusanAuctionApp();

  const port = process.env.PORT || 3000;

  app.start(port).catch((error) => {
    console.error('❌ 애플리케이션 시작 실패:', error);
    console.error('상세 오류:', error.stack);
    process.exit(1);
  });
}