-- ============================================
-- 데이터베이스 코멘트 추가 스크립트
-- 부산경매 AI 분석 시스템
-- ============================================

SET search_path TO analyzer, public;

-- ============================================
-- 1. COURTS 테이블 코멘트
-- ============================================
COMMENT ON TABLE courts IS '법원 정보를 저장하는 테이블 - 경매를 진행하는 각 법원의 기본 정보';

COMMENT ON COLUMN courts.id IS '법원 고유 식별자 (Primary Key)';
COMMENT ON COLUMN courts.name IS '법원명 (예: 부산지방법원, 부산지방법원동부지원) - UNIQUE 제약조건';
COMMENT ON COLUMN courts.code IS '법원 코드 (예: BUSAN, BUSAN_EAST) - 시스템 내부에서 사용';
COMMENT ON COLUMN courts.address IS '법원 주소 - 실제 법원 위치';
COMMENT ON COLUMN courts.created_at IS '레코드 생성 시각';
COMMENT ON COLUMN courts.updated_at IS '레코드 최종 수정 시각 (트리거로 자동 업데이트)';

-- ============================================
-- 2. PROPERTIES 테이블 코멘트
-- ============================================
COMMENT ON TABLE properties IS '경매 물건 정보를 저장하는 메인 테이블 - 대법원 경매 사이트에서 스크래핑한 모든 물건 정보';

-- 기본 식별 정보
COMMENT ON COLUMN properties.id IS '물건 고유 식별자 (Primary Key, Auto Increment)';
COMMENT ON COLUMN properties.case_number IS '사건번호 (예: 2024타경12345) - 법원에서 부여한 경매 사건 번호';
COMMENT ON COLUMN properties.item_number IS '물건번호 (예: 1, 2) - 하나의 사건에 여러 물건이 있을 수 있음';
COMMENT ON COLUMN properties.court_id IS '법원 ID (courts 테이블 외래키) - 이 물건을 관할하는 법원';

-- 물건 기본 정보
COMMENT ON COLUMN properties.address IS '소재지 전체 주소 (예: 부산광역시 해운대구 우동 123-45) - 전문 검색 인덱스 적용';
COMMENT ON COLUMN properties.property_type IS '물건 유형 (아파트, 단독주택, 상가, 토지, 오피스텔 등) - 필터링에 사용';
COMMENT ON COLUMN properties.building_name IS '건물명 또는 아파트명 (예: 우동 센텀파크)';

-- 면적 정보
COMMENT ON COLUMN properties.land_area IS '토지면적 (단위: ㎡) - 대지 전체 면적';
COMMENT ON COLUMN properties.building_area IS '건물면적 (단위: ㎡) - 건축물 연면적';
COMMENT ON COLUMN properties.exclusive_area IS '전용면적 (단위: ㎡) - 실제 사용 가능한 면적 (아파트의 경우)';

-- 가격 정보
COMMENT ON COLUMN properties.appraisal_value IS '감정가액 (단위: 원) - 감정평가사가 평가한 물건의 가치';
COMMENT ON COLUMN properties.minimum_sale_price IS '최저매각가격 (단위: 원) - 실제 입찰 가능한 최저 금액, 유찰시 감소';
COMMENT ON COLUMN properties.bid_deposit IS '입찰보증금 (단위: 원) - 입찰 참여시 필요한 보증금 (보통 최저가의 10%)';

-- 입찰 정보
COMMENT ON COLUMN properties.auction_date IS '매각기일 (날짜+시간) - 실제 경매가 진행되는 일시';
COMMENT ON COLUMN properties.auction_time IS '매각시간 - 경매 시작 시간';
COMMENT ON COLUMN properties.failure_count IS '유찰횟수 - 낙찰되지 않고 유찰된 횟수 (많을수록 가격 하락)';
COMMENT ON COLUMN properties.current_status IS '현재 상태 (active: 진행중, sold: 낙찰, cancelled: 취소, failed: 유찰)';

-- 추가 정보
COMMENT ON COLUMN properties.tenant_status IS '임차인 현황 (있음/없음) - 임차인이 있으면 인수 조건 확인 필요';
COMMENT ON COLUMN properties.special_notes IS '특이사항 - 권리분석, 하자정보, 기타 중요 공지사항';
COMMENT ON COLUMN properties.building_year IS '건축년도 (예: 2015) - 건물 노후도 판단';
COMMENT ON COLUMN properties.floor_info IS '층수 정보 (예: 15층/25층 중) - 해당 물건의 층과 전체 층수';

-- 스크래핑 메타데이터
COMMENT ON COLUMN properties.source_site IS '데이터 출처 사이트 (courtauction, ggauction 등)';
COMMENT ON COLUMN properties.source_url IS '원본 페이지 URL - 상세 정보 확인용';
COMMENT ON COLUMN properties.last_scraped_at IS '마지막 스크래핑 시각 - 데이터 신선도 체크';

-- 시스템 필드
COMMENT ON COLUMN properties.created_at IS '레코드 생성 시각 - 최초 데이터 수집 시점';
COMMENT ON COLUMN properties.updated_at IS '레코드 최종 수정 시각 - 트리거로 자동 업데이트';

-- ============================================
-- 3. PROPERTY_IMAGES 테이블 코멘트
-- ============================================
COMMENT ON TABLE property_images IS '물건 이미지 정보 테이블 - 각 물건의 사진 및 도면 저장';

COMMENT ON COLUMN property_images.id IS '이미지 고유 식별자 (Primary Key)';
COMMENT ON COLUMN property_images.property_id IS '물건 ID (properties 테이블 외래키, CASCADE 삭제)';
COMMENT ON COLUMN property_images.image_url IS '이미지 URL - 실제 이미지 파일 경로 또는 외부 URL';
COMMENT ON COLUMN property_images.image_type IS '이미지 유형 (exterior: 외관, interior: 내부, document: 서류, map: 지도)';
COMMENT ON COLUMN property_images.description IS '이미지 설명 - 이미지에 대한 추가 설명';
COMMENT ON COLUMN property_images.display_order IS '표시 순서 - 프론트엔드에서 이미지 정렬 순서 (0부터 시작)';
COMMENT ON COLUMN property_images.created_at IS '이미지 등록 시각';

-- ============================================
-- 4. ANALYSIS_RESULTS 테이블 코멘트
-- ============================================
COMMENT ON TABLE analysis_results IS 'AI 기반 투자 분석 결과 테이블 - 각 물건에 대한 상세한 투자 분석 데이터';

COMMENT ON COLUMN analysis_results.id IS '분석 결과 고유 식별자 (Primary Key)';
COMMENT ON COLUMN analysis_results.property_id IS '물건 ID (properties 테이블 외래키, CASCADE 삭제)';

-- 기본 수익률 분석
COMMENT ON COLUMN analysis_results.discount_rate IS '할인율 (단위: %, 0-100) - 감정가 대비 최저매각가 할인 정도';
COMMENT ON COLUMN analysis_results.estimated_market_price IS '추정 시세 (단위: 원) - AI가 예측한 실제 시장 거래가';
COMMENT ON COLUMN analysis_results.market_comparison_rate IS '시세 대비 비율 (단위: %) - 최저가가 시세의 몇 %인지';
COMMENT ON COLUMN analysis_results.roi_1year IS '1년 예상 ROI (단위: %) - 1년 보유시 예상 투자 수익률';
COMMENT ON COLUMN analysis_results.roi_3year IS '3년 예상 ROI (단위: %) - 3년 보유시 예상 투자 수익률';

-- AI 기반 투자 점수 (0-100)
COMMENT ON COLUMN analysis_results.investment_score IS '종합 투자 점수 (0-100) - 수익성, 위험도, 유동성을 종합한 최종 점수';
COMMENT ON COLUMN analysis_results.profitability_score IS '수익성 점수 (0-100) - 가격 할인율, ROI 등 수익성 평가 (가중치 40%)';
COMMENT ON COLUMN analysis_results.risk_score IS '위험도 점수 (0-100) - 법적 위험, 유찰 횟수 등 위험 평가 (가중치 30%, 높을수록 안전)';
COMMENT ON COLUMN analysis_results.liquidity_score IS '유동성 점수 (0-100) - 입지, 거래량 등 환금성 평가 (가중치 30%)';

-- 세부 분석 점수
COMMENT ON COLUMN analysis_results.location_score IS '입지 점수 (0-100) - 지하철, 학교, 상권 등 위치 우수성 평가';
COMMENT ON COLUMN analysis_results.building_condition_score IS '건물 상태 점수 (0-100) - 건축년도, 시설 등 건물 품질 평가';
COMMENT ON COLUMN analysis_results.legal_risk_score IS '법적 위험도 점수 (0-100) - 임차인, 근저당 등 법적 리스크 평가 (높을수록 안전)';
COMMENT ON COLUMN analysis_results.market_trend_score IS '시장 트렌드 점수 (0-100) - 해당 지역의 부동산 시장 동향 평가';

-- 지역 및 시장 분석
COMMENT ON COLUMN analysis_results.area_average_price IS '지역 평균가 (단위: 원/㎡) - 동일 지역의 평균 거래 단가';
COMMENT ON COLUMN analysis_results.area_transaction_count IS '지역 거래량 - 최근 3개월간 동일 지역 거래 건수';
COMMENT ON COLUMN analysis_results.area_price_trend IS '지역 가격 상승률 (단위: %) - 최근 1년간 지역 평균가 변화율';
COMMENT ON COLUMN analysis_results.comparable_properties_count IS '비교 가능 물건 수 - 유사한 조건의 물건 개수 (많을수록 신뢰도 높음)';

-- AI 예측 정보
COMMENT ON COLUMN analysis_results.success_probability IS '낙찰 예상 확률 (단위: %, 0-100) - AI가 예측한 낙찰 가능성';
COMMENT ON COLUMN analysis_results.estimated_final_price IS '예상 낙찰가 (단위: 원) - AI가 예측한 실제 낙찰될 가격';
COMMENT ON COLUMN analysis_results.estimated_competition_level IS '예상 경쟁 정도 (1-5) - 입찰 경쟁 강도 예측 (5가 최고)';
COMMENT ON COLUMN analysis_results.price_volatility_index IS '가격 변동성 지수 (0-100) - 가격 변화 폭 예측 (높을수록 변동성 큼)';

-- 투자 추천 정보
COMMENT ON COLUMN analysis_results.investment_grade IS '투자 등급 (S, A, B, C, D) - S가 최우수, D가 최하위';
COMMENT ON COLUMN analysis_results.hold_period_months IS '권장 보유 기간 (단위: 개월) - 최적 수익을 위한 보유 기간';
COMMENT ON COLUMN analysis_results.risk_level IS '위험 수준 (LOW, MEDIUM, HIGH) - 투자 위험도 분류';
COMMENT ON COLUMN analysis_results.target_profit_rate IS '목표 수익률 (단위: %) - 이 물건의 합리적 기대 수익률';

-- ML 모델 정보
COMMENT ON COLUMN analysis_results.model_version IS '분석 모델 버전 (예: v1.0, v2.1) - AI 모델 버전 추적';
COMMENT ON COLUMN analysis_results.model_confidence IS '모델 신뢰도 (단위: %, 0-100) - AI 예측의 확신 정도';
COMMENT ON COLUMN analysis_results.analysis_features IS '분석 특성 (JSONB) - 분석에 사용된 모든 데이터 포인트 저장';

-- 분석 메타데이터
COMMENT ON COLUMN analysis_results.analysis_date IS '분석 수행 일시 - 언제 AI 분석이 실행되었는지';
COMMENT ON COLUMN analysis_results.analysis_duration_ms IS '분석 소요 시간 (단위: 밀리초) - 성능 모니터링용';
COMMENT ON COLUMN analysis_results.created_at IS '레코드 생성 시각';
COMMENT ON COLUMN analysis_results.updated_at IS '레코드 최종 수정 시각 (트리거로 자동 업데이트)';

-- ============================================
-- 5. REGIONS 테이블 코멘트
-- ============================================
COMMENT ON TABLE regions IS '지역 정보 및 통계 테이블 - 시도/시군구/동 단위의 경매 통계';

COMMENT ON COLUMN regions.id IS '지역 고유 식별자 (Primary Key)';
COMMENT ON COLUMN regions.sido IS '시도명 (예: 부산광역시)';
COMMENT ON COLUMN regions.sigungu IS '시군구명 (예: 해운대구)';
COMMENT ON COLUMN regions.dong IS '동명 (예: 우동) - NULL 가능 (시군구 단위 통계시)';

-- 지역 통계
COMMENT ON COLUMN regions.average_price_per_sqm IS '평균 단가 (단위: 원/㎡) - 이 지역의 평균 거래 단가';
COMMENT ON COLUMN regions.total_auction_count IS '총 경매 건수 - 누적 경매 물건 수';
COMMENT ON COLUMN regions.success_rate IS '낙찰 성공률 (단위: %, 0-100) - 이 지역의 경매 낙찰 비율';

COMMENT ON COLUMN regions.created_at IS '레코드 생성 시각';
COMMENT ON COLUMN regions.updated_at IS '레코드 최종 수정 시각 (트리거로 자동 업데이트)';

-- ============================================
-- 6. DAILY_REPORTS 테이블 코멘트
-- ============================================
COMMENT ON TABLE daily_reports IS '일일 통계 리포트 테이블 - 매일 자정에 생성되는 종합 통계';

COMMENT ON COLUMN daily_reports.id IS '리포트 고유 식별자 (Primary Key)';
COMMENT ON COLUMN daily_reports.report_date IS '리포트 날짜 (UNIQUE) - 해당 날짜의 통계';

-- 전체 통계
COMMENT ON COLUMN daily_reports.total_properties IS '전체 물건 수 - 해당일 기준 전체 활성 물건';
COMMENT ON COLUMN daily_reports.new_properties IS '신규 물건 수 - 해당일에 새로 추가된 물건';
COMMENT ON COLUMN daily_reports.sold_properties IS '낙찰 물건 수 - 해당일에 낙찰된 물건';
COMMENT ON COLUMN daily_reports.failed_properties IS '유찰 물건 수 - 해당일에 유찰된 물건';

-- 가격 통계
COMMENT ON COLUMN daily_reports.average_discount_rate IS '평균 할인율 (단위: %) - 전체 물건의 평균 할인율';
COMMENT ON COLUMN daily_reports.total_appraisal_value IS '총 감정가액 (단위: 원) - 모든 물건 감정가 합계';
COMMENT ON COLUMN daily_reports.total_minimum_sale_price IS '총 최저매각가액 (단위: 원) - 모든 물건 최저가 합계';

-- 지역별 TOP 5
COMMENT ON COLUMN daily_reports.popular_regions IS '인기 지역 정보 (JSONB) - 경매 건수가 많은 상위 5개 지역';
COMMENT ON COLUMN daily_reports.high_value_properties IS '고가 물건 정보 (JSONB) - 감정가 상위 5개 물건';

COMMENT ON COLUMN daily_reports.created_at IS '리포트 생성 시각';

-- ============================================
-- 7. SCRAPING_LOGS 테이블 코멘트
-- ============================================
COMMENT ON TABLE scraping_logs IS '스크래핑 로그 테이블 - 데이터 수집 작업의 실행 이력 및 결과';

COMMENT ON COLUMN scraping_logs.id IS '로그 고유 식별자 (Primary Key)';
COMMENT ON COLUMN scraping_logs.source_site IS '출처 사이트 (courtauction, ggauction 등)';
COMMENT ON COLUMN scraping_logs.scraping_date IS '스크래핑 실행 시각';

-- 결과 통계
COMMENT ON COLUMN scraping_logs.total_found IS '발견한 총 물건 수 - 사이트에서 발견한 전체 물건';
COMMENT ON COLUMN scraping_logs.new_items IS '신규 아이템 수 - 새로 추가된 물건';
COMMENT ON COLUMN scraping_logs.updated_items IS '업데이트된 아이템 수 - 기존 물건의 정보 변경';
COMMENT ON COLUMN scraping_logs.error_count IS '에러 발생 수 - 스크래핑 중 발생한 오류 건수';

-- 상태 및 메시지
COMMENT ON COLUMN scraping_logs.status IS '작업 상태 (running: 실행중, completed: 완료, failed: 실패)';
COMMENT ON COLUMN scraping_logs.error_message IS '에러 메시지 - 실패시 상세 오류 내용';
COMMENT ON COLUMN scraping_logs.execution_time IS '실행 시간 (단위: 초) - 스크래핑 소요 시간';

COMMENT ON COLUMN scraping_logs.created_at IS '로그 생성 시각';

-- ============================================
-- 8. WATCHLISTS 테이블 코멘트
-- ============================================
COMMENT ON TABLE watchlists IS '사용자 관심 목록 테이블 - 사용자가 관심있는 물건 및 알림 설정';

COMMENT ON COLUMN watchlists.id IS '관심 목록 고유 식별자 (Primary Key)';
COMMENT ON COLUMN watchlists.user_id IS '사용자 ID - 향후 인증 시스템 연동시 사용';
COMMENT ON COLUMN watchlists.property_id IS '물건 ID (properties 테이블 외래키, CASCADE 삭제)';

-- 알림 설정
COMMENT ON COLUMN watchlists.price_alert IS '가격 변동 알림 (TRUE/FALSE) - 최저가 변경시 알림';
COMMENT ON COLUMN watchlists.status_alert IS '상태 변경 알림 (TRUE/FALSE) - 낙찰/유찰 등 상태 변경시 알림';
COMMENT ON COLUMN watchlists.score_alert IS '투자점수 변동 알림 (TRUE/FALSE) - AI 점수 재분석시 알림';
COMMENT ON COLUMN watchlists.auction_reminder IS '입찰일 알림 (TRUE/FALSE) - 경매일 D-1, D-day 알림';

-- 알림 조건
COMMENT ON COLUMN watchlists.alert_price_change_percent IS '가격 변동 알림 기준 (단위: %) - N% 이상 변동시 알림';
COMMENT ON COLUMN watchlists.alert_score_threshold IS '점수 알림 기준 - 투자점수가 이 값 이상이면 알림';

COMMENT ON COLUMN watchlists.created_at IS '관심 목록 추가 시각';

-- ============================================
-- 9. MARKET_TRENDS 테이블 코멘트
-- ============================================
COMMENT ON TABLE market_trends IS '시장 트렌드 분석 테이블 - 지역/물건유형별 시장 동향 분석 데이터';

COMMENT ON COLUMN market_trends.id IS '트렌드 고유 식별자 (Primary Key)';
COMMENT ON COLUMN market_trends.region_code IS '지역 코드 - 시군구 단위 코드';
COMMENT ON COLUMN market_trends.property_type IS '물건 유형 (아파트, 단독주택 등)';
COMMENT ON COLUMN market_trends.analysis_period IS '분석 기간 (1M: 1개월, 3M: 3개월, 6M: 6개월, 1Y: 1년)';

-- 가격 트렌드
COMMENT ON COLUMN market_trends.average_price_trend IS '평균 가격 상승률 (단위: %) - 해당 기간 동안의 평균가 변화';
COMMENT ON COLUMN market_trends.median_price_trend IS '중간값 가격 상승률 (단위: %) - 중간값 기준 가격 변화';
COMMENT ON COLUMN market_trends.price_volatility IS '가격 변동성 (0-100) - 가격 변화의 표준편차 기반 지표';

-- 거래량 트렌드
COMMENT ON COLUMN market_trends.transaction_volume IS '거래량 - 해당 기간의 총 거래 건수';
COMMENT ON COLUMN market_trends.volume_growth_rate IS '거래량 증가율 (단위: %) - 이전 기간 대비 거래량 변화';

-- 성공률 트렌드
COMMENT ON COLUMN market_trends.success_rate IS '낙찰 성공률 (단위: %, 0-100) - 경매 낙찰 비율';
COMMENT ON COLUMN market_trends.average_failure_count IS '평균 유찰 횟수 - 낙찰까지 평균 유찰 횟수';

-- 경쟁도 분석
COMMENT ON COLUMN market_trends.average_bidders IS '평균 입찰자 수 - 건당 평균 입찰 참여자';
COMMENT ON COLUMN market_trends.competition_intensity IS '경쟁 강도 지수 (0-100) - 입찰 경쟁의 치열함 정도';

COMMENT ON COLUMN market_trends.analysis_date IS '분석 수행 일시';
COMMENT ON COLUMN market_trends.created_at IS '레코드 생성 시각';

-- ============================================
-- 10. MODEL_PERFORMANCE 테이블 코멘트
-- ============================================
COMMENT ON TABLE model_performance IS 'AI 모델 성능 추적 테이블 - ML 모델의 정확도 및 예측 성능 모니터링';

COMMENT ON COLUMN model_performance.id IS '성능 기록 고유 식별자 (Primary Key)';
COMMENT ON COLUMN model_performance.model_name IS '모델 이름 (예: investment_scorer, price_predictor)';
COMMENT ON COLUMN model_performance.model_version IS '모델 버전 (예: v1.0, v2.1)';

-- 성능 지표
COMMENT ON COLUMN model_performance.accuracy IS '정확도 (0-1) - 전체 예측의 정확도';
COMMENT ON COLUMN model_performance.precision_score IS '정밀도 (0-1) - 양성 예측의 정확도';
COMMENT ON COLUMN model_performance.recall_score IS '재현율 (0-1) - 실제 양성을 찾아낸 비율';
COMMENT ON COLUMN model_performance.f1_score IS 'F1 점수 (0-1) - 정밀도와 재현율의 조화 평균';

-- 예측 성능
COMMENT ON COLUMN model_performance.price_prediction_mae IS '가격 예측 MAE (Mean Absolute Error) - 예측가와 실제가의 평균 오차';
COMMENT ON COLUMN model_performance.score_prediction_mae IS '점수 예측 MAE - 예측 점수와 실제 성과의 평균 오차';

-- 비즈니스 성과
COMMENT ON COLUMN model_performance.user_satisfaction_rate IS '사용자 만족도 (단위: %, 0-100) - 사용자 피드백 기반';
COMMENT ON COLUMN model_performance.prediction_hit_rate IS '예측 적중률 (단위: %, 0-100) - 실제로 맞춘 예측의 비율';

-- 메타데이터
COMMENT ON COLUMN model_performance.training_data_size IS '훈련 데이터 크기 - 모델 학습에 사용된 데이터 건수';
COMMENT ON COLUMN model_performance.test_data_size IS '테스트 데이터 크기 - 성능 평가에 사용된 데이터 건수';
COMMENT ON COLUMN model_performance.training_duration_minutes IS '훈련 소요 시간 (단위: 분) - 모델 학습에 걸린 시간';

COMMENT ON COLUMN model_performance.created_at IS '성능 기록 생성 시각';

-- ============================================
-- 11. NOTIFICATION_QUEUE 테이블 코멘트
-- ============================================
COMMENT ON TABLE notification_queue IS '실시간 알림 큐 테이블 - 사용자에게 전송할 알림 대기열';

COMMENT ON COLUMN notification_queue.id IS '알림 고유 식별자 (Primary Key)';
COMMENT ON COLUMN notification_queue.user_id IS '수신자 사용자 ID';
COMMENT ON COLUMN notification_queue.notification_type IS '알림 유형 (PRICE_DROP: 가격하락, SCORE_CHANGE: 점수변경, AUCTION_REMINDER: 경매일알림 등)';
COMMENT ON COLUMN notification_queue.property_id IS '관련 물건 ID (properties 테이블 외래키)';

-- 알림 내용
COMMENT ON COLUMN notification_queue.title IS '알림 제목 (최대 200자) - 푸시 알림 타이틀';
COMMENT ON COLUMN notification_queue.message IS '알림 메시지 본문 - 상세 내용';
COMMENT ON COLUMN notification_queue.data IS '추가 데이터 (JSONB) - 알림 관련 부가 정보 (링크, 액션 등)';

-- 전송 상태
COMMENT ON COLUMN notification_queue.status IS '전송 상태 (pending: 대기중, sent: 전송완료, failed: 실패)';
COMMENT ON COLUMN notification_queue.priority IS '우선순위 (1-10) - 1이 최고 우선순위, 10이 최저';
COMMENT ON COLUMN notification_queue.scheduled_at IS '예약 전송 시간 - 특정 시간에 발송하도록 예약';
COMMENT ON COLUMN notification_queue.sent_at IS '실제 전송 시간 - 알림이 실제로 발송된 시각';

-- 에러 정보
COMMENT ON COLUMN notification_queue.error_message IS '에러 메시지 - 전송 실패시 오류 내용';
COMMENT ON COLUMN notification_queue.retry_count IS '재시도 횟수 - 전송 실패시 재시도한 횟수';

COMMENT ON COLUMN notification_queue.created_at IS '알림 생성 시각';

-- ============================================
-- 뷰(Views) 코멘트
-- ============================================

COMMENT ON VIEW property_summary IS '물건 종합 정보 뷰 - properties, courts, analysis_results를 JOIN한 통합 뷰 (활성 물건만)';
COMMENT ON VIEW investment_recommendations IS '투자 추천 물건 뷰 - 투자점수 70점 이상 고득점 물건 + 지역 트렌드 정보';
COMMENT ON VIEW daily_dashboard IS '일일 대시보드 통계 뷰 - 대시보드에 표시할 핵심 지표 집계';

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 모든 테이블과 컬럼에 코멘트가 추가되었습니다!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 코멘트 확인 방법:';
    RAISE NOTICE '   SELECT obj_description(''analyzer.properties''::regclass);  -- 테이블 코멘트';
    RAISE NOTICE '   SELECT col_description(''analyzer.properties''::regclass, 1);  -- 컬럼 코멘트';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 pgAdmin이나 DBeaver에서 테이블을 클릭하면 코멘트를 확인할 수 있습니다.';
END $$;
