const logger = require('../utils/logger');

/**
 * HTTP 요청 로깅 미들웨어
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // 응답 완료 시 로그 기록
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // 상태 코드에 따라 로그 레벨 결정
    if (res.statusCode >= 500) {
      logger.error('Server Error', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    } else if (res.statusCode >= 400) {
      logger.warn('Client Error', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      });
    } else {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`
      });
    }
  });

  next();
};

module.exports = requestLogger;
