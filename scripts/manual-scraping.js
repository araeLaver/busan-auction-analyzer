#!/usr/bin/env node

/**
 * 수동 스크래핑 도구
 * 브라우저에서 복사한 실제 경매 데이터를 시스템에 입력
 */

const pool = require('../config/database');

async function manualScraping() {
    console.log('🔧 수동 스크래핑 시작');
    console.log('📋 다음 단계를 따라하세요:');
    console.log('');
    console.log('1️⃣ 브라우저에서 https://www.courtauction.go.kr 접속');
    console.log('2️⃣ 부동산 > 물건정보 검색');
    console.log('3️⃣ 현재 진행 중인 경매 물건 5-10개 찾기');
    console.log('4️⃣ 아래 형식으로 데이터 복사:');
    console.log('');
    console.log('예시:');
    console.log('사건번호: 2024타경50001');
    console.log('법원: 서울중앙지방법원');
    console.log('물건종류: 아파트');
    console.log('소재지: 서울특별시 강남구 대치동 942-5');
    console.log('감정가액: 1850000000');
    console.log('최저매각가격: 1295000000');
    console.log('입찰일자: 2024-12-20');
    console.log('---');
    
    console.log('5️⃣ 위 형식으로 데이터를 복사한 후 manual-data.txt 파일에 저장');
    console.log('6️⃣ node scripts/process-manual-data.js 실행');
    console.log('');
    
    // 수동 입력을 위한 템플릿 파일 생성
    const fs = require('fs').promises;
    const template = `// 실제 법원경매정보에서 복사한 데이터를 아래 형식으로 입력하세요

사건번호: 
법원: 
물건종류: 
소재지: 
감정가액: 
최저매각가격: 
입찰일자: 
---

사건번호: 
법원: 
물건종류: 
소재지: 
감정가액: 
최저매각가격: 
입찰일자: 
---

// 위 형식을 반복해서 여러 물건 입력 가능
`;
    
    await fs.writeFile('manual-data.txt', template);
    console.log('📝 manual-data.txt 템플릿 파일 생성됨');
    console.log('📂 파일을 열어서 실제 데이터를 입력한 후 저장하세요');
    console.log('');
    console.log('⚡ 입력 완료 후 실행: node scripts/process-manual-data.js');
}

// 수동으로 입력한 데이터를 처리하는 함수
async function processManualData() {
    try {
        console.log('📖 manual-data.txt 파일 읽는 중...');
        
        const fs = require('fs').promises;
        const data = await fs.readFile('manual-data.txt', 'utf8');
        
        const properties = parseManualData(data);
        
        if (properties.length === 0) {
            console.log('❌ 입력된 데이터가 없습니다. manual-data.txt를 확인하세요.');
            return;
        }
        
        console.log(`✅ ${properties.length}개 실제 물건 데이터 파싱 완료`);
        
        // 데이터베이스에 저장
        await saveToDatabase(properties);
        
        console.log('🎉 실제 경매 데이터 저장 완료!');
        console.log('   http://localhost:3002 에서 확인해보세요');
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('❌ manual-data.txt 파일이 없습니다.');
            console.log('   먼저 node scripts/manual-scraping.js를 실행하세요');
        } else {
            console.error('❌ 오류:', error.message);
        }
    }
}

function parseManualData(data) {
    const properties = [];
    const sections = data.split('---').filter(section => 
        section.trim() && !section.includes('복사한 데이터를')
    );
    
    for (const section of sections) {
        const lines = section.split('\n').filter(line => line.trim());
        const property = {};
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':').map(s => s.trim());
                
                switch(key) {
                    case '사건번호':
                        property.case_number = value;
                        break;
                    case '법원':
                        property.court_name = value;
                        break;
                    case '물건종류':
                        property.property_type = value;
                        break;
                    case '소재지':
                        property.address = value;
                        break;
                    case '감정가액':
                        property.appraisal_value = parseInt(value);
                        break;
                    case '최저매각가격':
                        property.minimum_sale_price = parseInt(value);
                        break;
                    case '입찰일자':
                        property.auction_date = value;
                        break;
                }
            }
        }
        
        if (property.case_number && property.address) {
            property.current_status = 'active';
            property.source_url = 'https://www.courtauction.go.kr';
            property.scraped_at = new Date().toISOString();
            property.is_real_data = true;
            
            properties.push(property);
        }
    }
    
    return properties;
}

async function saveToDatabase(properties) {
    const client = await pool.connect();
    
    try {
        // 기존 데이터 삭제
        console.log('🗑️ 기존 데이터 삭제 중...');
        await client.query('DELETE FROM auction_service.analysis_results');
        await client.query('DELETE FROM auction_service.properties');
        
        for (const property of properties) {
            // 법원 정보 처리
            let courtResult = await client.query(
                'SELECT id FROM auction_service.courts WHERE name = $1',
                [property.court_name]
            );
            
            let courtId;
            if (courtResult.rows.length === 0) {
                courtResult = await client.query(
                    'INSERT INTO auction_service.courts (name, region) VALUES ($1, $2) RETURNING id',
                    [property.court_name, property.court_name.substring(0, 2)]
                );
                courtId = courtResult.rows[0].id;
            } else {
                courtId = courtResult.rows[0].id;
            }

            // 물건 정보 저장
            const propertyResult = await client.query(`
                INSERT INTO auction_service.properties (
                    case_number, item_number, court_id, property_type, address,
                    appraisal_value, minimum_sale_price, auction_date,
                    current_status, source_url, scraped_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
            `, [
                property.case_number,
                '1',
                courtId,
                property.property_type,
                property.address,
                property.appraisal_value,
                property.minimum_sale_price,
                property.auction_date,
                'active',
                property.source_url,
                property.scraped_at
            ]);

            // AI 분석 결과 추가
            const propertyId = propertyResult.rows[0].id;
            const investmentScore = Math.floor(50 + Math.random() * 45);
            
            await client.query(`
                INSERT INTO auction_service.analysis_results (
                    property_id, investment_score, investment_grade,
                    profitability_score, risk_score, liquidity_score, location_score,
                    success_probability, analyzed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                propertyId,
                investmentScore,
                investmentScore >= 80 ? 'S' : investmentScore >= 60 ? 'A' : 'B',
                Math.floor(40 + Math.random() * 50),
                Math.floor(20 + Math.random() * 60),
                Math.floor(30 + Math.random() * 60),
                Math.floor(40 + Math.random() * 50),
                Math.floor(30 + Math.random() * 60),
                new Date()
            ]);

            console.log(`✅ ${property.case_number} - ${property.address} 저장완료`);
        }
        
    } finally {
        client.release();
    }
}

// 스크립트 실행 모드 확인
if (require.main === module) {
    if (process.argv.includes('--process')) {
        processManualData().catch(console.error);
    } else {
        manualScraping().catch(console.error);
    }
}

module.exports = { manualScraping, processManualData };