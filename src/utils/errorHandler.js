/**
 * 중앙 집중식 에러 핸들링 유틸리티
 */

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError) {
    super(message, 500, true);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, true);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource}를 찾을 수 없습니다`, 404, true);
    this.name = 'NotFoundError';
  }
}

/**
 * Express 에러 핸들러 미들웨어
 */
const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // 에러 로깅
  console.error('❌ 에러 발생:', {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });

  // 운영 에러가 아닌 경우 (프로그래밍 에러)
  if (!err.isOperational) {
    console.error('🚨 심각한 에러 - 서버 재시작 필요:', err);
  }

  // 응답 전송
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: err.message || '서버 오류가 발생했습니다',
      ...(isDevelopment && {
        stack: err.stack,
        originalError: err.originalError
      })
    },
    timestamp: err.timestamp || new Date().toISOString()
  };

  res.status(statusCode).json(response);
};

/**
 * 비동기 함수 래퍼 - try-catch 자동 처리
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 데이터베이스 에러 파싱
 */
const parseDBError = (error) => {
  // PostgreSQL 에러 코드
  const errorMap = {
    '23505': '중복된 데이터가 존재합니다',
    '23503': '참조 무결성 제약 조건 위반',
    '23502': '필수 값이 누락되었습니다',
    '42P01': '테이블이 존재하지 않습니다',
    '42703': '컬럼이 존재하지 않습니다',
    '08006': '데이터베이스 연결이 끊어졌습니다'
  };

  if (error.code && errorMap[error.code]) {
    return new DatabaseError(errorMap[error.code], error);
  }

  return new DatabaseError('데이터베이스 오류가 발생했습니다', error);
};

/**
 * 404 핸들러
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`경로 ${req.originalUrl}`);
  next(error);
};

module.exports = {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  errorHandler,
  asyncHandler,
  parseDBError,
  notFoundHandler
};
