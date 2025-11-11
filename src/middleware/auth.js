const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Secret (환경변수에서 가져오기, 없으면 기본값 - 프로덕션에서는 반드시 환경변수 설정)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * JWT 토큰 생성
 */
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    {
      userId,
      role,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * JWT 인증 미들웨어
 */
const authenticateToken = (req, res, next) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
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

      // 검증된 사용자 정보를 req에 저장
      req.user = user;
      logger.debug('User authenticated', {
        userId: user.userId,
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
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
};

/**
 * 관리자 권한 확인 미들웨어
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    logger.warn('Admin access denied: No user authenticated', {
      ip: req.ip,
      url: req.url
    });
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Admin access requires authentication'
    });
  }

  if (req.user.role !== 'admin') {
    logger.warn('Admin access denied: Insufficient permissions', {
      userId: req.user.userId,
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
        userId: req.user.userId,
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

  // API 키 검증 (환경변수 또는 DB에서 확인)
  const validApiKeys = (process.env.API_KEYS || '').split(',');

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key', {
      ip: req.ip,
      url: req.url
    });
    return res.status(403).json({
      error: 'Invalid API key'
    });
  }

  next();
};

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireRole,
  authenticateApiKey,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
