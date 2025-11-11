const pool = require('../config/database');

/**
 * 데이터베이스 상태 확인 스크립트
 * - 물건 데이터 현황
 * - 분석 결과 현황
 * - 최근 업데이트 상태
 */

async function checkDataStatus() {
  console.log('='.repeat(80));
  console.log('📊 데이터베이스 상태 확인');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. 전체 물건 통계
    console.log('1️⃣  전체 물건 통계');
    console.log('-'.repeat(80));

    const totalStats = await pool.query(`
      SELECT
        COUNT(*) as total_properties,
        COUNT(CASE WHEN current_status = 'active' THEN 1 END) as active_properties,
        COUNT(CASE WHEN current_status = 'sold' THEN 1 END) as sold_properties,
        COUNT(CASE WHEN current_status = 'cancelled' THEN 1 END) as cancelled_properties,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as created_today,
        COUNT(CASE WHEN DATE(updated_at) = CURRENT_DATE THEN 1 END) as updated_today
      FROM analyzer.properties
    `);

    const stats = totalStats.rows[0];
    console.log(`   총 물건 수:        ${Number(stats.total_properties).toLocaleString()}개`);
    console.log(`   진행중:           ${Number(stats.active_properties).toLocaleString()}개`);
    console.log(`   낙찰:             ${Number(stats.sold_properties).toLocaleString()}개`);
    console.log(`   취소:             ${Number(stats.cancelled_properties).toLocaleString()}개`);
    console.log(`   오늘 생성:        ${Number(stats.created_today).toLocaleString()}개`);
    console.log(`   오늘 업데이트:    ${Number(stats.updated_today).toLocaleString()}개`);
    console.log();

    // 2. 물건 유형별 통계
    console.log('2️⃣  물건 유형별 통계');
    console.log('-'.repeat(80));

    const typeStats = await pool.query(`
      SELECT
        property_type,
        COUNT(*) as count,
        AVG(minimum_sale_price) as avg_price,
        MIN(auction_date) as earliest_auction,
        MAX(auction_date) as latest_auction
      FROM analyzer.properties
      WHERE current_status = 'active'
      GROUP BY property_type
      ORDER BY count DESC
      LIMIT 10
    `);

    if (typeStats.rows.length > 0) {
      typeStats.rows.forEach(row => {
        const avgPrice = row.avg_price ? `${Math.round(row.avg_price / 10000).toLocaleString()}만원` : 'N/A';
        console.log(`   ${row.property_type || '미분류'}: ${Number(row.count).toLocaleString()}개 (평균: ${avgPrice})`);
      });
    } else {
      console.log('   ⚠️  물건 데이터가 없습니다.');
    }
    console.log();

    // 3. 최근 추가/업데이트된 물건
    console.log('3️⃣  최근 추가된 물건 (최근 5개)');
    console.log('-'.repeat(80));

    const recentProperties = await pool.query(`
      SELECT
        id,
        case_number,
        address,
        property_type,
        minimum_sale_price,
        auction_date,
        current_status,
        created_at,
        source_site
      FROM analyzer.properties
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (recentProperties.rows.length > 0) {
      recentProperties.rows.forEach((prop, idx) => {
        const price = prop.minimum_sale_price ? `${Math.round(prop.minimum_sale_price / 10000).toLocaleString()}만원` : 'N/A';
        const auctionDate = prop.auction_date ? new Date(prop.auction_date).toLocaleDateString('ko-KR') : 'N/A';
        const createdAt = new Date(prop.created_at).toLocaleString('ko-KR');

        console.log(`   [${idx + 1}] ID: ${prop.id} | ${prop.case_number}`);
        console.log(`       주소: ${prop.address}`);
        console.log(`       유형: ${prop.property_type || 'N/A'} | 최저가: ${price}`);
        console.log(`       입찰일: ${auctionDate} | 상태: ${prop.current_status}`);
        console.log(`       출처: ${prop.source_site} | 생성: ${createdAt}`);
        console.log();
      });
    } else {
      console.log('   ⚠️  물건 데이터가 없습니다.');
      console.log();
    }

    // 4. 분석 결과 통계
    console.log('4️⃣  분석 결과 통계');
    console.log('-'.repeat(80));

    const analysisStats = await pool.query(`
      SELECT
        COUNT(*) as total_analyses,
        COUNT(DISTINCT property_id) as analyzed_properties,
        AVG(investment_score) as avg_score,
        COUNT(CASE WHEN investment_grade = 'S' THEN 1 END) as grade_s,
        COUNT(CASE WHEN investment_grade = 'A' THEN 1 END) as grade_a,
        COUNT(CASE WHEN investment_grade = 'B' THEN 1 END) as grade_b,
        COUNT(CASE WHEN investment_grade = 'C' THEN 1 END) as grade_c,
        COUNT(CASE WHEN investment_grade = 'D' THEN 1 END) as grade_d,
        COUNT(CASE WHEN DATE(analysis_date) = CURRENT_DATE THEN 1 END) as analyzed_today
      FROM analyzer.analysis_results
    `);

    const aStats = analysisStats.rows[0];
    console.log(`   총 분석 결과:     ${Number(aStats.total_analyses).toLocaleString()}개`);
    console.log(`   분석된 물건:      ${Number(aStats.analyzed_properties).toLocaleString()}개`);
    console.log(`   평균 투자점수:    ${aStats.avg_score ? Number(aStats.avg_score).toFixed(1) : 'N/A'}점`);
    console.log(`   오늘 분석:        ${Number(aStats.analyzed_today).toLocaleString()}개`);
    console.log();
    console.log(`   등급 분포:`);
    console.log(`   - S등급: ${Number(aStats.grade_s).toLocaleString()}개`);
    console.log(`   - A등급: ${Number(aStats.grade_a).toLocaleString()}개`);
    console.log(`   - B등급: ${Number(aStats.grade_b).toLocaleString()}개`);
    console.log(`   - C등급: ${Number(aStats.grade_c).toLocaleString()}개`);
    console.log(`   - D등급: ${Number(aStats.grade_d).toLocaleString()}개`);
    console.log();

    // 5. 최근 분석 결과
    console.log('5️⃣  최근 분석 결과 (최근 5개)');
    console.log('-'.repeat(80));

    const recentAnalyses = await pool.query(`
      SELECT
        ar.property_id,
        ar.investment_score,
        ar.investment_grade,
        ar.roi_1year,
        ar.risk_level,
        ar.analysis_date,
        p.case_number,
        p.address,
        p.property_type,
        p.minimum_sale_price
      FROM analyzer.analysis_results ar
      JOIN analyzer.properties p ON ar.property_id = p.id
      ORDER BY ar.analysis_date DESC
      LIMIT 5
    `);

    if (recentAnalyses.rows.length > 0) {
      recentAnalyses.rows.forEach((analysis, idx) => {
        const price = analysis.minimum_sale_price ? `${Math.round(analysis.minimum_sale_price / 10000).toLocaleString()}만원` : 'N/A';
        const analysisDate = new Date(analysis.analysis_date).toLocaleString('ko-KR');

        console.log(`   [${idx + 1}] 물건 ID: ${analysis.property_id} | ${analysis.case_number}`);
        console.log(`       주소: ${analysis.address}`);
        console.log(`       유형: ${analysis.property_type || 'N/A'} | 최저가: ${price}`);
        console.log(`       투자점수: ${analysis.investment_score}점 (${analysis.investment_grade}등급)`);
        console.log(`       1년 ROI: ${analysis.roi_1year ? analysis.roi_1year + '%' : 'N/A'} | 위험도: ${analysis.risk_level || 'N/A'}`);
        console.log(`       분석일시: ${analysisDate}`);
        console.log();
      });
    } else {
      console.log('   ⚠️  분석 결과가 없습니다.');
      console.log();
    }

    // 6. 스크래핑 로그
    console.log('6️⃣  최근 스크래핑 로그 (최근 10개)');
    console.log('-'.repeat(80));

    const scrapingLogs = await pool.query(`
      SELECT
        source_site,
        total_found,
        new_items,
        updated_items,
        error_count,
        status,
        execution_time,
        scraping_date
      FROM analyzer.scraping_logs
      ORDER BY scraping_date DESC
      LIMIT 10
    `);

    if (scrapingLogs.rows.length > 0) {
      scrapingLogs.rows.forEach((log, idx) => {
        const scrapingDate = new Date(log.scraping_date).toLocaleString('ko-KR');
        const statusEmoji = log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '⏳';

        console.log(`   [${idx + 1}] ${statusEmoji} ${log.source_site} - ${scrapingDate}`);
        console.log(`       발견: ${log.total_found}개 | 신규: ${log.new_items}개 | 업데이트: ${log.updated_items}개`);
        console.log(`       에러: ${log.error_count}개 | 소요시간: ${log.execution_time}초 | 상태: ${log.status}`);
        console.log();
      });
    } else {
      console.log('   ⚠️  스크래핑 로그가 없습니다.');
      console.log();
    }

    // 7. 분석 미완료 물건
    console.log('7️⃣  분석 미완료 물건');
    console.log('-'.repeat(80));

    const unanalyzed = await pool.query(`
      SELECT COUNT(*) as count
      FROM analyzer.properties p
      LEFT JOIN analyzer.analysis_results ar ON p.id = ar.property_id
      WHERE p.current_status = 'active'
      AND ar.id IS NULL
    `);

    console.log(`   분석 미완료 물건: ${Number(unanalyzed.rows[0].count).toLocaleString()}개`);
    console.log();

    // 8. 데이터 품질 체크
    console.log('8️⃣  데이터 품질 체크');
    console.log('-'.repeat(80));

    const qualityCheck = await pool.query(`
      SELECT
        COUNT(CASE WHEN address IS NULL OR address = '' THEN 1 END) as missing_address,
        COUNT(CASE WHEN property_type IS NULL OR property_type = '' THEN 1 END) as missing_type,
        COUNT(CASE WHEN minimum_sale_price IS NULL OR minimum_sale_price = 0 THEN 1 END) as missing_price,
        COUNT(CASE WHEN auction_date IS NULL THEN 1 END) as missing_auction_date
      FROM analyzer.properties
      WHERE current_status = 'active'
    `);

    const quality = qualityCheck.rows[0];
    console.log(`   주소 누락:        ${Number(quality.missing_address).toLocaleString()}개`);
    console.log(`   유형 누락:        ${Number(quality.missing_type).toLocaleString()}개`);
    console.log(`   가격 누락:        ${Number(quality.missing_price).toLocaleString()}개`);
    console.log(`   입찰일 누락:      ${Number(quality.missing_auction_date).toLocaleString()}개`);
    console.log();

    console.log('='.repeat(80));
    console.log('✅ 데이터 상태 확인 완료');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// 실행
checkDataStatus();
