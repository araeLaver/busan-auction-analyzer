const pool = require('../../config/database');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, DatabaseError } = require('../utils/errors');

/**
 * 관심목록 서비스
 *
 * 사용자별 관심 물건 관리 및 알림 설정
 */
class WatchlistService {
  constructor() {
    this.tableName = 'analyzer.watchlists';
  }

  /**
   * 관심목록에 물건 추가
   */
  async addToWatchlist(userId, propertyId, alertSettings = {}) {
    try {
      logger.info('Adding property to watchlist', { userId, propertyId });

      // 물건 존재 확인
      const propertyCheck = await pool.query(
        'SELECT id FROM analyzer.properties WHERE id = $1',
        [propertyId]
      );

      if (propertyCheck.rows.length === 0) {
        throw new NotFoundError('Property', propertyId);
      }

      // 이미 추가되었는지 확인
      const existCheck = await pool.query(
        `SELECT id FROM ${this.tableName} WHERE user_id = $1 AND property_id = $2`,
        [userId, propertyId]
      );

      if (existCheck.rows.length > 0) {
        throw new ValidationError('Property already in watchlist');
      }

      // 관심목록 추가
      const result = await pool.query(
        `INSERT INTO ${this.tableName}
         (user_id, property_id, price_alert, status_alert, score_alert, auction_reminder,
          alert_price_change_percent, alert_score_threshold)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          propertyId,
          alertSettings.priceAlert || false,
          alertSettings.statusAlert || false,
          alertSettings.scoreAlert || false,
          alertSettings.auctionReminder !== false, // 기본값 true
          alertSettings.priceChangePercent || 5.0,
          alertSettings.scoreThreshold || 70
        ]
      );

      logger.info('Property added to watchlist', {
        userId,
        propertyId,
        watchlistId: result.rows[0].id
      });

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to add to watchlist', {
        userId,
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 관심목록에서 제거
   */
  async removeFromWatchlist(userId, propertyId) {
    try {
      const result = await pool.query(
        `DELETE FROM ${this.tableName}
         WHERE user_id = $1 AND property_id = $2
         RETURNING id`,
        [userId, propertyId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Watchlist item');
      }

      logger.info('Property removed from watchlist', { userId, propertyId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to remove from watchlist', {
        userId,
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 사용자 관심목록 조회
   */
  async getUserWatchlist(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        order = 'DESC'
      } = options;

      const offset = (page - 1) * limit;

      const query = `
        SELECT
          w.*,
          p.case_number,
          p.address,
          p.property_type,
          p.building_name,
          p.appraisal_value,
          p.minimum_sale_price,
          p.auction_date,
          p.current_status,
          ar.investment_score,
          ar.investment_grade,
          ar.roi_1year,
          ar.risk_level
        FROM ${this.tableName} w
        JOIN analyzer.properties p ON w.property_id = p.id
        LEFT JOIN (
          SELECT DISTINCT ON (property_id)
            property_id, investment_score, investment_grade, roi_1year, risk_level
          FROM analyzer.analysis_results
          ORDER BY property_id, analysis_date DESC
        ) ar ON p.id = ar.property_id
        WHERE w.user_id = $1
        ORDER BY ${sortBy} ${order}
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // 총 개수 조회
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM ${this.tableName} WHERE user_id = $1`,
        [userId]
      );

      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].count),
          totalPages: Math.ceil(countResult.rows[0].count / limit)
        }
      };

    } catch (error) {
      logger.error('Failed to get watchlist', {
        userId,
        error: error.message
      });
      throw new DatabaseError('Failed to retrieve watchlist', error);
    }
  }

  /**
   * 알림 설정 업데이트
   */
  async updateAlertSettings(userId, propertyId, settings) {
    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (settings.priceAlert !== undefined) {
        updates.push(`price_alert = $${paramCount++}`);
        values.push(settings.priceAlert);
      }
      if (settings.statusAlert !== undefined) {
        updates.push(`status_alert = $${paramCount++}`);
        values.push(settings.statusAlert);
      }
      if (settings.scoreAlert !== undefined) {
        updates.push(`score_alert = $${paramCount++}`);
        values.push(settings.scoreAlert);
      }
      if (settings.auctionReminder !== undefined) {
        updates.push(`auction_reminder = $${paramCount++}`);
        values.push(settings.auctionReminder);
      }
      if (settings.priceChangePercent !== undefined) {
        updates.push(`alert_price_change_percent = $${paramCount++}`);
        values.push(settings.priceChangePercent);
      }
      if (settings.scoreThreshold !== undefined) {
        updates.push(`alert_score_threshold = $${paramCount++}`);
        values.push(settings.scoreThreshold);
      }

      if (updates.length === 0) {
        throw new ValidationError('No settings to update');
      }

      values.push(userId, propertyId);

      const query = `
        UPDATE ${this.tableName}
        SET ${updates.join(', ')}
        WHERE user_id = $${paramCount++} AND property_id = $${paramCount++}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Watchlist item');
      }

      logger.info('Alert settings updated', { userId, propertyId });

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update alert settings', {
        userId,
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 특정 물건이 관심목록에 있는지 확인
   */
  async isInWatchlist(userId, propertyId) {
    try {
      const result = await pool.query(
        `SELECT id FROM ${this.tableName} WHERE user_id = $1 AND property_id = $2`,
        [userId, propertyId]
      );

      return result.rows.length > 0;

    } catch (error) {
      logger.error('Failed to check watchlist', {
        userId,
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 알림 대상 조회 (가격 변동)
   */
  async getPropertiesForPriceAlert() {
    try {
      const query = `
        SELECT DISTINCT ON (w.property_id)
          w.user_id,
          w.property_id,
          w.alert_price_change_percent,
          p.minimum_sale_price,
          p.address
        FROM ${this.tableName} w
        JOIN analyzer.properties p ON w.property_id = p.id
        WHERE w.price_alert = true
        AND p.current_status = 'active'
      `;

      const result = await pool.query(query);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get price alert properties', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 알림 대상 조회 (입찰일 임박)
   */
  async getPropertiesForAuctionReminder() {
    try {
      const query = `
        SELECT
          w.user_id,
          w.property_id,
          p.case_number,
          p.address,
          p.auction_date
        FROM ${this.tableName} w
        JOIN analyzer.properties p ON w.property_id = p.id
        WHERE w.auction_reminder = true
        AND p.current_status = 'active'
        AND p.auction_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      `;

      const result = await pool.query(query);
      return result.rows;

    } catch (error) {
      logger.error('Failed to get auction reminder properties', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = WatchlistService;
