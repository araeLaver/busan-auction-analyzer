const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 로그 디렉토리 경로
const LOG_DIR = path.join(__dirname, '../../logs');

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console 출력 포맷 (개발 환경용)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // 메타데이터가 있으면 추가
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  })
);

// Daily Rotate File Transport 설정
const createRotateTransport = (filename, level) => {
  return new DailyRotateFile({
    filename: path.join(LOG_DIR, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: level,
    format: logFormat
  });
};

// Logger 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'busan-auction-analyzer' },
  transports: [
    // 에러 로그 (error만)
    createRotateTransport('error', 'error'),

    // 결합 로그 (모든 레벨)
    createRotateTransport('combined', 'info'),

    // 디버그 로그 (개발 환경)
    ...(process.env.NODE_ENV !== 'production' ? [
      createRotateTransport('debug', 'debug')
    ] : [])
  ],

  // 예외 처리
  exceptionHandlers: [
    createRotateTransport('exceptions', 'error')
  ],

  // Promise rejection 처리
  rejectionHandlers: [
    createRotateTransport('rejections', 'error')
  ]
});

// 개발 환경에서는 Console에도 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 프로덕션 환경에서도 에러는 콘솔에 출력
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    level: 'error',
    format: consoleFormat
  }));
}

// 헬퍼 함수들
logger.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logScraping = (site, stats) => {
  logger.info('Scraping Complete', {
    site,
    found: stats.total_found,
    new: stats.new_items,
    updated: stats.updated_items,
    errors: stats.error_count
  });
};

logger.logAnalysis = (propertyId, score, duration) => {
  logger.info('Analysis Complete', {
    propertyId,
    investmentScore: score,
    duration: `${duration}ms`
  });
};

logger.logCache = (action, key, hit = null) => {
  logger.debug('Cache Operation', {
    action,
    key,
    ...(hit !== null && { hit })
  });
};

module.exports = logger;
