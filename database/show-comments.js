const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-divine-bird-a1f4mly5.ap-southeast-1.pg.koyeb.app',
  database: 'unble',
  user: 'unble',
  password: 'npg_1kjV0mhECxqs',
  port: 5432,
  ssl: { rejectUnauthorized: false },
  options: '-c search_path=analyzer,public'
});

async function showComments() {
  try {
    console.log('\n===========================================');
    console.log('DATABASE TABLES AND COMMENTS');
    console.log('===========================================\n');

    // 테이블 및 뷰 목록 조회
    const result = await pool.query(`
      SELECT
        c.relname as table_name,
        obj_description(c.oid) as table_comment,
        c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'analyzer'
        AND c.relkind IN ('r', 'v')
      ORDER BY
        CASE c.relkind
          WHEN 'r' THEN 1
          WHEN 'v' THEN 2
        END,
        c.relname
    `);

    let tableCount = 0;
    let viewCount = 0;

    for (const row of result.rows) {
      if (row.relkind === 'v') {
        viewCount++;
        console.log(`VIEW: ${row.table_name}`);
      } else {
        tableCount++;
        console.log(`TABLE: ${row.table_name}`);
      }
      console.log(`  => ${row.table_comment || '(no comment)'}`);
      console.log('');
    }

    console.log('===========================================');
    console.log(`Total: ${tableCount} tables, ${viewCount} views`);
    console.log('===========================================\n');

    // 특정 테이블의 컬럼 코멘트 예시
    console.log('\n===========================================');
    console.log('SAMPLE: properties TABLE COLUMNS');
    console.log('===========================================\n');

    const columns = await pool.query(`
      SELECT
        a.attnum,
        a.attname as column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
        col_description(c.oid, a.attnum) as column_comment
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'analyzer'
        AND c.relname = 'properties'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
      LIMIT 10
    `);

    for (const col of columns.rows) {
      console.log(`${col.column_name} (${col.data_type})`);
      console.log(`  => ${col.column_comment || '(no comment)'}`);
      console.log('');
    }

    await pool.end();
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

showComments();
