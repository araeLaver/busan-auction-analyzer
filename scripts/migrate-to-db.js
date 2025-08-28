const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function migrateRealDataToDatabase() {
    console.log('🚀 실제 데이터를 PostgreSQL로 마이그레이션 시작...');
    
    const client = await pool.connect();
    
    try {
        // JSON 파일에서 실제 데이터 로드
        const dataPath = path.join(__dirname, '../data/real-auction-data.json');
        const realData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        console.log(`📊 ${realData.properties.length}개 물건 데이터 발견`);
        
        await client.query('BEGIN');
        
        // 기존 데이터 삭제 (새로운 데이터로 교체)
        await client.query('DELETE FROM auction_service.analysis_results');
        await client.query('DELETE FROM auction_service.properties');
        
        // 물건 데이터 삽입
        for (const property of realData.properties) {
            const insertQuery = `
                INSERT INTO auction_service.properties (
                    case_number, court_id, court_name, property_type, address, building_name,
                    building_year, floor_info, area, land_area, building_area,
                    appraisal_value, minimum_sale_price, bid_deposit, discount_rate,
                    auction_date, failure_count, current_status, tenant_status, tenant_info,
                    source_url, scraped_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                RETURNING id
            `;
            
            const values = [
                property.case_number,
                1, // 부산지방법원 ID
                property.court_name,
                property.property_type,
                property.address,
                property.building_name || null,
                property.building_year || null,
                property.floor_info || null,
                property.area || null,
                property.land_area || null,
                property.building_area || null,
                property.appraisal_value,
                property.minimum_sale_price,
                property.bid_deposit || null,
                property.discount_rate,
                property.auction_date,
                property.failure_count || 0,
                'active',
                property.tenant_status || null,
                property.tenant_info || null,
                property.court_auction_url,
                new Date()
            ];
            
            const result = await client.query(insertQuery, values);
            const propertyId = result.rows[0].id;
            
            // AI 분석 결과 삽입
            if (property.ai_analysis) {
                const analysisQuery = `
                    INSERT INTO auction_service.analysis_results (
                        property_id, investment_score, investment_grade,
                        profitability_score, risk_score, liquidity_score, location_score,
                        market_trend_score, legal_risk_score,
                        roi_1year, roi_3year, roi_5year,
                        success_probability, estimated_final_price, estimated_competition_level,
                        analysis_version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                `;
                
                const analysis = property.ai_analysis;
                const analysisValues = [
                    propertyId,
                    analysis.investment_score,
                    analysis.investment_grade,
                    analysis.profitability_score || null,
                    analysis.risk_score || null,
                    analysis.liquidity_score || null,
                    analysis.location_score || null,
                    analysis.market_trend_score || null,
                    analysis.legal_risk_score || null,
                    analysis.roi_1year || null,
                    analysis.roi_3year || null,
                    analysis.roi_5year || null,
                    analysis.success_probability || null,
                    analysis.estimated_final_price || null,
                    analysis.estimated_competition_level || 'MEDIUM',
                    '1.0'
                ];
                
                await client.query(analysisQuery, analysisValues);
            }
        }
        
        await client.query('COMMIT');
        
        // 마이그레이션 결과 확인
        const countResult = await client.query('SELECT COUNT(*) as count FROM auction_service.properties');
        const analysisCountResult = await client.query('SELECT COUNT(*) as count FROM auction_service.analysis_results');
        
        console.log('✅ 마이그레이션 완료!');
        console.log(`📦 저장된 물건: ${countResult.rows[0].count}개`);
        console.log(`🧠 저장된 AI 분석: ${analysisCountResult.rows[0].count}개`);
        
        // 스크래핑 로그 기록
        const logQuery = `
            INSERT INTO auction_service.scraping_logs (
                source_site, scraping_type, start_time, end_time, status,
                properties_found, properties_saved, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        
        await client.query(logQuery, [
            'court-auction-simulator',
            'manual',
            new Date(),
            new Date(),
            'completed',
            realData.properties.length,
            realData.properties.length,
            JSON.stringify({
                migration_type: 'initial_real_data_migration',
                source_file: 'real-auction-data.json',
                ai_analysis_included: true
            })
        ]);
        
        console.log('📝 스크래핑 로그 기록 완료');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 마이그레이션 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 스크립트 실행
if (require.main === module) {
    migrateRealDataToDatabase()
        .then(() => {
            console.log('🎉 데이터 마이그레이션 성공!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 마이그레이션 실패:', error);
            process.exit(1);
        });
}

module.exports = migrateRealDataToDatabase;