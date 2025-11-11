const express = require('express');
const router = express.Router();
const WatchlistService = require('../services/WatchlistService');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const watchlistService = new WatchlistService();

/**
 * 관심목록 API 라우트
 * 모든 라우트는 인증 필요
 */

/**
 * GET /api/watchlist
 * 사용자 관심목록 조회
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page, limit, sortBy, order } = req.query;

  const result = await watchlistService.getUserWatchlist(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy: sortBy || 'created_at',
    order: order || 'DESC'
  });

  res.json({
    success: true,
    ...result
  });
}));

/**
 * POST /api/watchlist/:propertyId
 * 관심목록에 물건 추가
 */
router.post('/:propertyId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const propertyId = parseInt(req.params.propertyId);
  const alertSettings = req.body;

  const watchlistItem = await watchlistService.addToWatchlist(
    userId,
    propertyId,
    alertSettings
  );

  logger.info('Property added to watchlist via API', {
    userId,
    propertyId,
    watchlistId: watchlistItem.id
  });

  res.status(201).json({
    success: true,
    message: 'Property added to watchlist',
    data: watchlistItem
  });
}));

/**
 * DELETE /api/watchlist/:propertyId
 * 관심목록에서 물건 제거
 */
router.delete('/:propertyId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const propertyId = parseInt(req.params.propertyId);

  await watchlistService.removeFromWatchlist(userId, propertyId);

  res.json({
    success: true,
    message: 'Property removed from watchlist'
  });
}));

/**
 * PUT /api/watchlist/:propertyId/alerts
 * 알림 설정 업데이트
 */
router.put('/:propertyId/alerts', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const propertyId = parseInt(req.params.propertyId);
  const settings = req.body;

  const updated = await watchlistService.updateAlertSettings(
    userId,
    propertyId,
    settings
  );

  res.json({
    success: true,
    message: 'Alert settings updated',
    data: updated
  });
}));

/**
 * GET /api/watchlist/:propertyId/check
 * 물건이 관심목록에 있는지 확인
 */
router.get('/:propertyId/check', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const propertyId = parseInt(req.params.propertyId);

  const isInWatchlist = await watchlistService.isInWatchlist(userId, propertyId);

  res.json({
    success: true,
    inWatchlist: isInWatchlist
  });
}));

module.exports = router;
