module.exports = {
  // 테스트 환경
  testEnvironment: 'node',

  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app-optimized.js',
    '!src/**/index.js',
    '!src/scraper/**/*.js', // 스크래핑은 복잡한 외부 의존성으로 제외
  ],

  // 커버리지 디렉토리
  coverageDirectory: 'coverage',

  // 커버리지 리포트 형식
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 최소 커버리지 threshold
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // 테스트 파일 패턴
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // 테스트 제외 패턴
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],

  // 모듈 경로 매핑
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 셋업 파일
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 타임아웃
  testTimeout: 10000,

  // Verbose 출력
  verbose: true,

  // 에러 발생 시 자세한 정보 출력
  errorOnDeprecated: true
};
