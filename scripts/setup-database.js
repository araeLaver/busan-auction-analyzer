const { Pool } = require('pg');
const migrate = require('node-pg-migrate').default;
const path = require('path');
const { dbConfig } = require('../config/database'); // dbConfig 가져오기

async function setupDatabase() {
  const connectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

  try {
    console.log('🚀 마이그레이션 시작...');
    await migrate({
      databaseUrl: connectionString,
      migrationsTable: 'pgmigrations', // 마이그레이션 기록을 저장할 테이블
      dir: path.resolve(__dirname, '..', 'database', 'migrations'),
      direction: 'up', // 'up' (새로운 마이그레이션 적용) 또는 'down' (롤백)
      count: Infinity, // 모든 새로운 마이그레이션 적용
      createMigrationsSchema: true, // 마이그레이션 스키마가 없으면 생성
      createSchema: true, // 스키마가 없으면 생성
      verbose: true,
      logger: console // 로깅을 위해 console 객체 사용
    });
    console.log('✅ 데이터베이스 마이그레이션 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  } finally {
    console.log('\n✅ 데이터베이스 설정 스크립트 종료');
    // migrate 함수 내부에서 Pool을 생성하고 관리하므로, 여기서는 별도로 pool.end()를 호출하지 않음
    // 필요한 경우, 마이그레이션 후 직접 연결을 닫을 수 있음 (migrate 함수가 내부적으로 관리)
  }
}

// 실행
setupDatabase();
