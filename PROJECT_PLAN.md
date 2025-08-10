# 부산동경매 물건 분석 서비스 프로젝트 계획서

## 프로젝트 개요
부산동경매 사이트의 경매 물건을 일일 단위로 자동 수집하여 분석하고, 투자자들에게 유용한 정보를 제공하는 웹 서비스

## 주요 기능

### 1. 데이터 수집 (Scraping)
- **일일 자동 스크래핑**: 매일 정해진 시간에 부산동경매 사이트 크롤링
- **물건 정보 수집**: 
  - 물건번호, 사건번호
  - 소재지 (주소)
  - 물건종류 (아파트, 빌라, 토지 등)
  - 감정가, 최저매각가
  - 입찰일시
  - 유찰횟수
  - 면적 정보

### 2. 데이터 분석
- **수익률 분석**: 감정가 대비 최저매각가 비율
- **지역별 통계**: 구/동별 물건 분포 및 평균 가격
- **유찰 패턴 분석**: 유찰 횟수별 가격 하락률
- **시세 비교**: 주변 시세 대비 매각가 분석
- **투자 점수**: 자체 알고리즘을 통한 투자 매력도 점수

### 3. 웹 서비스
- **물건 목록**: 필터링 및 정렬 기능
- **상세 분석 페이지**: 개별 물건의 상세 분석 정보
- **대시보드**: 일일 신규 물건, 인기 물건, 주요 지표
- **알림 기능**: 관심 조건 설정 시 알림
- **검색 기능**: 지역, 가격대, 물건종류별 검색

## 기술 스택

### Backend
- **언어**: Node.js (Express.js)
- **스크래핑**: Puppeteer / Playwright
- **데이터베이스**: PostgreSQL 또는 MySQL
- **ORM**: Sequelize 또는 Prisma
- **스케줄러**: node-cron
- **캐싱**: Redis (선택사항)

### Frontend
- **프레임워크**: React 또는 Vue.js
- **스타일링**: Tailwind CSS
- **차트**: Chart.js 또는 D3.js
- **상태관리**: Redux 또는 Vuex

### DevOps
- **배포**: Docker
- **CI/CD**: GitHub Actions
- **모니터링**: PM2

## 프로젝트 구조
```
busan-auction-analyzer/
├── src/
│   ├── api/           # REST API 엔드포인트
│   ├── scraper/       # 웹 스크래핑 모듈
│   ├── analyzer/      # 데이터 분석 로직
│   ├── database/      # DB 모델 및 연결
│   ├── scheduler/     # 자동화 스케줄러
│   └── utils/         # 유틸리티 함수
├── public/            # 정적 파일
│   ├── css/
│   ├── js/
│   └── images/
├── config/            # 설정 파일
├── tests/             # 테스트 코드
├── docs/              # 문서
└── package.json
```

## 개발 단계

### Phase 1: 기초 설정 (1주)
1. 프로젝트 환경 설정
2. 데이터베이스 스키마 설계
3. 기본 API 구조 생성

### Phase 2: 스크래핑 개발 (2주)
1. 부산동경매 사이트 분석
2. Puppeteer를 이용한 스크래핑 모듈 개발
3. 데이터 정제 및 저장 로직

### Phase 3: 분석 엔진 (2주)
1. 분석 알고리즘 개발
2. 투자 점수 산출 로직
3. 통계 데이터 생성

### Phase 4: 웹 인터페이스 (3주)
1. UI/UX 디자인
2. 프론트엔드 개발
3. API 연동

### Phase 5: 자동화 및 최적화 (1주)
1. 스케줄러 설정
2. 성능 최적화
3. 에러 처리 강화

### Phase 6: 테스트 및 배포 (1주)
1. 통합 테스트
2. 배포 환경 구성
3. 모니터링 설정

## 데이터베이스 스키마 (주요 테이블)

### properties (물건)
- id (PK)
- case_number (사건번호)
- property_number (물건번호)
- address (소재지)
- property_type (물건종류)
- appraisal_value (감정가)
- minimum_sale_price (최저매각가)
- auction_date (입찰일시)
- failure_count (유찰횟수)
- area (면적)
- created_at
- updated_at

### analysis_results (분석결과)
- id (PK)
- property_id (FK)
- profit_rate (수익률)
- investment_score (투자점수)
- market_comparison (시세비교)
- risk_level (위험도)
- created_at

### daily_reports (일일리포트)
- id (PK)
- report_date
- total_properties (전체물건수)
- new_properties (신규물건수)
- average_discount_rate (평균할인율)
- popular_areas (인기지역)
- created_at

## 주요 고려사항

### 법적 준수
- robots.txt 확인 및 준수
- 과도한 요청 방지 (rate limiting)
- 저작권 및 이용약관 검토

### 성능 최적화
- 데이터베이스 인덱싱
- 캐싱 전략
- 이미지 최적화

### 보안
- API 인증 (JWT)
- SQL Injection 방지
- XSS 방지
- 환경변수 관리

### 확장성
- 마이크로서비스 아키텍처 고려
- 메시지 큐 도입 검토
- 클라우드 배포 준비

## 예상 리소스
- 서버: AWS EC2 t3.medium 또는 유사
- 데이터베이스: RDS 또는 자체 호스팅
- 스토리지: 이미지 저장용 S3
- 도메인 및 SSL 인증서

## 성공 지표
- 일일 활성 사용자 (DAU)
- 데이터 정확도 95% 이상
- 페이지 로딩 속도 3초 이내
- 시스템 가동률 99.9%