const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lhqzjnpwuftaicjurqxq',
  password: 'UnbleYum1106!',
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

async function setupDatabase() {
  try {
    console.log('데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 스키마 파일 읽기
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('스키마 생성 중...');
    await client.query(schemaSQL);
    console.log('✅ 스키마 생성 완료');

    // 테이블 목록 확인
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n📋 생성된 테이블 목록:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // 뷰 목록 확인
    const viewResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (viewResult.rows.length > 0) {
      console.log('\n🔍 생성된 뷰 목록:');
      viewResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // 각 테이블의 컬럼 수 확인
    console.log('\n📊 테이블별 컬럼 수:');
    for (const table of result.rows) {
      const columnResult = await client.query(`
        SELECT COUNT(*) as column_count 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1;
      `, [table.table_name]);
      
      console.log(`  - ${table.table_name}: ${columnResult.rows[0].column_count}개 컬럼`);
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ 데이터베이스 설정 완료');
  }
}

// 실행
setupDatabase();