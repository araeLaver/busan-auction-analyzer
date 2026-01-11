const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it-in-production';

/**
 * JWT 인증 미들웨어
 */
const authenticateToken = (req, res, next) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      // 개발 환경이거나 테스트용으로 토큰 없이 접근 시 temp_user 할당 (선택 사항)
      // return next(); // Uncomment for loose security in dev
      
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        url: req.url
      });
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // 토큰 검증
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn('Authentication failed: Invalid token', {
          ip: req.ip,
          url: req.url,
          error: err.message
        });
        return res.status(403).json({
          error: 'Invalid token',
          message: 'Token verification failed'
        });
      }

      // 검증된 사용자 정보를 req에 저장 (AuthService.generateToken과 일치)
      req.user = user; // { id, email, role }
      logger.debug('User authenticated', {
        userId: user.id,
        role: user.role
      });
      next();
    });

  } catch (error) {
    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication process failed'
    });
  }
};

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // 토큰 없으면 temp_user 할당
    req.user = { id: 'temp_user', role: 'guest' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    } else {
      req.user = { id: 'temp_user', role: 'guest' };
    }
    next();
  });
};

/**
 * 관리자 권한 확인 미들웨어
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Admin access requires authentication'
    });
  }

  if (req.user.role !== 'admin') {
    logger.warn('Admin access denied: Insufficient permissions', {
      userId: req.user.id,
      role: req.user.role,
      ip: req.ip,
      url: req.url
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required'
    });
  }

  next();
};

/**
 * 역할 기반 접근 제어 미들웨어
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Access denied: Insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * API Key 인증 미들웨어 (외부 서비스용)
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required'
    });
  }

  const validApiKeys = (process.env.API_KEYS || '').split(',');

  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({
      error: 'Invalid API key'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireRole,
  authenticateApiKey
};
