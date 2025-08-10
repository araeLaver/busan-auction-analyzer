# 수동 데이터베이스 설정 가이드

Node.js를 통한 자동 연결에 실패했으므로, Supabase 웹 인터페이스에서 직접 SQL을 실행해서 스키마를 생성해주세요.

## 1. Supabase 대시보드 접속
1. https://supabase.com 접속
2. 프로젝트 대시보드로 이동
3. 왼쪽 메뉴에서 "SQL Editor" 선택

## 2. 스키마 생성
아래의 SQL 코드를 복사해서 SQL Editor에 붙여넣고 실행하세요.

### 실행 순서:
1. 먼저 기본 테이블들을 생성
2. 인덱스와 트리거 생성
3. 초기 데이터 삽입
4. 뷰 생성

---

## 📋 SQL 실행 코드

```sql
-- ========================================
-- 1단계: 기본 테이블 생성
-- ========================================

-- 법원 정보 테이블
CREATE TABLE IF NOT EXISTS courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) UNIQUE,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 물건 테이블 (메인)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    
    -- 기본 식별 정보
    case_number VARCHAR(50) NOT NULL,
    item_number VARCHAR(10) NOT NULL,
    court_id INTEGER REFERENCES courts(id),
    
    -- 물건 기본 정보
    address TEXT NOT NULL,
    property_type VARCHAR(50),
    building_name VARCHAR(200),
    
    -- 면적 정보
    land_area DECIMAL(10,2),
    building_area DECIMAL(10,2),
    exclusive_area DECIMAL(10,2),
    
    -- 가격 정보
    appraisal_value BIGINT,
    minimum_sale_price BIGINT,
    bid_deposit BIGINT,
    
    -- 입찰 정보
    auction_date TIMESTAMP,
    auction_time TIME,
    failure_count INTEGER DEFAULT 0,
    current_status VARCHAR(20) DEFAULT 'active',
    
    -- 추가 정보
    tenant_status VARCHAR(20),
    special_notes TEXT,
    building_year INTEGER,
    floor_info VARCHAR(50),
    
    -- 스크래핑 메타데이터
    source_site VARCHAR(50) NOT NULL,
    source_url TEXT,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(case_number, item_number, source_site)
);

-- 물건 이미지 테이블
CREATE TABLE IF NOT EXISTS property_images (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(20),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 분석 결과 테이블
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    
    -- 수익률 분석
    discount_rate DECIMAL(5,2),
    estimated_market_price BIGINT,
    market_comparison_rate DECIMAL(5,2),
    
    -- 투자 점수
    investment_score INTEGER,
    profitability_score INTEGER,
    risk_score INTEGER,
    liquidity_score INTEGER,
    
    -- 지역 분석
    area_average_price BIGINT,
    area_transaction_count INTEGER,
    
    -- 예측 정보
    success_probability DECIMAL(5,2),
    estimated_final_price BIGINT,
    
    -- 분석 메타데이터
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analysis_version VARCHAR(10) DEFAULT '1.0',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 지역 정보 테이블
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    sido VARCHAR(20) NOT NULL,
    sigungu VARCHAR(30) NOT NULL,
    dong VARCHAR(50),
    
    -- 지역 통계
    average_price_per_sqm BIGINT,
    total_auction_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(sido, sigungu, dong)
);

-- 일일 리포트 테이블
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    
    -- 전체 통계
    total_properties INTEGER DEFAULT 0,
    new_properties INTEGER DEFAULT 0,
    sold_properties INTEGER DEFAULT 0,
    failed_properties INTEGER DEFAULT 0,
    
    -- 가격 통계
    average_discount_rate DECIMAL(5,2),
    total_appraisal_value BIGINT,
    total_minimum_sale_price BIGINT,
    
    -- 지역별 TOP 5
    popular_regions JSONB,
    high_value_properties JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 스크래핑 로그 테이블
CREATE TABLE IF NOT EXISTS scraping_logs (
    id SERIAL PRIMARY KEY,
    source_site VARCHAR(50) NOT NULL,
    scraping_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 결과 통계
    total_found INTEGER DEFAULT 0,
    new_items INTEGER DEFAULT 0,
    updated_items INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- 상태 및 메시지
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT,
    execution_time INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 사용자 관심 목록 테이블
CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    
    -- 알림 설정
    price_alert BOOLEAN DEFAULT FALSE,
    status_alert BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

```sql
-- ========================================
-- 2단계: 인덱스 생성
-- ========================================

CREATE INDEX IF NOT EXISTS idx_properties_case_number ON properties(case_number);
CREATE INDEX IF NOT EXISTS idx_properties_auction_date ON properties(auction_date);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_current_status ON properties(current_status);
CREATE INDEX IF NOT EXISTS idx_properties_appraisal_value ON properties(appraisal_value);
CREATE INDEX IF NOT EXISTS idx_properties_minimum_sale_price ON properties(minimum_sale_price);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_results_property_id ON analysis_results(property_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_investment_score ON analysis_results(investment_score);
CREATE INDEX IF NOT EXISTS idx_analysis_results_analysis_date ON analysis_results(analysis_date);

CREATE INDEX IF NOT EXISTS idx_scraping_logs_source_site ON scraping_logs(source_site);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_scraping_date ON scraping_logs(scraping_date);
```

```sql
-- ========================================
-- 3단계: 트리거 함수 및 트리거 생성
-- ========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON analysis_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON regions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

```sql
-- ========================================
-- 4단계: 초기 데이터 삽입
-- ========================================

INSERT INTO courts (name, code, address) VALUES 
('부산지방법원', 'BUSAN', '부산광역시 연제구 중앙대로 1000'),
('부산지방법원동부지원', 'BUSAN_EAST', '부산광역시 해운대구 센텀중앙로 55'),
('부산지방법원서부지원', 'BUSAN_WEST', '부산광역시 사상구 학감대로 242')
ON CONFLICT (name) DO NOTHING;
```

```sql
-- ========================================
-- 5단계: 뷰 생성
-- ========================================

-- 종합 물건 정보 뷰
CREATE OR REPLACE VIEW property_summary AS
SELECT 
    p.id,
    p.case_number,
    p.item_number,
    c.name as court_name,
    p.address,
    p.property_type,
    p.building_name,
    p.appraisal_value,
    p.minimum_sale_price,
    ROUND((p.appraisal_value - p.minimum_sale_price) * 100.0 / NULLIF(p.appraisal_value, 0), 2) as discount_rate,
    p.auction_date,
    p.failure_count,
    p.current_status,
    ar.investment_score,
    ar.success_probability,
    p.created_at
FROM properties p
LEFT JOIN courts c ON p.court_id = c.id
LEFT JOIN analysis_results ar ON p.id = ar.property_id
WHERE p.current_status = 'active'
ORDER BY p.auction_date ASC;
```

## 3. 설치 확인
스키마가 정상적으로 생성되었는지 확인하려면 다음 쿼리를 실행하세요:

```sql
-- 생성된 테이블 목록 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 생성된 뷰 목록 확인
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 각 테이블의 행 수 확인 (초기에는 courts 테이블에만 3개 행이 있어야 함)
SELECT 
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;
```

## 4. 다음 단계
스키마 생성이 완료되면 다음과 같이 진행하세요:

1. ✅ 데이터베이스 스키마 설정 완료
2. 🔄 스크래핑 모듈 개발 시작
3. 📊 분석 로직 구현
4. 🌐 웹 인터페이스 개발
5. ⏰ 스케줄러 설정

완료되면 알려주세요!