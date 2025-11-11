const logger = require('../../src/utils/logger');

describe('Logger Utility', () => {
  beforeEach(() => {
    // 테스트 환경 설정
    process.env.NODE_ENV = 'test';
  });

  test('should have required log methods', () => {
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  test('should have helper methods', () => {
    expect(logger.logRequest).toBeDefined();
    expect(logger.logError).toBeDefined();
    expect(logger.logScraping).toBeDefined();
    expect(logger.logAnalysis).toBeDefined();
    expect(logger.logCache).toBeDefined();
  });

  test('logRequest should log with correct format', () => {
    const req = {
      method: 'GET',
      url: '/api/properties',
      ip: '127.0.0.1'
    };
    const res = {
      statusCode: 200
    };

    expect(() => {
      logger.logRequest(req, res, 150);
    }).not.toThrow();
  });

  test('logScraping should log scraping stats', () => {
    const stats = {
      total_found: 100,
      new_items: 20,
      updated_items: 15,
      error_count: 2
    };

    expect(() => {
      logger.logScraping('courtauction', stats);
    }).not.toThrow();
  });

  test('logAnalysis should log analysis results', () => {
    expect(() => {
      logger.logAnalysis(123, 85, 250);
    }).not.toThrow();
  });
});
