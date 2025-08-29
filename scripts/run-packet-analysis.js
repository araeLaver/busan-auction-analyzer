#!/usr/bin/env node

const PacketScraper = require('../src/scraper/PacketScraper');

/**
 * 패킷 분석으로 실제 법원경매 API 호출 방식 파악
 */
async function runPacketAnalysis() {
    const scraper = new PacketScraper();
    
    try {
        console.log('📡 패킷 분석으로 실제 API 호출 방식 파악 시작');
        console.log('🔍 브라우저가 열리고 네트워크 패킷을 모니터링합니다...\n');
        
        // 패킷 스크래퍼 초기화
        await scraper.initialize();
        
        console.log('👀 브라우저에서 다음을 확인하세요:');
        console.log('   1. 개발자도구 Network 탭이 열려있습니다');
        console.log('   2. 법원경매정보 사이트에서 물건 검색을 진행합니다');
        console.log('   3. 실제 API 호출을 캡처하고 분석합니다\n');
        
        // 법원경매정보 API 분석
        const properties = await scraper.analyzeCourtAuctionAPI();
        
        if (properties.length > 0) {
            console.log(`\n🎉 성공! ${properties.length}개 실제 경매 물건 발견`);
            
            // 발견된 데이터 미리보기
            properties.slice(0, 3).forEach((prop, index) => {
                console.log(`\n${index + 1}. ${prop.case_number || 'N/A'}`);
                console.log(`   주소: ${prop.address || 'N/A'}`);
                console.log(`   종류: ${prop.property_type || 'N/A'}`);
            });
            
        } else {
            console.log('\n📊 패킷 분석 결과:');
            console.log('   - API 호출 패턴을 분석했습니다');
            console.log('   - captured-requests.json 파일을 확인하세요');
        }
        
        // 캡처된 요청들 저장
        await scraper.saveRequests();
        
        console.log('\n💡 다음 단계:');
        console.log('   1. captured-requests.json 파일에서 실제 API URL 확인');
        console.log('   2. 해당 API를 직접 호출하여 데이터 수집');
        console.log('   3. 자동화된 데이터 수집기 구현');
        
    } catch (error) {
        console.error('❌ 패킷 분석 실패:', error);
    } finally {
        await scraper.close();
    }
}

// 실행
if (require.main === module) {
    runPacketAnalysis()
        .then(() => {
            console.log('\n✅ 패킷 분석 완료');
            process.exit(0);
        })
        .catch(error => {
            console.error('실패:', error);
            process.exit(1);
        });
}

module.exports = { runPacketAnalysis };