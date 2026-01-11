const pool = require('../../config/database');

/**
 * 실시간 알림 서비스
 * 
 * 주요 기능:
 * - 실시간 알림 큐 관리
 * - 사용자별 알림 설정 관리
 * - 다양한 알림 타입 지원
 * - 우선순위 기반 알림 전송
 * - 실패 시 재시도 로직
 */
class NotificationService {
  constructor(io = null) {
    this.io = io; // Socket.IO 인스턴스
    this.notificationTypes = {
      PROPERTY_ADDED: 'PROPERTY_ADDED',
      PROPERTY_UPDATED: 'PROPERTY_UPDATED', 
      PRICE_DROP: 'PRICE_DROP',
      SCORE_CHANGE: 'SCORE_CHANGE',
      AUCTION_REMINDER: 'AUCTION_REMINDER',
      ANALYSIS_COMPLETE: 'ANALYSIS_COMPLETE',
      MARKET_ALERT: 'MARKET_ALERT',
      WATCHLIST_UPDATE: 'WATCHLIST_UPDATE'
    };
    
    this.priorities = {
      URGENT: 1,
      HIGH: 2,
      MEDIUM: 5,
      LOW: 8,
      INFO: 10
    };
  }

  /**
   * Socket.IO 인스턴스 설정
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * 알림 생성 및 큐에 추가
   */
  async createNotification(notification) {
    try {
      const {
        userId = null,
        type,
        propertyId = null,
        title,
        message,
        data = {},
        priority = this.priorities.MEDIUM,
        scheduledAt = null
      } = notification;

      if (!type || !title || !message) {
        throw new Error('알림 생성에 필요한 필수 정보가 없습니다.');
      }

      const query = `
        INSERT INTO notification_queue (
          user_id, notification_type, property_id, title, message,
          data, priority, scheduled_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING id
      `;

      const result = await pool.query(query, [
        userId,
        type,
        propertyId,
        title,
        message,
        JSON.stringify(data),
        priority,
        scheduledAt || new Date()
      ]);

      const notificationId = result.rows[0].id;
      console.log(`✅ 알림 생성: ID ${notificationId}, 타입: ${type}`);

      // 즉시 전송 가능한 알림이면 바로 처리
      if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
        await this.processNotification(notificationId);
      }

      return notificationId;

    } catch (error) {
      console.error('❌ 알림 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 개별 알림 처리
   */
  async processNotification(notificationId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 알림 정보 조회
      const notificationQuery = `
        SELECT * FROM notification_queue 
        WHERE id = $1 AND status = 'pending'
        FOR UPDATE
      `;
      
      const notificationResult = await client.query(notificationQuery, [notificationId]);
      
      if (notificationResult.rows.length === 0) {
        console.log(`⚠️ 처리할 알림이 없습니다: ID ${notificationId}`);
        return;
      }

      const notification = notificationResult.rows[0];
      
      // 알림 전송
      const success = await this.sendNotification(notification);
      
      // 상태 업데이트
      const updateQuery = success ? `
        UPDATE notification_queue 
        SET status = 'sent', sent_at = NOW()
        WHERE id = $1
      ` : `
        UPDATE notification_queue 
        SET retry_count = retry_count + 1,
            error_message = $2
        WHERE id = $1
      `;
      
      if (success) {
        await client.query(updateQuery, [notificationId]);
        console.log(`✅ 알림 전송 성공: ID ${notificationId}`);
      } else {
        await client.query(updateQuery, [notificationId, '전송 실패']);
        console.log(`❌ 알림 전송 실패: ID ${notificationId}`);
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ 알림 처리 중 오류: ID ${notificationId}`, error);
    } finally {
      client.release();
    }
  }

  /**
   * 실제 알림 전송
   */
  async sendNotification(notification) {
    try {
      const { user_id, notification_type, title, message, data } = notification;
      
      // Socket.IO를 통한 실시간 전송
      if (this.io) {
        const socketData = {
          id: notification.id,
          type: notification_type,
          title,
          message,
          data: JSON.parse(data || '{}'),
          timestamp: new Date().toISOString()
        };

        // 알림 타입에 따른 이벤트 이름 매핑
        let eventName = 'notification';
        if (['PROPERTY_ADDED', 'PROPERTY_UPDATED', 'PRICE_DROP'].includes(notification_type)) {
            eventName = 'property-update';
        } else if (notification_type === 'ANALYSIS_COMPLETE') {
            eventName = 'analysis-complete';
        } else if (notification_type === 'MARKET_ALERT') {
            eventName = 'market-update';
        }

        if (user_id) {
          // 특정 사용자에게 전송
          this.io.to(`user_${user_id}`).emit(eventName, socketData);
          // 일반 알림 이벤트도 함께 전송 (알림 센터용)
          this.io.to(`user_${user_id}`).emit('notification', socketData);
        } else {
          // 전체 사용자에게 브로드캐스트
          this.io.emit(eventName, socketData);
          this.io.emit('notification', socketData);
        }
      }

      // 브라우저 푸시 알림 (서비스 워커 필요)
      // 추후 구현 예정

      // 이메일 알림 (고우선순위인 경우)
      if (notification.priority <= this.priorities.HIGH) {
        // 추후 이메일 서비스 연동
      }

      return true;

    } catch (error) {
      console.error('❌ 알림 전송 실패:', error);
      return false;
    }
  }

  /**
   * 대기 중인 알림 일괄 처리
   */
  async processPendingNotifications() {
    try {
      console.log('📋 대기 중인 알림 처리 시작...');

      // 전송 시간이 된 대기 중인 알림들 조회
      const query = `
        SELECT id FROM notification_queue 
        WHERE status = 'pending' 
          AND (scheduled_at IS NULL OR scheduled_at <= NOW())
          AND retry_count < 3
        ORDER BY priority ASC, created_at ASC
        LIMIT 100
      `;

      const result = await pool.query(query);
      const notifications = result.rows;

      console.log(`📊 처리할 알림: ${notifications.length}개`);

      if (notifications.length === 0) {
        return { processed: 0, failed: 0 };
      }

      let processed = 0;
      let failed = 0;

      // 알림 병렬 처리 (최대 5개씩)
      const batchSize = 5;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        const promises = batch.map(async (notification) => {
          try {
            await this.processNotification(notification.id);
            processed++;
          } catch (error) {
            console.error(`❌ 알림 처리 실패: ${notification.id}`, error);
            failed++;
          }
        });

        await Promise.allSettled(promises);
        
        // 배치 간 잠시 대기
        if (i + batchSize < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ 알림 처리 완료: 성공 ${processed}개, 실패 ${failed}개`);
      return { processed, failed };

    } catch (error) {
      console.error('❌ 알림 일괄 처리 중 오류:', error);
      throw error;
    }
  }

  /**
   * 신규 물건 알림 생성
   */
  async notifyNewProperty(property) {
    try {
      const investmentGrade = this.getInvestmentGrade(property.investment_score);
      const priority = investmentGrade === 'S' ? this.priorities.HIGH : this.priorities.MEDIUM;

      await this.createNotification({
        type: this.notificationTypes.PROPERTY_ADDED,
        propertyId: property.id,
        title: `${investmentGrade}급 신규 물건 등록`,
        message: `${property.address}에 새로운 경매 물건이 등록되었습니다.`,
        data: {
          propertyId: property.id,
          address: property.address,
          propertyType: property.property_type,
          minimumSalePrice: property.minimum_sale_price,
          investmentScore: property.investment_score,
          investmentGrade,
          auctionDate: property.auction_date
        },
        priority
      });

    } catch (error) {
      console.error('❌ 신규 물건 알림 생성 실패:', error);
    }
  }

  /**
   * 가격 하락 알림 생성
   */
  async notifyPriceDrop(property, oldPrice, newPrice) {
    try {
      const dropRate = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);
      
      await this.createNotification({
        type: this.notificationTypes.PRICE_DROP,
        propertyId: property.id,
        title: '💰 가격 하락 알림',
        message: `${property.address}의 매각가가 ${dropRate}% 하락했습니다.`,
        data: {
          propertyId: property.id,
          address: property.address,
          oldPrice,
          newPrice,
          dropRate: parseFloat(dropRate)
        },
        priority: this.priorities.HIGH
      });

    } catch (error) {
      console.error('❌ 가격 하락 알림 생성 실패:', error);
    }
  }

  /**
   * AI 점수 변화 알림 생성
   */
  async notifyScoreChange(property, oldScore, newScore) {
    try {
      const scoreChange = newScore - oldScore;
      const changeType = scoreChange > 0 ? '상승' : '하락';
      const icon = scoreChange > 0 ? '📈' : '📉';
      
      await this.createNotification({
        type: this.notificationTypes.SCORE_CHANGE,
        propertyId: property.id,
        title: `${icon} AI 점수 ${changeType}`,
        message: `${property.address}의 투자 점수가 ${Math.abs(scoreChange).toFixed(1)}점 ${changeType}했습니다.`,
        data: {
          propertyId: property.id,
          address: property.address,
          oldScore,
          newScore,
          scoreChange
        },
        priority: Math.abs(scoreChange) > 10 ? this.priorities.HIGH : this.priorities.MEDIUM
      });

    } catch (error) {
      console.error('❌ AI 점수 변화 알림 생성 실패:', error);
    }
  }

  /**
   * 입찰 마감 알림 생성
   */
  async notifyAuctionReminder(property, daysUntilAuction) {
    try {
      let title, message, priority, scheduledAt;
      
      if (daysUntilAuction === 7) {
        title = '📅 입찰 D-7 알림';
        message = `${property.address}의 입찰까지 일주일 남았습니다.`;
        priority = this.priorities.MEDIUM;
      } else if (daysUntilAuction === 3) {
        title = '⏰ 입찰 D-3 알림';
        message = `${property.address}의 입찰까지 3일 남았습니다.`;
        priority = this.priorities.HIGH;
      } else if (daysUntilAuction === 1) {
        title = '🚨 입찰 D-DAY 알림';
        message = `${property.address}의 입찰이 내일입니다!`;
        priority = this.priorities.URGENT;
      }

      if (title) {
        await this.createNotification({
          type: this.notificationTypes.AUCTION_REMINDER,
          propertyId: property.id,
          title,
          message,
          data: {
            propertyId: property.id,
            address: property.address,
            auctionDate: property.auction_date,
            daysUntilAuction,
            investmentScore: property.investment_score
          },
          priority,
          scheduledAt
        });
      }

    } catch (error) {
      console.error('❌ 입찰 알림 생성 실패:', error);
    }
  }

  /**
   * 분석 완료 알림 생성
   */
  async notifyAnalysisComplete(property) {
    try {
      const grade = this.getInvestmentGrade(property.investment_score);
      
      await this.createNotification({
        type: this.notificationTypes.ANALYSIS_COMPLETE,
        propertyId: property.id,
        title: '🤖 AI 분석 완료',
        message: `${property.address}의 AI 분석이 완료되었습니다. (${grade}급, ${property.investment_score}점)`,
        data: {
          propertyId: property.id,
          address: property.address,
          investmentScore: property.investment_score,
          investmentGrade: grade,
          roi1Year: property.roi_1year,
          successProbability: property.success_probability
        },
        priority: grade === 'S' ? this.priorities.HIGH : this.priorities.MEDIUM
      });

    } catch (error) {
      console.error('❌ 분석 완료 알림 생성 실패:', error);
    }
  }

  /**
   * 시장 동향 알림 생성
   */
  async notifyMarketAlert(region, alertType, data) {
    try {
      let title, message;
      
      switch (alertType) {
        case 'PRICE_SURGE':
          title = '📊 지역 가격 급등 알림';
          message = `${region} 지역의 평균 매각가가 ${data.increaseRate}% 상승했습니다.`;
          break;
        case 'HIGH_COMPETITION':
          title = '🔥 경쟁 심화 알림'; 
          message = `${region} 지역의 경매 경쟁이 심화되고 있습니다.`;
          break;
        case 'NEW_LISTINGS':
          title = '🆕 신규 물건 급증';
          message = `${region} 지역에 ${data.newCount}개의 신규 물건이 등록되었습니다.`;
          break;
        default:
          return;
      }

      await this.createNotification({
        type: this.notificationTypes.MARKET_ALERT,
        title,
        message,
        data: {
          region,
          alertType,
          ...data
        },
        priority: this.priorities.MEDIUM
      });

    } catch (error) {
      console.error('❌ 시장 알림 생성 실패:', error);
    }
  }

  /**
   * 사용자별 알림 설정 조회
   */
  async getUserNotificationSettings(userId) {
    try {
      const query = `
        SELECT * FROM user_notification_settings 
        WHERE user_id = $1
      `;
      
      const result = await pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // 기본 설정 반환
        return {
          propertyAlerts: true,
          priceAlerts: true,
          scoreAlerts: true,
          auctionReminders: true,
          marketAlerts: false,
          emailNotifications: false,
          pushNotifications: true
        };
      }
      
      return result.rows[0];

    } catch (error) {
      console.error('❌ 사용자 알림 설정 조회 실패:', error);
      return null;
    }
  }

  /**
   * 실패한 알림 재처리
   */
  async retryFailedNotifications() {
    try {
      console.log('🔄 실패한 알림 재처리 시작...');

      const query = `
        SELECT id FROM notification_queue 
        WHERE status = 'pending' 
          AND retry_count > 0 
          AND retry_count < 3
          AND created_at > NOW() - INTERVAL '1 day'
        ORDER BY priority ASC, retry_count ASC
        LIMIT 50
      `;

      const result = await pool.query(query);
      const notifications = result.rows;

      console.log(`🔄 재처리할 알림: ${notifications.length}개`);

      let retried = 0;
      for (const notification of notifications) {
        try {
          await this.processNotification(notification.id);
          retried++;
          
          // 재처리 간 대기
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`❌ 알림 재처리 실패: ${notification.id}`, error);
        }
      }

      console.log(`✅ 알림 재처리 완료: ${retried}개`);
      return retried;

    } catch (error) {
      console.error('❌ 실패한 알림 재처리 중 오류:', error);
      throw error;
    }
  }

  /**
   * 오래된 알림 정리
   */
  async cleanupOldNotifications(daysToKeep = 30) {
    try {
      console.log(`🧹 ${daysToKeep}일 이전 알림 정리 중...`);

      const query = `
        DELETE FROM notification_queue 
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
          AND status IN ('sent', 'failed')
      `;

      const result = await pool.query(query);
      const deletedCount = result.rowCount;

      console.log(`🗑️ 오래된 알림 삭제: ${deletedCount}개`);
      return deletedCount;

    } catch (error) {
      console.error('❌ 알림 정리 중 오류:', error);
      throw error;
    }
  }

  /**
   * 알림 통계 조회
   */
  async getNotificationStats() {
    try {
      const query = `
        SELECT 
          status,
          notification_type,
          COUNT(*) as count,
          AVG(retry_count) as avg_retry_count
        FROM notification_queue 
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY status, notification_type
        ORDER BY status, count DESC
      `;

      const result = await pool.query(query);
      
      return {
        stats: result.rows,
        summary: {
          total: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
          pending: result.rows.filter(row => row.status === 'pending')
            .reduce((sum, row) => sum + parseInt(row.count), 0),
          sent: result.rows.filter(row => row.status === 'sent')
            .reduce((sum, row) => sum + parseInt(row.count), 0),
          failed: result.rows.filter(row => row.status === 'failed')
            .reduce((sum, row) => sum + parseInt(row.count), 0)
        }
      };

    } catch (error) {
      console.error('❌ 알림 통계 조회 실패:', error);
      return null;
    }
  }

  // === 유틸리티 메서드들 ===

  getInvestmentGrade(score) {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 40) return 'C';
    return 'D';
  }

  /**
   * 정기적인 알림 처리 (스케줄러에서 호출)
   */
  async runPeriodicTasks() {
    try {
      console.log('🔄 알림 서비스 정기 작업 시작...');

      // 대기 중인 알림 처리
      await this.processPendingNotifications();
      
      // 실패한 알림 재처리
      await this.retryFailedNotifications();
      
      // 오래된 알림 정리 (매일 1회)
      const now = new Date();
      if (now.getHours() === 2) { // 새벽 2시에 실행
        await this.cleanupOldNotifications();
      }

      console.log('✅ 알림 서비스 정기 작업 완료');

    } catch (error) {
      console.error('❌ 알림 서비스 정기 작업 중 오류:', error);
    }
  }
}

module.exports = NotificationService;