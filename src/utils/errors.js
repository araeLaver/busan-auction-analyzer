/**
 * 커스텀 에러 클래스들
 *
 * 에러 타입별로 구조화하여 일관된 에러 처리 가능
 */

/**
 * 기본 애플리케이션 에러
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    };
  }
}

/**
 * 인증 에러 (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

/**
 * 권한 에러 (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 403);
  }
}

/**
 * 리소스를 찾을 수 없음 (404)
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404);
    this.resource = resource;
    this.resourceId = id;
  }
}

/**
 * 잘못된 요청 (400)
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400);
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors
    };
  }
}

/**
 * 데이터베이스 에러 (500)
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500);
    this.originalError = originalError;
  }
}

/**
 * 외부 서비스 에러 (502)
 */
class ExternalServiceError extends AppError {
  constructor(service = 'External service', message = 'Service unavailable') {
    super(`${service}: ${message}`, 502);
    this.service = service;
  }
}

/**
 * 스크래핑 에러
 */
class ScrapingError extends AppError {
  constructor(site, message = 'Scraping failed', details = {}) {
    super(`Scraping ${site}: ${message}`, 500);
    this.site = site;
    this.details = details;
  }
}

/**
 * 분석 에러
 */
class AnalysisError extends AppError {
  constructor(propertyId, message = 'Analysis failed', details = {}) {
    super(`Analysis for property ${propertyId}: ${message}`, 500);
    this.propertyId = propertyId;
    this.details = details;
  }
}

/**
 * 캐시 에러
 */
class CacheError extends AppError {
  constructor(message = 'Cache operation failed', key = null) {
    super(message, 500);
    this.cacheKey = key;
  }
}

/**
 * Rate Limit 에러 (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

/**
 * 설정 에러
 */
class ConfigurationError extends AppError {
  constructor(message = 'Configuration error', missingConfig = null) {
    super(message, 500, false); // Non-operational error
    this.missingConfig = missingConfig;
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ExternalServiceError,
  ScrapingError,
  AnalysisError,
  CacheError,
  RateLimitError,
  ConfigurationError
};
