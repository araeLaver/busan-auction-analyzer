-- 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user'
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- updated_at 자동 업데이트 트리거 적용
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기존 watchlists 테이블의 user_id와 연결을 위한 코멘트
COMMENT ON COLUMN users.id IS '사용자 고유 ID';
COMMENT ON COLUMN users.email IS '로그인 이메일';
