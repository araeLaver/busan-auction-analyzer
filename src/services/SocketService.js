const { Server } = require('socket.io');
const NotificationService = require('./NotificationService');
const pool = require('../../config/database');

/**
 * Socket.IO 기반 실시간 서비스
 * 
 * 주요 기능:
 * - 실시간 데이터 브로드캐스트
 * - 사용자별 개인화된 알림
 * - 실시간 대시보드 업데이트
 * - 물건 상태 변경 실시간 전송
 * - 채팅 및 협업 기능 (추후)
 */
class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId 매핑
    this.userSockets = new Map(); // socketId -> userId 매핑 
    this.notificationService = null;
    this.updateIntervals = new Map(); // 사용자별 업데이트 인터벌
  }

  /**
   * Socket.IO 서버 초기화
   */
  initialize(httpServer) {
    try {
      console.log('🔗 Socket.IO 서버 초기화 중...');

      this.io = new Server(httpServer, {
        cors: {
          origin: process.env.NODE_ENV === 'production' 
            ? process.env.FRONTEND_URL 
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
          methods: ['GET', 'POST'],
          credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling']
      });

      // 알림 서비스와 연동
      this.notificationService = new NotificationService(this.io);

      this.setupEventHandlers();
      
      console.log('✅ Socket.IO 서버 초기화 완료');
      return this.io;

    } catch (error) {
      console.error('❌ Socket.IO 서버 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔗 클라이언트 연결: ${socket.id}`);

      // 연결 시 이벤트 핸들러 설정
      this.handleConnection(socket);
      
      // 인증 이벤트
      socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
      
      // 실시간 데이터 구독
      socket.on('subscribe-dashboard', () => this.handleDashboardSubscription(socket));
      socket.on('subscribe-properties', (filters) => this.handlePropertiesSubscription(socket, filters));
      socket.on('subscribe-property', (propertyId) => this.handlePropertySubscription(socket, propertyId));
      
      // 관심목록 관련
      socket.on('watchlist-add', (propertyId) => this.handleWatchlistAdd(socket, propertyId));
      socket.on('watchlist-remove', (propertyId) => this.handleWatchlistRemove(socket, propertyId));
      
      // 실시간 분석 요청
      socket.on('analyze-property', (propertyId) => this.handleAnalysisRequest(socket, propertyId));
      
      // 사용자 활동 추적
      socket.on('user-activity', (data) => this.handleUserActivity(socket, data));
      
      // 연결 해제 처리
      socket.on('disconnect', () => this.handleDisconnection(socket));
      
      // 에러 처리
      socket.on('error', (error) => this.handleSocketError(socket, error));
    });

    // 전역 이벤트 핸들러
    this.io.engine.on('connection_error', (err) => {
      console.error('❌ Socket.IO 연결 오류:', err);
    });
  }

  /**
   * 클라이언트 연결 처리
   */
  async handleConnection(socket) {
    try {
      // 클라이언트 정보 수집
      const clientInfo = {
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        timestamp: new Date()
      };

      console.log('📊 클라이언트 정보:', clientInfo);

      // 연결 환영 메시지
      socket.emit('connected', {
        message: '부산경매 AI 분석 시스템에 연결되었습니다',
        socketId: socket.id,
        serverTime: new Date().toISOString(),
        features: {
          realTimeUpdates: true,
          pushNotifications: true,
          aiAnalysis: true
        }
      });

      // 기본 대시보드 데이터 전송
      await this.sendInitialDashboardData(socket);

    } catch (error) {
      console.error('❌ 연결 처리 중 오류:', error);
      socket.emit('error', { message: '연결 처리 중 오류가 발생했습니다' });
    }
  }

  /**
   * 사용자 인증 처리
   */
  async handleAuthentication(socket, data) {
    try {
      const { userId, token } = data;

      // TODO: JWT 토큰 검증 로직 구현
      // 현재는 기본 인증으로 처리
      if (userId) {
        // 사용자 매핑 저장
        this.connectedUsers.set(userId, socket.id);
        this.userSockets.set(socket.id, userId);
        
        // 사용자별 채널에 조인
        socket.join(`user_${userId}`);
        
        console.log(`👤 사용자 인증 완료: ${userId} (${socket.id})`);
        
        // 인증 성공 응답
        socket.emit('authenticated', {
          success: true,
          userId,
          message: '인증이 완료되었습니다'
        });

        // 사용자별 맞춤 데이터 전송
        await this.sendPersonalizedData(socket, userId);

      } else {
        socket.emit('authentication-failed', {
          success: false,
          message: '인증 정보가 올바르지 않습니다'
        });
      }

    } catch (error) {
      console.error('❌ 인증 처리 중 오류:', error);
      socket.emit('authentication-failed', {
        success: false,
        message: '인증 처리 중 오류가 발생했습니다'
      });
    }
  }

  /**
   * 대시보드 실시간 구독
   */
  async handleDashboardSubscription(socket) {
    try {
      console.log(`📊 대시보드 구독: ${socket.id}`);
      
      // 대시보드 채널에 조인
      socket.join('dashboard');
      
      // 즉시 대시보드 데이터 전송
      await this.sendDashboardUpdate(socket);
      
      socket.emit('subscription-confirmed', {
        type: 'dashboard',
        message: '대시보드 실시간 업데이트가 시작되었습니다'
      });

    } catch (error) {
      console.error('❌ 대시보드 구독 처리 중 오류:', error);
      socket.emit('error', { message: '대시보드 구독 실패' });
    }
  }

  /**
   * 물건 목록 실시간 구독  
   */
  async handlePropertiesSubscription(socket, filters = {}) {
    try {
      console.log(`🏠 물건 목록 구독: ${socket.id}`, filters);
      
      // 필터 기반 채널명 생성
      const channelName = this.generatePropertyChannel(filters);
      socket.join(channelName);
      
      // 필터링된 물건 데이터 전송
      await this.sendFilteredProperties(socket, filters);
      
      socket.emit('subscription-confirmed', {
        type: 'properties',
        channel: channelName,
        filters,
        message: '물건 목록 실시간 업데이트가 시작되었습니다'
      });

    } catch (error) {
      console.error('❌ 물건 목록 구독 처리 중 오류:', error);
      socket.emit('error', { message: '물건 목록 구독 실패' });
    }
  }

  /**
   * 개별 물건 실시간 구독
   */
  async handlePropertySubscription(socket, propertyId) {
    try {
      console.log(`🏠 물건 상세 구독: ${socket.id}, Property: ${propertyId}`);
      
      socket.join(`property_${propertyId}`);
      
      // 물건 상세 정보 전송
      await this.sendPropertyDetail(socket, propertyId);
      
      socket.emit('subscription-confirmed', {
        type: 'property',
        propertyId,
        message: '물건 실시간 업데이트가 시작되었습니다'
      });

    } catch (error) {
      console.error('❌ 물건 구독 처리 중 오류:', error);
      socket.emit('error', { message: '물건 구독 실패' });
    }
  }

  /**
   * 분석 요청 처리
   */
  async handleAnalysisRequest(socket, propertyId) {
    try {
      const userId = this.userSockets.get(socket.id);
      console.log(`🤖 분석 요청: 사용자 ${userId}, 물건 ${propertyId}`);

      // 분석 큐에 추가 (실제로는 백그라운드 작업)
      socket.emit('analysis-queued', {
        propertyId,
        message: 'AI 분석이 시작되었습니다. 완료되면 알림을 받으실 수 있습니다.',
        estimatedTime: '2-3분'
      });

      // 실제 분석 프로세스 시뮬레이션 (2초 후 완료)
      setTimeout(() => {
        socket.emit('analysis-progress', {
          propertyId,
          progress: 50,
          status: '수익성 분석 중...'
        });
      }, 1000);

      setTimeout(() => {
        socket.emit('analysis-complete', {
          propertyId,
          result: {
            investmentScore: Math.floor(Math.random() * 40) + 60, // 60-100
            grade: ['A', 'B', 'S'][Math.floor(Math.random() * 3)],
            roi1Year: (Math.random() * 30 + 5).toFixed(1),
            successProbability: (Math.random() * 40 + 50).toFixed(1)
          }
        });
      }, 3000);

    } catch (error) {
      console.error('❌ 분석 요청 처리 중 오류:', error);
      socket.emit('analysis-failed', {
        propertyId,
        message: '분석 요청 처리 중 오류가 발생했습니다'
      });
    }
  }

  /**
   * 관심목록 추가
   */
  async handleWatchlistAdd(socket, propertyId) {
    try {
      const userId = this.userSockets.get(socket.id);
      if (!userId) {
        socket.emit('error', { message: '로그인이 필요합니다' });
        return;
      }

      console.log(`⭐ 관심목록 추가: 사용자 ${userId}, 물건 ${propertyId}`);

      // TODO: 데이터베이스에 관심목록 추가
      
      socket.emit('watchlist-updated', {
        action: 'added',
        propertyId,
        message: '관심목록에 추가되었습니다'
      });

      // 해당 물건의 실시간 업데이트 구독
      socket.join(`property_${propertyId}`);

    } catch (error) {
      console.error('❌ 관심목록 추가 중 오류:', error);
      socket.emit('error', { message: '관심목록 추가 실패' });
    }
  }

  /**
   * 사용자 활동 추적
   */
  async handleUserActivity(socket, data) {
    try {
      const userId = this.userSockets.get(socket.id);
      const activity = {
        userId,
        socketId: socket.id,
        action: data.action,
        page: data.page,
        timestamp: new Date(),
        data: data.data || {}
      };

      console.log('📊 사용자 활동:', activity);

      // TODO: 활동 로그 저장 (분석용)
      
    } catch (error) {
      console.error('❌ 사용자 활동 추적 중 오류:', error);
    }
  }

  /**
   * 연결 해제 처리
   */
  handleDisconnection(socket) {
    try {
      const userId = this.userSockets.get(socket.id);
      
      console.log(`🔌 클라이언트 연결 해제: ${socket.id} (사용자: ${userId})`);

      // 매핑 정보 정리
      if (userId) {
        this.connectedUsers.delete(userId);
        
        // 개인화된 업데이트 인터벌 정리
        const interval = this.updateIntervals.get(userId);
        if (interval) {
          clearInterval(interval);
          this.updateIntervals.delete(userId);
        }
      }
      
      this.userSockets.delete(socket.id);

    } catch (error) {
      console.error('❌ 연결 해제 처리 중 오류:', error);
    }
  }

  /**
   * Socket 에러 처리
   */
  handleSocketError(socket, error) {
    console.error(`❌ Socket 에러 (${socket.id}):`, error);
    
    socket.emit('error', {
      message: '연결 중 오류가 발생했습니다',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }

  // === 데이터 전송 메서드들 ===

  /**
   * 초기 대시보드 데이터 전송
   */
  async sendInitialDashboardData(socket) {
    try {
      const dashboardData = await this.getDashboardData();
      socket.emit('dashboard-data', dashboardData);
    } catch (error) {
      console.error('❌ 초기 대시보드 데이터 전송 실패:', error);
    }
  }

  /**
   * 대시보드 업데이트 전송
   */
  async sendDashboardUpdate(socket = null) {
    try {
      const dashboardData = await this.getDashboardData();
      
      if (socket) {
        socket.emit('dashboard-update', dashboardData);
      } else {
        // 대시보드 구독자들에게 브로드캐스트
        this.io.to('dashboard').emit('dashboard-update', dashboardData);
      }
    } catch (error) {
      console.error('❌ 대시보드 업데이트 전송 실패:', error);
    }
  }

  /**
   * 개인화된 데이터 전송
   */
  async sendPersonalizedData(socket, userId) {
    try {
      // 사용자 관심목록 조회
      const watchlist = await this.getUserWatchlist(userId);
      
      // 사용자 알림 설정 조회
      const notificationSettings = await this.notificationService?.getUserNotificationSettings(userId);
      
      socket.emit('personalized-data', {
        watchlist,
        notificationSettings,
        preferences: {
          // 사용자별 설정 (추후 구현)
        }
      });

      // 관심목록 물건들의 실시간 업데이트 구독
      watchlist?.forEach(item => {
        socket.join(`property_${item.propertyId}`);
      });

    } catch (error) {
      console.error('❌ 개인화된 데이터 전송 실패:', error);
    }
  }

  /**
   * 필터링된 물건 목록 전송
   */
  async sendFilteredProperties(socket, filters) {
    try {
      const properties = await this.getFilteredProperties(filters);
      socket.emit('properties-data', {
        properties,
        filters,
        total: properties.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 필터링된 물건 목록 전송 실패:', error);
    }
  }

  /**
   * 물건 상세 정보 전송
   */
  async sendPropertyDetail(socket, propertyId) {
    try {
      const property = await this.getPropertyDetail(propertyId);
      socket.emit('property-detail', {
        property,
        propertyId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 물건 상세 정보 전송 실패:', error);
    }
  }

  // === 브로드캐스트 메서드들 ===

  /**
   * 신규 물건 브로드캐스트
   */
  broadcastNewProperty(property) {
    try {
      console.log(`📢 신규 물건 브로드캐스트: ${property.id}`);
      
      this.io.emit('property-added', {
        property,
        timestamp: new Date().toISOString()
      });
      
      // 대시보드 업데이트도 함께 전송
      this.sendDashboardUpdate();

    } catch (error) {
      console.error('❌ 신규 물건 브로드캐스트 실패:', error);
    }
  }

  /**
   * 물건 업데이트 브로드캐스트
   */
  broadcastPropertyUpdate(property, changes = {}) {
    try {
      console.log(`📢 물건 업데이트 브로드캐스트: ${property.id}`);
      
      // 해당 물건 구독자들에게 전송
      this.io.to(`property_${property.id}`).emit('property-updated', {
        property,
        changes,
        timestamp: new Date().toISOString()
      });

      // 전체 목록 업데이트도 전송
      this.io.emit('property-list-update', {
        propertyId: property.id,
        updates: changes,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ 물건 업데이트 브로드캐스트 실패:', error);
    }
  }

  /**
   * 시장 동향 브로드캐스트
   */
  broadcastMarketUpdate(marketData) {
    try {
      console.log('📢 시장 동향 브로드캐스트');
      
      this.io.emit('market-update', {
        data: marketData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ 시장 동향 브로드캐스트 실패:', error);
    }
  }

  // === 데이터 조회 헬퍼 메서드들 ===

  async getDashboardData() {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE current_status = 'active') as total_active_properties,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as new_today,
          ROUND(AVG(ar.investment_score), 1) as avg_investment_score,
          COUNT(*) FILTER (WHERE ar.investment_score >= 85) as excellent_properties,
          COUNT(*) FILTER (WHERE DATE(auction_date) = CURRENT_DATE) as auctions_today,
          COUNT(*) FILTER (WHERE auction_date BETWEEN NOW() AND NOW() + INTERVAL '7 days') as auctions_this_week
        FROM properties p
        LEFT JOIN analysis_results ar ON p.id = ar.property_id
        WHERE p.current_status = 'active'
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('❌ 대시보드 데이터 조회 실패:', error);
      return {
        total_active_properties: 0,
        new_today: 0,
        avg_investment_score: 0,
        excellent_properties: 0,
        auctions_today: 0,
        auctions_this_week: 0
      };
    }
  }

  async getUserWatchlist(userId) {
    try {
      // TODO: 실제 데이터베이스 쿼리 구현
      return [];
    } catch (error) {
      console.error('❌ 사용자 관심목록 조회 실패:', error);
      return [];
    }
  }

  generatePropertyChannel(filters) {
    // 필터를 기반으로 채널명 생성
    const filterString = Object.entries(filters)
      .filter(([key, value]) => value !== '' && value != null)
      .map(([key, value]) => `${key}:${value}`)
      .sort()
      .join('|');
    
    return `properties_${Buffer.from(filterString).toString('base64').slice(0, 16)}`;
  }

  /**
   * 연결된 사용자 수 조회
   */
  getConnectedUsersCount() {
    return this.io?.engine?.clientsCount || 0;
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * 서비스 상태 정보
   */
  getServiceStatus() {
    return {
      isInitialized: !!this.io,
      connectedClients: this.getConnectedUsersCount(),
      connectedUsers: this.connectedUsers.size,
      notificationService: !!this.notificationService,
      uptime: process.uptime()
    };
  }
}

module.exports = SocketService;