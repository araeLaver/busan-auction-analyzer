const axios = require('axios');
const iconv = require('iconv-lite'); // 한글 깨짐 방지용 (필요시 설치)

async function checkSite() {
    try {
        console.log('🌐 아이코트옥션 접속 시도...');
        const url = 'http://www.icourtauction.co.kr/'; 
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ 접속 성공! 상태 코드:', response.status);
        
        // EUC-KR 디코딩 (옛날 사이트들은 보통 EUC-KR 사용)
        // iconv-lite가 없으면 그냥 utf-8로 시도하거나 버퍼 길이만 확인
        console.log('📦 데이터 크기:', response.data.length);
        
    } catch (error) {
        console.error('❌ 접속 실패:', error.message);
    }
}

checkSite();
