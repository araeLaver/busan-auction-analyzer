const logger = require('./logger');
const { ConfigurationError } = require('./errors');

/**
 * 필수 환경변수 목록
 */
const REQUIRED_ENV_VARS = [
  'PG_HOST',
  'PG_DATABASE',
  'PG_USER',
  'PG_PASSWORD',
  'PG_PORT'
];

/**
 * 선택적 환경변수와 기본값
 */
const OPTIONAL_ENV_VARS = {
      PORT: '3000',  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  JWT_SECRET: 'your-secret-key-change-this-in-production',
  JWT_EXPIRES_IN: '24h',
  ENABLE_SCHEDULER: 'true',
  CACHE_TTL_SHORT: '60',
  CACHE_TTL_MEDIUM: '300',
  CACHE_TTL_LONG: '3600',
  CACHE_TTL_PERSISTENT: '86400',
  RATE_LIMIT_WINDOW: '900000',
  RATE_LIMIT_MAX: '1000'
};

/**
 * 환경변수 유효성 검증
 */
const validateEnv = () => {
  const missing = [];
  const warnings = [];

  logger.info('🔍 환경변수 검증 시작...');

  // 필수 환경변수 확인
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(errorMsg);
    throw new ConfigurationError(errorMsg, missing);
  }

  // 선택적 환경변수 기본값 설정
  for (const [key, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      warnings.push(`${key} not set, using default: ${defaultValue}`);
    }
  }

  // 프로덕션 환경 보안 검증
  if (process.env.NODE_ENV === 'production') {
    const securityWarnings = [];

    // JWT Secret 기본값 사용 경고
    if (process.env.JWT_SECRET === OPTIONAL_ENV_VARS.JWT_SECRET) {
      securityWarnings.push('JWT_SECRET is using default value - SECURITY RISK!');
    }

    // JWT Secret 길이 확인
    if (process.env.JWT_SECRET.length < 32) {
      securityWarnings.push('JWT_SECRET is too short (minimum 32 characters recommended)');
    }

    // 데이터베이스 SSL 확인
    if (process.env.PG_SSL !== 'true') {
      securityWarnings.push('Database SSL is not enabled - consider enabling for production');
    }

    if (securityWarnings.length > 0) {
      logger.warn('⚠️  Production Security Warnings:', {
        warnings: securityWarnings
      });
    }
  }

  // 경고 출력
  if (warnings.length > 0) {
    logger.warn('Environment variable warnings:', {
      warnings: warnings
    });
  }

  // 검증 성공
  logger.info('✅ 환경변수 검증 완료', {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    database: process.env.PG_DATABASE,
    host: process.env.PG_HOST
  });

  return true;
};

/**
 * 특정 환경변수 가져오기 (타입 변환 포함)
 */
const getEnv = (key, defaultValue = null, type = 'string') => {
  const value = process.env[key] || defaultValue;

  if (value === null) {
    return null;
  }

  switch (type) {
    case 'number':
      return parseInt(value, 10);
    case 'float':
      return parseFloat(value);
    case 'boolean':
      return value === 'true' || value === '1';
    case 'json':
      try {
        return JSON.parse(value);
      } catch (e) {
        logger.warn(`Failed to parse JSON for ${key}, returning default`);
        return defaultValue;
      }
    default:
      return value;
  }
};

/**
 * 환경변수 정보 요약
 */
const getEnvSummary = () => {
  return {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    database: {
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      port: process.env.PG_PORT
    },
    features: {
      scheduler: getEnv('ENABLE_SCHEDULER', 'true', 'boolean'),
      logLevel: process.env.LOG_LEVEL
    },
    cache: {
      shortTTL: getEnv('CACHE_TTL_SHORT', '60', 'number'),
      mediumTTL: getEnv('CACHE_TTL_MEDIUM', '300', 'number'),
      longTTL: getEnv('CACHE_TTL_LONG', '3600', 'number'),
      persistentTTL: getEnv('CACHE_TTL_PERSISTENT', '86400', 'number')
    },
    rateLimit: {
      window: getEnv('RATE_LIMIT_WINDOW', '900000', 'number'),
      max: getEnv('RATE_LIMIT_MAX', '1000', 'number')
    }
  };
};

module.exports = {
  validateEnv,
  getEnv,
  getEnvSummary,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};
