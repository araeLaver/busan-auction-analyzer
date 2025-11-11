const pool = require('../config/database');
const AIInvestmentAnalyzer = require('../src/analyzer/AIInvestmentAnalyzer');

/**
 * 기존 물건 데이터에 대한 분석 실행
 */

async function analyzeExistingData() {
  console.log('='.repeat(80));
  console.log('🔍 기존 물건 데이터 분석 시작');
  console.log('='.repeat(80));
  console.log();

  const analyzer = new AIInvestmentAnalyzer();

  try {
    // 1. 분석 대상 물건 조회
    console.log('1️⃣  분석 대상 물건 조회...');
    const result = await pool.query(`
      SELECT id, case_number, address, property_type
      FROM analyzer.properties
      WHERE current_status = 'active'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('   ⚠️  분석 대상 물건이 없습니다.');
      return;
    }

    console.log(`   ✅ ${result.rows.length}개 물건 발견`);
    console.log();

    // 2. 각 물건 분석
    console.log('2️⃣  AI 투자 분석 실행...');
    console.log('-'.repeat(80));

    for (const [index, property] of result.rows.entries()) {
      try {
        console.log(`\n[${index + 1}/${result.rows.length}] ${property.case_number}`);
        console.log(`   주소: ${property.address}`);
        console.log(`   유형: ${property.property_type}`);

        const analysis = await analyzer.analyzeProperty(property.id);

        console.log(`   ✅ 분석 완료!`);
        console.log(`      투자점수: ${analysis.investmentScore}점 (${analysis.investmentGrade}등급)`);
        console.log(`      수익성: ${analysis.profitabilityScore}점 | 위험도: ${analysis.riskScore}점 | 유동성: ${analysis.liquidityScore}점`);
        console.log(`      1년 ROI: ${analysis.roi1Year}% | 위험수준: ${analysis.riskLevel}`);
        console.log(`      예상 낙찰확률: ${analysis.successProbability}%`);

      } catch (error) {
        console.error(`   ❌ 분석 실패: ${error.message}`);
        console.error(`      ${error.stack}`);
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('✅ 분석 완료!');
    console.log('='.repeat(80));
    console.log();
    console.log('💡 다음 명령으로 결과 확인:');
    console.log('   node scripts/check-data-status.js');
    console.log();

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// 실행
analyzeExistingData();
