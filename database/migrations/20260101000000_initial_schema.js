
exports.up = (pgm) => {
  pgm.sql(`
    -- analyzer 스키마 생성 및 설정
    CREATE SCHEMA IF NOT EXISTS analyzer;

    -- 부산경매 분석 서비스 데이터베이스 스키마 (고도화 버전)
    -- 생성일: 2025-08-25
    -- 데이터베이스: PostgreSQL (Supabase)
    -- 버전: 2.0 - AI 분석 및 성능 최적화 적용

    -- 1. 법원 정보 테이블
    CREATE TABLE IF NOT EXISTS analyzer.courts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE, -- 서울중앙지방법원, 서울동부지방법원 등
        code VARCHAR(10) UNIQUE,
        address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 2. 물건 테이블 (메인)
    CREATE TABLE IF NOT EXISTS analyzer.properties (
        id SERIAL PRIMARY KEY,
        
        -- 기본 식별 정보
        case_number VARCHAR(50) NOT NULL,           -- 사건번호 (예: 2024타경12345)
        item_number VARCHAR(10) NOT NULL,           -- 물건번호 (예: 1, 2)
        court_id INTEGER REFERENCES analyzer.courts(id),
        
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
    CREATE TABLE IF NOT EXISTS analyzer.property_images (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES analyzer.properties(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        image_type VARCHAR(20), -- exterior, interior, document, map 등
        description TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 4. AI 기반 분석 결과 테이블 (고도화)
    CREATE TABLE IF NOT EXISTS analyzer.analysis_results (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES analyzer.properties(id) ON DELETE CASCADE,
        
        -- 기본 수익률 분석
        discount_rate DECIMAL(5,2),                -- 할인율 (감정가 대비 %)
        estimated_market_price BIGINT,             -- 추정 시세
        market_comparison_rate DECIMAL(5,2),       -- 시세 대비 비율
        roi_1year DECIMAL(5,2),                    -- 1년 예상 ROI
        roi_3year DECIMAL(5,2),                    -- 3년 예상 ROI
        
        -- AI 기반 투자 점수 (0-100)
        investment_score INTEGER,                  -- 종합 투자 점수
        profitability_score INTEGER,               -- 수익성 점수 (40% 가중치)
        risk_score INTEGER,                        -- 위험도 점수 (30% 가중치)
        liquidity_score INTEGER,                   -- 유동성 점수 (30% 가중치)
        
        -- 세부 분석 점수
        location_score INTEGER,                    -- 입지 점수 (0-100)
        building_condition_score INTEGER,          -- 건물 상태 점수 (0-100)
        legal_risk_score INTEGER,                  -- 법적 위험도 점수 (0-100)
        market_trend_score INTEGER,                -- 시장 트렌드 점수 (0-100)
        
        -- 지역 및 시장 분석
        area_average_price BIGINT,                 -- 지역 평균가
        area_transaction_count INTEGER,            -- 지역 거래량
        area_price_trend DECIMAL(5,2),             -- 지역 가격 상승률 (%)
        comparable_properties_count INTEGER,        -- 비교 가능 물건 수
        
        -- AI 예측 정보
        success_probability DECIMAL(5,2),          -- 낙찰 예상 확률
        estimated_final_price BIGINT,              -- 예상 낙찰가
        estimated_competition_level INTEGER,        -- 예상 경쟁 정도 (1-5)
        price_volatility_index DECIMAL(5,2),       -- 가격 변동성 지수
        
        -- 투자 추천 정보
        investment_grade CHAR(2),                  -- 투자 등급 (S, A, B, C, D)
        hold_period_months INTEGER,                -- 권장 보유 기간 (개월)
        risk_level VARCHAR(10),                    -- 위험 수준 (LOW, MEDIUM, HIGH)
        target_profit_rate DECIMAL(5,2),          -- 목표 수익률
        
        -- ML 모델 정보
        model_version VARCHAR(20) DEFAULT 'v1.0',  -- 분석 모델 버전
        model_confidence DECIMAL(5,2),             -- 모델 신뢰도
        analysis_features JSONB,                   -- 분석에 사용된 특성들
        
        -- 분석 메타데이터
        analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        analysis_duration_ms INTEGER,              -- 분석 소요 시간 (밀리초)
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- 제약조건
        CONSTRAINT investment_score_range CHECK (investment_score >= 0 AND investment_score <= 100),
        CONSTRAINT valid_investment_grade CHECK (investment_grade IN ('S', 'A', 'B', 'C', 'D'))
    );

    -- 5. 지역 정보 테이블
    CREATE TABLE IF NOT EXISTS analyzer.regions (
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
    CREATE TABLE IF NOT EXISTS analyzer.daily_reports (
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
    CREATE TABLE IF NOT EXISTS analyzer.scraping_logs (
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

    -- 8. 사용자 관심 목록 테이블 (고도화)
    CREATE TABLE IF NOT EXISTS analyzer.watchlists (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),                      -- 사용자 ID (향후 인증 시스템 연동)
        property_id INTEGER REFERENCES analyzer.properties(id) ON DELETE CASCADE,
        
        -- 알림 설정
        price_alert BOOLEAN DEFAULT FALSE,         -- 가격 변동 알림
        status_alert BOOLEAN DEFAULT FALSE,        -- 상태 변경 알림
        score_alert BOOLEAN DEFAULT FALSE,         -- 투자점수 변동 알림
        auction_reminder BOOLEAN DEFAULT TRUE,     -- 입찰일 알림
        
        -- 알림 조건
        alert_price_change_percent DECIMAL(5,2),   -- 가격 변동 알림 기준 (%)
        alert_score_threshold INTEGER,             -- 점수 알림 기준
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 9. 시장 트렌드 분석 테이블
    CREATE TABLE IF NOT EXISTS analyzer.market_trends (
        id SERIAL PRIMARY KEY,
        region_code VARCHAR(20),                   -- 지역 코드
        property_type VARCHAR(50),                 -- 물건 유형
        analysis_period VARCHAR(20),               -- 분석 기간 (1M, 3M, 6M, 1Y)
        
        -- 가격 트렌드
        average_price_trend DECIMAL(5,2),          -- 평균 가격 상승률
        median_price_trend DECIMAL(5,2),           -- 중간값 가격 상승률
        price_volatility DECIMAL(5,2),             -- 가격 변동성
        
        -- 거래량 트렌드
        transaction_volume INTEGER,                -- 거래량
        volume_growth_rate DECIMAL(5,2),           -- 거래량 증가율
        
        -- 성공률 트렌드
        success_rate DECIMAL(5,2),                 -- 낙찰 성공률
        average_failure_count DECIMAL(3,1),        -- 평균 유찰 횟수
        
        -- 경쟁도 분석
        average_bidders INTEGER,                   -- 평균 입찰자 수
        competition_intensity DECIMAL(5,2),        -- 경쟁 강도 지수
        
        analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 10. AI 모델 성능 추적 테이블
    CREATE TABLE IF NOT EXISTS analyzer.model_performance (
        id SERIAL PRIMARY KEY,
        model_name VARCHAR(50) NOT NULL,
        model_version VARCHAR(20) NOT NULL,
        
        -- 성능 지표
        accuracy DECIMAL(5,4),                     -- 정확도
        precision_score DECIMAL(5,4),              -- 정밀도
        recall_score DECIMAL(5,4),                 -- 재현율
        f1_score DECIMAL(5,4),                     -- F1 점수
        
        -- 예측 성능
        price_prediction_mae DECIMAL(10,2),        -- 가격 예측 평균 절대 오차
        score_prediction_mae DECIMAL(5,2),         -- 점수 예측 평균 절대 오차
        
        -- 비즈니스 성과
        user_satisfaction_rate DECIMAL(5,2),       -- 사용자 만족도
        prediction_hit_rate DECIMAL(5,2),          -- 예측 적중률
        
        -- 메타데이터
        training_data_size INTEGER,               -- 훈련 데이터 크기
        test_data_size INTEGER,                   -- 테스트 데이터 크기
        training_duration_minutes INTEGER,        -- 훈련 소요 시간
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 11. 실시간 알림 큐 테이블
    CREATE TABLE IF NOT EXISTS analyzer.notification_queue (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        notification_type VARCHAR(50),             -- PRICE_DROP, SCORE_CHANGE, AUCTION_REMINDER 등
        property_id INTEGER REFERENCES analyzer.properties(id),
        
        -- 알림 내용
        title VARCHAR(200),
        message TEXT,
        data JSONB,                                -- 추가 데이터 (JSON 형태)
        
        -- 전송 상태
        status VARCHAR(20) DEFAULT 'pending',      -- pending, sent, failed
        priority INTEGER DEFAULT 5,                -- 우선순위 (1-10)
        scheduled_at TIMESTAMP WITH TIME ZONE,     -- 예약 전송 시간
        sent_at TIMESTAMP WITH TIME ZONE,          -- 실제 전송 시간
        
        -- 에러 정보
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 성능 최적화 인덱스 생성
    -- Properties 테이블 인덱스
    CREATE INDEX IF NOT EXISTS idx_properties_case_number ON analyzer.properties(case_number);
    CREATE INDEX IF NOT EXISTS idx_properties_address ON analyzer.properties USING gin(to_tsvector('simple', address));
    CREATE INDEX IF NOT EXISTS idx_properties_auction_date ON analyzer.properties(auction_date);
    CREATE INDEX IF NOT EXISTS idx_properties_property_type ON analyzer.properties(property_type);
    CREATE INDEX IF NOT EXISTS idx_properties_current_status ON analyzer.properties(current_status);
    CREATE INDEX IF NOT EXISTS idx_properties_appraisal_value ON analyzer.properties(appraisal_value);
    CREATE INDEX IF NOT EXISTS idx_properties_minimum_sale_price ON analyzer.properties(minimum_sale_price);
    CREATE INDEX IF NOT EXISTS idx_properties_created_at ON analyzer.properties(created_at);
    CREATE INDEX IF NOT EXISTS idx_properties_failure_count ON analyzer.properties(failure_count);
    CREATE INDEX IF NOT EXISTS idx_properties_building_area ON analyzer.properties(building_area);

    -- 복합 인덱스 (검색 성능 향상)
    CREATE INDEX IF NOT EXISTS idx_properties_status_date ON analyzer.properties(current_status, auction_date);
    CREATE INDEX IF NOT EXISTS idx_properties_type_status ON analyzer.properties(property_type, current_status);
    CREATE INDEX IF NOT EXISTS idx_properties_price_range ON analyzer.properties(minimum_sale_price, appraisal_value);

    -- Analysis Results 인덱스
    CREATE INDEX IF NOT EXISTS idx_analysis_results_property_id ON analyzer.analysis_results(property_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_investment_score ON analyzer.analysis_results(investment_score);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_analysis_date ON analyzer.analysis_results(analysis_date);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_grade ON analyzer.analysis_results(investment_grade);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_roi ON analyzer.analysis_results(roi_1year);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_risk_level ON analyzer.analysis_results(risk_level);

    -- 복합 인덱스 (분석 결과 검색 최적화)
    CREATE INDEX IF NOT EXISTS idx_analysis_score_grade ON analyzer.analysis_results(investment_score, investment_grade);
    CREATE INDEX IF NOT EXISTS idx_analysis_roi_risk ON analyzer.analysis_results(roi_1year, risk_level);

    -- Market Trends 인덱스
    CREATE INDEX IF NOT EXISTS idx_market_trends_region ON analyzer.market_trends(region_code);
    CREATE INDEX IF NOT EXISTS idx_market_trends_property_type ON analyzer.market_trends(property_type);
    CREATE INDEX IF NOT EXISTS idx_market_trends_period ON analyzer.market_trends(analysis_period);
    CREATE INDEX IF NOT EXISTS idx_market_trends_date ON analyzer.market_trends(analysis_date);

    -- Notification Queue 인덱스
    CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON analyzer.notification_queue(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON analyzer.notification_queue(status);
    CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON analyzer.notification_queue(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON analyzer.notification_queue(priority, status);

    -- Scraping Logs 인덱스
    CREATE INDEX IF NOT EXISTS idx_scraping_logs_source_site ON analyzer.scraping_logs(source_site);
    CREATE INDEX IF NOT EXISTS idx_scraping_logs_scraping_date ON analyzer.scraping_logs(scraping_date);
    CREATE INDEX IF NOT EXISTS idx_scraping_logs_status ON analyzer.scraping_logs(status);

    -- Watchlists 인덱스
    CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON analyzer.watchlists(user_id);
    CREATE INDEX IF NOT EXISTS idx_watchlists_property_id ON analyzer.watchlists(property_id);

    -- 트리거 함수: updated_at 자동 업데이트
    CREATE OR REPLACE FUNCTION analyzer.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- 트리거 적용
    CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON analyzer.properties 
        FOR EACH ROW EXECUTE FUNCTION analyzer.update_updated_at_column();

    CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON analyzer.analysis_results 
        FOR EACH ROW EXECUTE FUNCTION analyzer.update_updated_at_column();

    CREATE TRIGGER update_regions_updated_at BEFORE UPDATE ON analyzer.regions 
        FOR EACH ROW EXECUTE FUNCTION analyzer.update_updated_at_column();

    -- 초기 데이터 삽입
    INSERT INTO analyzer.courts (name, code, address) VALUES 
    ('부산지방법원', 'BUSAN', '부산광역시 연제구 중앙대로 1000'),
    ('부산지방법원동부지원', 'BUSAN_EAST', '부산광역시 해운대구 센텀중앙로 55'),
    ('부산지방법원서부지원', 'BUSAN_WEST', '부산광역시 사상구 학감대로 242')
    ON CONFLICT (name) DO NOTHING;

    -- 뷰 생성: 종합 물건 정보 뷰 (고도화)
    CREATE OR REPLACE VIEW analyzer.property_summary AS
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
        p.building_area,
        p.exclusive_area,
        
        -- AI 분석 결과
        ar.investment_score,
        ar.investment_grade,
        ar.success_probability,
        ar.estimated_final_price,
        ar.roi_1year,
        ar.roi_3year,
        ar.risk_level,
        ar.location_score,
        ar.market_trend_score,
        ar.model_confidence,
        
        -- 계산된 필드
        ROUND(p.minimum_sale_price / p.building_area, 0) as price_per_sqm,
        CASE 
            WHEN ar.investment_score >= 80 THEN 'EXCELLENT'
            WHEN ar.investment_score >= 60 THEN 'GOOD'
            WHEN ar.investment_score >= 40 THEN 'FAIR'
            ELSE 'POOR'
        END as investment_rating,
        
        -- 메타데이터
        p.created_at,
        ar.analysis_date,
        p.last_scraped_at
    FROM analyzer.properties p
    LEFT JOIN analyzer.courts c ON p.court_id = c.id
    LEFT JOIN (
        SELECT DISTINCT ON (property_id) 
            property_id,
            investment_score,
            investment_grade,
            success_probability,
            estimated_final_price,
            roi_1year,
            roi_3year,
            risk_level,
            location_score,
            market_trend_score,
            model_confidence,
            analysis_date
        FROM analyzer.analysis_results 
        ORDER BY property_id, analysis_date DESC
    ) ar ON p.id = ar.property_id
    WHERE p.current_status = 'active'
    ORDER BY p.auction_date ASC;

    -- 뷰: 투자 추천 물건 (고점수 물건)
    CREATE OR REPLACE VIEW analyzer.investment_recommendations AS
    SELECT 
        ps.*,
        r.sigungu,
        r.dong,
        mt.price_volatility,
        mt.success_rate as region_success_rate
    FROM analyzer.property_summary ps
    LEFT JOIN analyzer.regions r ON ps.address LIKE CONCAT('%', r.sigungu, '%')
    LEFT JOIN analyzer.market_trends mt ON r.sigungu = mt.region_code 
        AND ps.property_type = mt.property_type 
        AND mt.analysis_period = '3M'
    WHERE ps.investment_score >= 70
        AND ps.auction_date > NOW()
    ORDER BY ps.investment_score DESC, ps.auction_date ASC;

    -- 뷰: 일일 통계 대시보드
    CREATE OR REPLACE VIEW analyzer.daily_dashboard AS
    SELECT 
        COUNT(*) as total_active_properties,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as new_today,
        COUNT(CASE WHEN investment_score >= 80 THEN 1 END) as excellent_properties,
        COUNT(CASE WHEN investment_score >= 60 THEN 1 END) as good_properties,
        ROUND(AVG(investment_score), 1) as avg_investment_score,
        ROUND(AVG(discount_rate), 2) as avg_discount_rate,
        ROUND(AVG(roi_1year), 2) as avg_1year_roi,
        COUNT(CASE WHEN auction_date::date = CURRENT_DATE THEN 1 END) as auctions_today,
        COUNT(CASE WHEN auction_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' THEN 1 END) as auctions_this_week
    FROM analyzer.property_summary;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP SCHEMA IF EXISTS analyzer CASCADE;
  `);
};
