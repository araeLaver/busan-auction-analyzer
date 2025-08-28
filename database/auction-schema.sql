-- 부산 경매 AI 분석 시스템 전용 스키마
-- 생성일: ${new Date().toISOString()}

-- 경매 서비스 전용 스키마 생성
CREATE SCHEMA IF NOT EXISTS auction_service;

-- 사용자 권한 설정 (필요시)
-- GRANT USAGE ON SCHEMA auction_service TO unble;
-- GRANT CREATE ON SCHEMA auction_service TO unble;

-- 경매 법원 정보 테이블
CREATE TABLE IF NOT EXISTS auction_service.courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20),
    region VARCHAR(50),
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 부산 경매 물건 정보 테이블 (메인 테이블)
CREATE TABLE IF NOT EXISTS auction_service.properties (
    id SERIAL PRIMARY KEY,
    case_number VARCHAR(50) NOT NULL UNIQUE,
    item_number VARCHAR(10) DEFAULT '1',
    court_id INTEGER REFERENCES auction_service.courts(id),
    court_name VARCHAR(100),
    
    -- 물건 기본 정보
    property_type VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    building_name VARCHAR(200),
    building_year VARCHAR(4),
    floor_info VARCHAR(50),
    area DECIMAL(10,2),
    land_area DECIMAL(10,2),
    building_area DECIMAL(10,2),
    
    -- 가격 정보
    appraisal_value BIGINT NOT NULL,
    minimum_sale_price BIGINT NOT NULL,
    bid_deposit BIGINT,
    discount_rate DECIMAL(5,2),
    
    -- 경매 정보
    auction_date DATE NOT NULL,
    auction_time TIME,
    failure_count INTEGER DEFAULT 0,
    current_status VARCHAR(20) DEFAULT 'active',
    
    -- 임차 정보
    tenant_status VARCHAR(50),
    tenant_info TEXT,
    
    -- 메타 정보
    source_url TEXT,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 인덱스를 위한 제약조건
    CONSTRAINT chk_property_type CHECK (property_type IN ('아파트', '오피스텔', '상가', '다세대주택', '단독주택', '토지', '기타')),
    CONSTRAINT chk_current_status CHECK (current_status IN ('active', 'sold', 'cancelled', 'failed'))
);

-- AI 투자 분석 결과 테이블
CREATE TABLE IF NOT EXISTS auction_service.analysis_results (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES auction_service.properties(id) ON DELETE CASCADE,
    
    -- 투자 점수
    investment_score INTEGER CHECK (investment_score >= 0 AND investment_score <= 100),
    investment_grade VARCHAR(2) CHECK (investment_grade IN ('S', 'A', 'B', 'C', 'D')),
    
    -- 세부 점수
    profitability_score INTEGER CHECK (profitability_score >= 0 AND profitability_score <= 100),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    liquidity_score INTEGER CHECK (liquidity_score >= 0 AND liquidity_score <= 100),
    location_score INTEGER CHECK (location_score >= 0 AND location_score <= 100),
    market_trend_score INTEGER CHECK (market_trend_score >= 0 AND market_trend_score <= 100),
    legal_risk_score INTEGER CHECK (legal_risk_score >= 0 AND legal_risk_score <= 100),
    
    -- 수익률 예측
    roi_1year DECIMAL(5,2),
    roi_3year DECIMAL(5,2),
    roi_5year DECIMAL(5,2),
    
    -- 낙찰 예측
    success_probability INTEGER CHECK (success_probability >= 0 AND success_probability <= 100),
    estimated_final_price BIGINT,
    estimated_competition_level VARCHAR(10) CHECK (estimated_competition_level IN ('LOW', 'MEDIUM', 'HIGH')),
    
    -- 분석 메타정보
    analysis_version VARCHAR(10) DEFAULT '1.0',
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(property_id, analysis_version)
);

-- 물건 이미지 테이블
CREATE TABLE IF NOT EXISTS auction_service.property_images (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES auction_service.properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(20) DEFAULT 'photo', -- photo, map, document
    display_order INTEGER DEFAULT 0,
    description TEXT,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 스크래핑 로그 테이블
CREATE TABLE IF NOT EXISTS auction_service.scraping_logs (
    id SERIAL PRIMARY KEY,
    source_site VARCHAR(100),
    scraping_type VARCHAR(50), -- daily, manual, scheduled
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
    properties_found INTEGER DEFAULT 0,
    properties_saved INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

-- 사용자 관심목록 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS auction_service.user_watchlist (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100), -- 세션 ID 또는 사용자 ID
    property_id INTEGER REFERENCES auction_service.properties(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, property_id)
);

-- 시장 트렌드 데이터 테이블
CREATE TABLE IF NOT EXISTS auction_service.market_trends (
    id SERIAL PRIMARY KEY,
    region VARCHAR(50) NOT NULL,
    property_type VARCHAR(50) NOT NULL,
    year_month VARCHAR(7) NOT NULL, -- YYYY-MM 형식
    
    -- 통계 데이터
    total_listings INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    avg_discount_rate DECIMAL(5,2),
    avg_price_per_sqm BIGINT,
    success_rate DECIMAL(5,2),
    
    -- 추세 데이터
    price_trend_mom DECIMAL(5,2), -- Month over Month 변화율
    volume_trend_mom DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(region, property_type, year_month)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_properties_auction_date ON auction_service.properties(auction_date);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON auction_service.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_address ON auction_service.properties USING gin(to_tsvector('english', address));
CREATE INDEX IF NOT EXISTS idx_properties_status ON auction_service.properties(current_status);
CREATE INDEX IF NOT EXISTS idx_properties_price_range ON auction_service.properties(minimum_sale_price);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON auction_service.properties(created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_investment_score ON auction_service.analysis_results(investment_score);
CREATE INDEX IF NOT EXISTS idx_analysis_property_id ON auction_service.analysis_results(property_id);

CREATE INDEX IF NOT EXISTS idx_images_property_id ON auction_service.property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_logs_start_time ON auction_service.scraping_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_trends_region_type ON auction_service.market_trends(region, property_type);

-- 기본 법원 데이터 삽입
INSERT INTO auction_service.courts (name, code, region, address) VALUES
    ('부산지방법원', '340000', '부산', '부산광역시 연제구 연산9동 1085-1'),
    ('부산지방법원 동부지원', '340001', '부산', '부산광역시 해운대구 재송1동 1200'),
    ('부산지방법원 서부지원', '340002', '부산', '부산광역시 사하구 하단2동 422-6')
ON CONFLICT (name) DO NOTHING;

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION auction_service.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_properties_updated_at 
    BEFORE UPDATE ON auction_service.properties 
    FOR EACH ROW EXECUTE FUNCTION auction_service.update_updated_at_column();

CREATE TRIGGER update_analysis_results_updated_at 
    BEFORE UPDATE ON auction_service.analysis_results 
    FOR EACH ROW EXECUTE FUNCTION auction_service.update_updated_at_column();

CREATE TRIGGER update_market_trends_updated_at 
    BEFORE UPDATE ON auction_service.market_trends 
    FOR EACH ROW EXECUTE FUNCTION auction_service.update_updated_at_column();

-- 뷰 생성: 물건 상세 정보 (분석 결과 포함)
CREATE OR REPLACE VIEW auction_service.properties_detailed AS
SELECT 
    p.*,
    c.name as court_full_name,
    c.region as court_region,
    ar.investment_score,
    ar.investment_grade,
    ar.profitability_score,
    ar.risk_score,
    ar.liquidity_score,
    ar.location_score,
    ar.roi_1year,
    ar.roi_3year,
    ar.success_probability,
    ar.estimated_final_price,
    ar.analyzed_at,
    ROUND((p.appraisal_value - p.minimum_sale_price)::numeric * 100.0 / p.appraisal_value, 2) as calculated_discount_rate
FROM auction_service.properties p
LEFT JOIN auction_service.courts c ON p.court_id = c.id
LEFT JOIN auction_service.analysis_results ar ON p.id = ar.property_id;

-- 뷰 생성: 대시보드 통계
CREATE OR REPLACE VIEW auction_service.dashboard_stats AS
SELECT 
    COUNT(*) FILTER (WHERE p.current_status = 'active') as total_active_properties,
    COUNT(*) FILTER (WHERE DATE(p.created_at) = CURRENT_DATE) as new_today,
    ROUND(AVG(ar.investment_score), 1) as avg_investment_score,
    COUNT(*) FILTER (WHERE ar.investment_score >= 85) as excellent_properties,
    COUNT(*) FILTER (WHERE ar.investment_grade = 'S') as s_grade_properties,
    COUNT(*) FILTER (WHERE ar.investment_score >= 70) as good_properties,
    COUNT(*) FILTER (WHERE DATE(p.auction_date) = CURRENT_DATE) as auctions_today,
    COUNT(*) FILTER (WHERE p.auction_date BETWEEN NOW() AND NOW() + INTERVAL '7 days') as auctions_this_week
FROM auction_service.properties p
LEFT JOIN auction_service.analysis_results ar ON p.id = ar.property_id
WHERE p.current_status = 'active';

COMMENT ON SCHEMA auction_service IS '부산 경매 AI 분석 시스템 전용 스키마';
COMMENT ON TABLE auction_service.properties IS '경매 물건 정보 메인 테이블';
COMMENT ON TABLE auction_service.analysis_results IS 'AI 투자 분석 결과';
COMMENT ON VIEW auction_service.properties_detailed IS '물건 상세정보 (분석결과 포함)';
COMMENT ON VIEW auction_service.dashboard_stats IS '대시보드 통계 뷰';

-- 스키마 생성 완료 로그
SELECT 'auction_service 스키마 및 테이블 생성 완료: ' || CURRENT_TIMESTAMP as schema_setup_completed;