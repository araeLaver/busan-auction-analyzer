const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 글로벌 에러 핸들러 미들웨어
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // AppError가 아닌 경우 변환
  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new AppError(message, statusCode, false);
  }

  // 에러 로깅
  if (error.isOperational) {
    logger.warn('Operational Error', {
      error: error.name,
      message: error.message,
      statusCode: error.statusCode,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: req.user?.userId
    });
  } else {
    logger.error('Non-Operational Error', {
      error: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: req.user?.userId
    });
  }

  // 프로덕션 환경에서는 에러 상세 정보 숨기기
  const response = {
    error: error.name,
    message: error.message,
    statusCode: error.statusCode
  };

  // 개발 환경에서는 스택 트레이스 포함
  if (process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
    response.details = error.toJSON ? error.toJSON() : {};
  }

  res.status(error.statusCode).json(response);
};

/**
 * 404 Not Found 핸들러
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.url} not found`, 404);
  next(error);
};

/**
 * Async 함수 래퍼 (에러 자동 catch)
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 처리되지 않은 Promise Rejection 핸들러
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason,
      promise: promise
    });

    // 프로덕션에서는 graceful shutdown
    if (process.env.NODE_ENV === 'production') {
      console.error('Unhandled Rejection. Shutting down...');
      process.exit(1);
    }
  });
};

/**
 * 처리되지 않은 Exception 핸들러
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });

    console.error('Uncaught Exception. Shutting down...');
    process.exit(1);
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException
};
