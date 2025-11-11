const { getEnv, getEnvSummary } = require('../../src/utils/validateEnv');

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 환경변수 복사
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // 원래 환경변수 복원
    process.env = originalEnv;
  });

  describe('getEnv', () => {
    test('should return string value by default', () => {
      process.env.TEST_VAR = 'test-value';
      const value = getEnv('TEST_VAR');

      expect(value).toBe('test-value');
    });

    test('should return default value if not set', () => {
      const value = getEnv('NON_EXISTENT_VAR', 'default');

      expect(value).toBe('default');
    });

    test('should convert to number', () => {
      process.env.PORT = '3000';
      const value = getEnv('PORT', null, 'number');

      expect(value).toBe(3000);
      expect(typeof value).toBe('number');
    });

    test('should convert to boolean', () => {
      process.env.ENABLE_FEATURE = 'true';
      const value = getEnv('ENABLE_FEATURE', null, 'boolean');

      expect(value).toBe(true);

      process.env.ENABLE_FEATURE = 'false';
      const value2 = getEnv('ENABLE_FEATURE', null, 'boolean');

      expect(value2).toBe(false);
    });

    test('should convert to float', () => {
      process.env.RATE = '3.14';
      const value = getEnv('RATE', null, 'float');

      expect(value).toBe(3.14);
      expect(typeof value).toBe('number');
    });

    test('should parse JSON', () => {
      process.env.CONFIG = '{"key":"value","num":123}';
      const value = getEnv('CONFIG', null, 'json');

      expect(value).toEqual({ key: 'value', num: 123 });
    });

    test('should return default for invalid JSON', () => {
      process.env.BAD_JSON = 'not-valid-json';
      const value = getEnv('BAD_JSON', { default: true }, 'json');

      expect(value).toEqual({ default: true });
    });
  });

  describe('getEnvSummary', () => {
    test('should return environment summary', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3001';
      process.env.PG_HOST = 'localhost';
      process.env.PG_DATABASE = 'testdb';
      process.env.PG_PORT = '5432';

      const summary = getEnvSummary();

      expect(summary).toHaveProperty('nodeEnv');
      expect(summary).toHaveProperty('port');
      expect(summary).toHaveProperty('database');
      expect(summary).toHaveProperty('features');
      expect(summary).toHaveProperty('cache');
      expect(summary).toHaveProperty('rateLimit');
    });

    test('should include database config', () => {
      process.env.PG_HOST = 'db.example.com';
      process.env.PG_DATABASE = 'mydb';
      process.env.PG_PORT = '5432';

      const summary = getEnvSummary();

      expect(summary.database.host).toBe('db.example.com');
      expect(summary.database.database).toBe('mydb');
      expect(summary.database.port).toBe('5432');
    });

    test('should include cache TTL settings', () => {
      process.env.CACHE_TTL_SHORT = '30';
      process.env.CACHE_TTL_MEDIUM = '180';

      const summary = getEnvSummary();

      expect(summary.cache.shortTTL).toBe(30);
      expect(summary.cache.mediumTTL).toBe(180);
    });
  });
});
