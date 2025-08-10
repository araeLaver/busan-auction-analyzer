const { Client, Pool } = require('pg');

const dbConfig = {
  connectionString: 'postgresql://postgres.lhqzjnpwuftaicjurqxq:UnbleYum1106!@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('✅ PostgreSQL 연결 성공');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 연결 오류:', err);
});

module.exports = pool;