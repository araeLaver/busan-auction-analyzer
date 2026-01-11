-- 1. search_vector 컬럼 추가 (이미 존재할 수 있으므로 IF NOT EXISTS 체크는 어렵지만 ALTER TABLE은 안전하게)
ALTER TABLE analyzer.properties ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. 한국어 검색을 위한 simple 설정 (한국어 형태소 분석기가 없으므로 simple 파서 사용 + N-gram 방식 보완 필요하지만 일단 simple로)
-- 건물명, 주소, 특이사항을 통합하여 검색 벡터 생성
UPDATE analyzer.properties 
SET search_vector = 
    setweight(to_tsvector('simple', COALESCE(building_name, '')), 'A') || 
    setweight(to_tsvector('simple', COALESCE(address, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(special_notes, '')), 'C');

-- 3. GIN 인덱스 생성 (검색 속도 핵심)
CREATE INDEX IF NOT EXISTS idx_properties_search_vector ON analyzer.properties USING GIN(search_vector);

-- 4. 트리거 함수 생성 (데이터 추가/수정 시 자동으로 벡터 업데이트)
CREATE OR REPLACE FUNCTION analyzer.properties_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.building_name, '')), 'A') || 
    setweight(to_tsvector('simple', COALESCE(NEW.address, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.special_notes, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 5. 트리거 적용
DROP TRIGGER IF EXISTS tsvectorupdate ON analyzer.properties;
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON analyzer.properties FOR EACH ROW EXECUTE FUNCTION analyzer.properties_search_vector_trigger();
