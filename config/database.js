const { Client, Pool } = require('pg');

const dbConfig = {
  connectionString: 'postgresql://unble:npg_1kjV0mhECxqs@ep-divine-bird-a1f4mly5.ap-southeast-1.pg.koyeb.app/unble',
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  options: '-c search_path=analyzer,public',
};

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('✅ PostgreSQL 연결 성공');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 연결 오류:', err);
});

module.exports = pool;