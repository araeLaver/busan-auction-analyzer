const AIInvestmentAnalyzer = require('../../src/analyzer/AIInvestmentAnalyzer');
const pool = require('../../config/database');

// Mock database pool
jest.mock('../../config/database', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    connect: jest.fn(() => mPool),
    query: jest.fn(),
    release: jest.fn(),
  };
});

describe('AIInvestmentAnalyzer', () => {
  let analyzer;
  let mockClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock client for pool.connect()
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }), // 기본적으로 빈 배열 반환
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    
    // 생성자 호출 시 trainPredictionModel이 실행되어 쿼리가 한 번 발생함
    analyzer = new AIInvestmentAnalyzer();
  });

  describe('estimateMarketPrice', () => {
    it('should estimate price based on similar sold properties', async () => {
      // Mock property data
      const property = {
        address: '부산광역시 해운대구 우동 1234',
        property_type: '아파트',
        appraisal_value: 1000000000, // 10억
        minimum_sale_price: 800000000 // 8억
      };

      // Mock DB response for similar properties
      // 생성자 호출 이후의 쿼리에 대한 응답 설정
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { appraisal_value: 500000000, minimum_sale_price: 450000000 }, // 90%
          { appraisal_value: 800000000, minimum_sale_price: 760000000 }  // 95%
        ]
      });

      // Expected calculation: (0.9 + 0.95) / 2 = 0.925 (92.5%)
      // Estimated price: 10억 * 0.925 = 9억 2500만
      const expectedPrice = 925000000;

      const result = await analyzer.estimateMarketPrice(property);

      // 생성자에서 1번, estimateMarketPrice에서 1번 -> 총 2번 호출됨
      expect(mockClient.query).toHaveBeenCalledTimes(2); 
      expect(result).toBe(expectedPrice);
    });

    it('should use default rate if no similar properties found', async () => {
      const property = {
        address: '부산광역시 시골구 시골동',
        property_type: '아파트',
        appraisal_value: 100000000,
        minimum_sale_price: 80000000
      };

      // Mock empty DB response
      mockClient.query.mockResolvedValue({ rows: [] });

      // Default rate for Apartment is 0.9
      const expectedPrice = 90000000; // 1억 * 0.9

      const result = await analyzer.estimateMarketPrice(property);

      expect(result).toBe(expectedPrice);
    });
  });

  describe('trainPredictionModel', () => {
    it('should train model with sold data from DB', async () => {
      // Mock sold data
      // Case 1: 0 failures -> 95% rate
      // Case 2: 1 failure -> 80% rate
      mockClient.query.mockResolvedValue({
        rows: [
          { appraisal_value: '1000000000', failure_count: 0, minimum_sale_price: '950000000' },
          { appraisal_value: '500000000', failure_count: 1, minimum_sale_price: '400000000' }
        ]
      });

      await analyzer.trainPredictionModel();

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(analyzer.regressionModel).toBeDefined();
    });
  });
});
