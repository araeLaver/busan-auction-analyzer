const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('../../config/database');
const DummyDataService = require('../services/DummyDataService');
const BusanDummyService = require('../services/BusanDummyService');

// 더미 데이터 서비스 초기화
const dummyService = new DummyDataService();
const busanService = new BusanDummyService();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 대시보드 통계
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 대시보드 통계 조회 중...');
    
    // 부산 더미 데이터 사용
    const stats = await busanService.getDashboardStats();
    console.log('✅ 대시보드 통계 조회 완료 (더미 데이터):', stats);
    res.json(stats);

  } catch (error) {
    console.error('❌ 대시보드 통계 조회 오류:', error);
    // 오류 시 기본값 반환
    res.json({
      totalActiveProperties: 5,
      newTodayCount: 2,
      averageInvestmentScore: 77,
      highScoreCount: 2
    });
  }
});

// 물건 목록 조회
app.get('/api/properties', async (req, res) => {
  try {
    console.log('🏠 물건 목록 조회 중... (더미 데이터)', req.query);
    
    const result = await busanService.getProperties(req.query);
    console.log(`✅ 물건 목록 조회 완료: ${result.properties.length}건`);
    res.json(result);

  } catch (error) {
    console.error('❌ 물건 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 물건 상세 정보 조회
app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const property = await dummyService.getPropertyById(id);

    if (!property) {
      return res.status(404).json({ error: '물건을 찾을 수 없습니다.' });
    }

    res.json(property);

  } catch (error) {
    console.error('물건 상세 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});


// 지역별 통계
app.get('/api/stats/regions', async (req, res) => {
  try {
    const result = await dummyService.getRegionStats();
    res.json(result);

  } catch (error) {
    console.error('지역별 통계 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 일일 리포트 조회
app.get('/api/reports/daily/:date?', async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const query = 'SELECT * FROM daily_reports WHERE report_date = $1';
    const result = await pool.query(query, [targetDate]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 날짜의 리포트를 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('일일 리포트 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 최근 스크래핑 로그 조회
app.get('/api/logs/scraping', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const result = await dummyService.getScrapingLogs(parseInt(limit));
    res.json(result);

  } catch (error) {
    console.error('스크래핑 로그 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 인기 물건 TOP 10 (투자 점수 기준)
app.get('/api/properties/top', async (req, res) => {
  try {
    const { type = 'score', limit = 10 } = req.query;
    const result = await dummyService.getTopProperties(type, parseInt(limit));
    res.json(result);

  } catch (error) {
    console.error('인기 물건 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// favicon 핸들러 추가
app.get('/favicon.ico', (req, res) => {
  res.status(204).send();
});

// 메인 페이지 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🌐 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📱 http://localhost:${PORT}`);
});

module.exports = app;