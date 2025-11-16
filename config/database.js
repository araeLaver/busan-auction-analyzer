require('dotenv').config();
const { Pool } = require('pg');

// .env 파일 또는 환경변수에서 설정 읽기
const dbConfig = {
  host: process.env.PG_HOST || 'aws-0-ap-northeast-2.pooler.supabase.com',
  database: process.env.PG_DATABASE || 'postgres',
  user: process.env.PG_USER || 'postgres.lhqzjnpwuftaicjurqxq',
  password: process.env.PG_PASSWORD || 'Unbleyum1106!',
  port: parseInt(process.env.PG_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // analyzer 스키마 우선, public은 폴백
  options: '-c search_path=analyzer,public'
};

const pool = new Pool(dbConfig);

// 연결 테스트
pool.on('connect', (client) => {
  console.log('✅ PostgreSQL 연결 성공:', dbConfig.host);
});

pool.on('error', (err, client) => {
  console.error('❌ PostgreSQL 연결 오류:', err.message);
  // 자동 재연결 시도
  setTimeout(() => {
    console.log('🔄 데이터베이스 재연결 시도...');
  }, 5000);
});

// 초기 연결 테스트
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ 데이터베이스 초기 연결 실패:', err.message);
  } else {
    console.log('✅ 데이터베이스 초기 연결 테스트 성공:', res.rows[0].now);
  }
});

module.exports = pool;