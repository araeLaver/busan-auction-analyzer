#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const cheerio = require('cheerio');

/**
 * HTML 응답 구조 분석 및 디버깅
 */
async function debugHTMLResponse() {
    try {
        console.log('🔍 HTML 응답 구조 분석 시작...');
        
        const searchEndpoints = [
            '/pgj/search/selectRealEstMulSrchLst.on',
            '/pgj/pgj003/selectRealEstMulSrchLst.on'
        ];
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Referer': 'https://www.courtauction.go.kr/',
        };
        
        for (const endpoint of searchEndpoints) {
            try {
                console.log(`\n📋 ${endpoint} 분석 중...`);
                
                const response = await axios.post(
                    `https://www.courtauction.go.kr${endpoint}`,
                    'pageIndex=1&pageUnit=20&mulSlctTp=R&realVowelChk=2',
                    {
                        headers: headers,
                        timeout: 15000
                    }
                );
                
                console.log(`✅ 응답 성공: ${response.status}`);
                console.log(`📊 응답 크기: ${response.data.length} 문자`);
                
                // HTML 파일로 저장
                const fileName = `debug-response-${endpoint.replace(/\//g, '-')}.html`;
                await fs.writeFile(fileName, response.data);
                console.log(`💾 HTML 저장: ${fileName}`);
                
                // HTML 구조 분석
                const $ = cheerio.load(response.data);
                
                // 다양한 선택자로 경매 데이터 찾기
                console.log('\n🔍 HTML 구조 분석:');
                
                // 테이블 찾기
                const tables = $('table');
                console.log(`📋 테이블 수: ${tables.length}`);
                
                tables.each((index, table) => {
                    const $table = $(table);
                    const rows = $table.find('tr');
                    console.log(`   테이블 ${index + 1}: ${rows.length}개 행`);
                    
                    // 첫 번째 행의 내용 확인
                    if (rows.length > 0) {
                        const firstRowText = $table.find('tr').first().text().trim();
                        if (firstRowText) {
                            console.log(`   첫 행: ${firstRowText.substring(0, 100)}...`);
                        }
                    }
                });
                
                // 특정 키워드가 포함된 요소 찾기
                const keywords = ['타경', '사건번호', '물건', '경매', '법원', '최저가', '감정가'];
                for (const keyword of keywords) {
                    const elements = $(`*:contains("${keyword}")`);
                    if (elements.length > 0) {
                        console.log(`🔍 "${keyword}" 포함 요소: ${elements.length}개`);
                        
                        elements.slice(0, 3).each((index, element) => {
                            const text = $(element).text().trim().substring(0, 150);
                            console.log(`   ${index + 1}: ${text}...`);
                        });
                    }
                }
                
                // JavaScript 변수나 데이터 찾기
                if (response.data.includes('var ') || response.data.includes('data')) {
                    console.log('📊 JavaScript 데이터 발견 가능');
                    
                    // var mulList = [...] 같은 패턴 찾기
                    const jsDataMatches = response.data.match(/var\s+\w+\s*=\s*\[.*?\];?/gs);
                    if (jsDataMatches) {
                        console.log(`🎯 JavaScript 배열 데이터: ${jsDataMatches.length}개`);
                        jsDataMatches.forEach((match, index) => {
                            console.log(`   ${index + 1}: ${match.substring(0, 100)}...`);
                        });
                    }
                }
                
                break; // 첫 번째 성공한 endpoint만 분석
                
            } catch (error) {
                console.log(`❌ ${endpoint} 실패: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ HTML 응답 분석 실패:', error);
    }
}

// 실행
if (require.main === module) {
    debugHTMLResponse()
        .then(() => {
            console.log('\n✅ HTML 응답 분석 완료');
            console.log('💡 저장된 HTML 파일을 직접 열어서 구조를 확인해보세요');
            process.exit(0);
        })
        .catch(error => {
            console.error('실패:', error);
            process.exit(1);
        });
}