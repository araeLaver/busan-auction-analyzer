const express = require('express');
const cors = require('cors');
const path = require('path');
const SeoulDummyService = require('./src/services/SeoulDummyService');

const app = express();
const PORT = 3001;

// 서울 더미 데이터 서비스 초기화
const seoulService = new SeoulDummyService();

app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (웹 인터페이스)
app.use(express.static(path.join(__dirname, 'public')));

// favicon 요청 처리 (404 방지)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content 응답
});

console.log('🚀 서울 경매 API 테스트 서버 시작...');

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '서울 경매 API 테스트 서버', 
    timestamp: new Date().toISOString() 
  });
});

// 대시보드 통계
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 대시보드 통계 조회...');
    const stats = await seoulService.getDashboardStats();
    console.log('✅ 통계 조회 완료:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ 통계 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 물건 목록 조회
app.get('/api/properties', async (req, res) => {
  try {
    console.log('🏠 물건 목록 조회...', req.query);
    const result = await seoulService.getProperties(req.query);
    console.log(`✅ 물건 ${result.data.length}건 조회 완료`);
    res.json(result);
  } catch (error) {
    console.error('❌ 물건 목록 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 물건 상세 조회
app.get('/api/properties/:id', async (req, res) => {
  try {
    const property = await seoulService.getPropertyById(req.params.id);
    if (property) {
      res.json(property);
    } else {
      res.status(404).json({ error: 'Property not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TOP 물건 조회
app.get('/api/properties/top', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const topProperties = await seoulService.getTopProperties(limit);
    res.json(topProperties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 지역별 통계
app.get('/api/stats/regions', async (req, res) => {
  try {
    const stats = await seoulService.getRegionStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 오류 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`✅ 테스트 API 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`🌐 http://localhost:${PORT}/api/health`);
  console.log(`📊 http://localhost:${PORT}/api/dashboard/stats`);
  console.log(`🏠 http://localhost:${PORT}/api/properties`);
  console.log(`📍 http://localhost:${PORT}/api/stats/regions`);
});