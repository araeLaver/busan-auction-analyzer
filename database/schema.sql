-- 서울경매 분석 서비스 데이터베이스 스키마
-- 생성일: 2025-08-08
-- 데이터베이스: PostgreSQL (Supabase)

-- 1. 법원 정보 테이블
CREATE TABLE IF NOT EXISTS courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- 서울중앙지방법원, 서울동부지방법원 등
    code VARCHAR(10) UNIQUE,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 물건 테이블 (메인)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    
    -- 기본 식별 정보
    case_number VARCHAR(50) NOT NULL,           -- 사건번호 (예: 2024타경12345)
    item_number VARCHAR(10) NOT NULL,           -- 물건번호 (예: 1, 2)
    court_id INTEGER REFERENCES courts(id),
    
    -- 물건 기본 정보
    address TEXT NOT NULL,                      -- 소재지 (전체 주소)
    property_type VARCHAR(50),                  -- 아파트, 단독주택, 상가, 토지, 오피스텔 등
    building_name VARCHAR(200),                 -- 건물명/아파트명
    
    -- 면적 정보
    land_area DECIMAL(10,2),                   -- 토지면적 (㎡)
    building_area DECIMAL(10,2),               -- 건물면적 (㎡)
    exclusive_area DECIMAL(10,2),              -- 전용면적 (㎡)
    
    -- 가격 정보
    appraisal_value BIGINT,                    -- 감정가액 (원)
    minimum_sale_price BIGINT,                 -- 최저매각가격 (원)
    bid_deposit BIGINT,                        -- 입찰보증금 (원)
    
    -- 입찰 정보
    auction_date TIMESTAMP,                    -- 매각기일
    auction_time TIME,                         -- 매각시간
    failure_count INTEGER DEFAULT 0,           -- 유찰횟수
    current_status VARCHAR(20) DEFAULT 'active', -- active, sold, cancelled, failed
    
    -- 추가 정보
    tenant_status VARCHAR(20),                 -- 임차인 현황 (있음/없음)
    special_notes TEXT,                        -- 특이사항
    building_year INTEGER,                     -- 건축년도
    floor_info VARCHAR(50),                    -- 층수 정보
    
    -- 스크래핑 메타데이터
    source_site VARCHAR(50) NOT NULL,          -- 데이터 출처 (courtauction, ggauction 등)
    source_url TEXT,                           -- 원본 URL
    last_scraped_at TIMESTAMP WITH TIME ZONE,  -- 마지막 스크래핑 시간
    
    -- 시스템 필드
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 인덱스를 위한 제약조건
    UNIQUE(case_number, item_number, source_site)
);

-- 3. 물건 이미지 테이블
CREATE TABLE IF NOT EXISTS property_images (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(20), -- exterior, interior, document, map 등
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 분석 결과 테이블
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    
    -- 수익률 분석
    discount_rate DECIMAL(5,2),                -- 할인율 (감정가 대비 %)
    estimated_market_price BIGINT,             -- 추정 시세
    market_comparison_rate DECIMAL(5,2),       -- 시세 대비 비율
    
    -- 투자 점수
    investment_score INTEGER,                  -- 종합 투자 점수 (0-100)
    profitability_score INTEGER,               -- 수익성 점수
    risk_score INTEGER,                        -- 위험도 점수
    liquidity_score INTEGER,                   -- 유동성 점수
    
    -- 지역 분석
    area_average_price BIGINT,                 -- 지역 평균가
    area_transaction_count INTEGER,            -- 지역 거래량
    
    -- 예측 정보
    success_probability DECIMAL(5,2),          -- 낙찰 예상 확률
    estimated_final_price BIGINT,              -- 예상 낙찰가
    
    -- 분석 메타데이터
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analysis_version VARCHAR(10) DEFAULT '1.0',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 지역 정보 테이블
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    sido VARCHAR(20) NOT NULL,                 -- 시도 (부산광역시)
    sigungu VARCHAR(30) NOT NULL,              -- 시군구 (해운대구)
    dong VARCHAR(50),                          -- 동 (우동)
    
    -- 지역 통계
    average_price_per_sqm BIGINT,              -- 평균 단가 (원/㎡)
    total_auction_count INTEGER DEFAULT 0,     -- 총 경매 건수
    success_rate DECIMAL(5,2),                 -- 낙찰 성공률
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(sido, sigungu, dong)
);

-- 6. 일일 리포트 테이블
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    
    -- 전체 통계
    total_properties INTEGER DEFAULT 0,        -- 전체 물건 수
    new_properties INTEGER DEFAULT 0,          -- 신규 물건 수
    sold_properties INTEGER DEFAULT 0,         -- 낙찰 물건 수
    failed_properties INTEGER DEFAULT 0,       -- 유찰 물건 수
    
    -- 가격 통계
    average_discount_rate DECIMAL(5,2),        -- 평균 할인율
    total_appraisal_value BIGINT,              -- 총 감정가액
    total_minimum_sale_price BIGINT,           -- 총 최저매각가액
    
    -- 지역별 TOP 5
    popular_regions JSONB,                     -- 인기 지역 정보
    high_value_properties JSONB,               -- 고가 물건 정보
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 스크래핑 로그 테이블
CREATE TABLE IF NOT EXISTS scraping_logs (
    id SERIAL PRIMARY KEY,
    source_site VARCHAR(50) NOT NULL,
    scraping_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 결과 통계
    total_found INTEGER DEFAULT 0,             -- 발견한 총 물건 수
    new_items INTEGER DEFAULT 0,               -- 신규 아이템 수
    updated_items INTEGER DEFAULT 0,           -- 업데이트된 아이템 수
    error_count INTEGER DEFAULT 0,             -- 에러 발생 수
    
    -- 상태 및 메시지
    status VARCHAR(20) DEFAULT 'running',      -- running, completed, failed
    error_message TEXT,
    execution_time INTEGER,                    -- 실행 시간 (초)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 사용자 관심 목록 테이블 (향후 기능)
CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),                      -- 사용자 ID (향후 인증 시스템 연동)
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    
    -- 알림 설정
    price_alert BOOLEAN DEFAULT FALSE,         -- 가격 변동 알림
    status_alert BOOLEAN DEFAULT FALSE,        -- 상태 변경 알림
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_properties_case_number ON properties(case_number);
CREATE INDEX IF NOT EXISTS idx_properties_address ON properties USING gin(to_tsvector('korean', address));
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

-- 트리거 함수: updated_at 자동 업데이트
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

-- 초기 데이터 삽입
INSERT INTO courts (name, code, address) VALUES 
('부산지방법원', 'BUSAN', '부산광역시 연제구 중앙대로 1000'),
('부산지방법원동부지원', 'BUSAN_EAST', '부산광역시 해운대구 센텀중앙로 55'),
('부산지방법원서부지원', 'BUSAN_WEST', '부산광역시 사상구 학감대로 242')
ON CONFLICT (name) DO NOTHING;

-- 뷰 생성: 종합 물건 정보 뷰
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
    ROUND((p.appraisal_value - p.minimum_sale_price) * 100.0 / p.appraisal_value, 2) as discount_rate,
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