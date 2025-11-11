// Jest 전역 설정

// 환경변수 설정 (테스트용)
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 테스트 시 로그 최소화
process.env.PG_HOST = 'localhost';
process.env.PG_DATABASE = 'test_db';
process.env.PG_USER = 'test_user';
process.env.PG_PASSWORD = 'test_password';
process.env.PG_PORT = '5432';
process.env.JWT_SECRET = 'test-secret-key';

// 콘솔 출력 억제 (선택적)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// 전역 타임아웃 설정
jest.setTimeout(10000);

// 테스트 전역 변수
global.testUtils = {
  // 테스트용 유틸리티 함수들
  generateMockProperty: () => ({
    id: 1,
    case_number: '2024타경12345',
    item_number: '1',
    address: '부산광역시 해운대구 우동',
    property_type: '아파트',
    appraisal_value: 500000000,
    minimum_sale_price: 400000000,
    auction_date: new Date('2024-12-31'),
    current_status: 'active'
  }),

  generateMockAnalysis: () => ({
    id: 1,
    property_id: 1,
    investment_score: 85,
    profitability_score: 88,
    risk_score: 82,
    liquidity_score: 85,
    investment_grade: 'A',
    roi_1year: 15.5,
    risk_level: 'LOW'
  })
};

// 테스트 후 정리
afterAll(() => {
  // 데이터베이스 연결 종료 등
});
