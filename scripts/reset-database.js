const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lhqzjnpwuftaicjurqxq',
  password: 'Unbleyum1106!',
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

async function resetDatabase() {
  try {
    console.log('데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 기존 테이블 목록 조회
    const existingTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    if (existingTablesResult.rows.length > 0) {
      console.log('\n🗑️  기존 테이블 삭제 중...');
      
      // 뷰 먼저 삭제
      await client.query('DROP VIEW IF EXISTS property_summary CASCADE;');
      await client.query('DROP VIEW IF EXISTS investment_recommendations CASCADE;');
      await client.query('DROP VIEW IF EXISTS daily_dashboard CASCADE;');
      
      // 테이블 삭제 (CASCADE로 종속성 같이 삭제)
      const tables = [
        'notification_queue',
        'model_performance', 
        'market_trends',
        'watchlists',
        'scraping_logs',
        'daily_reports',
        'regions',
        'analysis_results',
        'property_images',
        'properties',
        'courts'
      ];
      
      for (const tableName of tables) {
        try {
          await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
          console.log(`  ✅ ${tableName} 삭제 완료`);
        } catch (error) {
          console.log(`  ⚠️  ${tableName} 삭제 실패: ${error.message}`);
        }
      }
      
      // 함수 삭제
      await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;');
      
      console.log('✅ 기존 데이터베이스 정리 완료');
    } else {
      console.log('기존 테이블이 없습니다.');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ 데이터베이스 리셋 완료');
  }
}

resetDatabase();