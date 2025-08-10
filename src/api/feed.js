const express = require('express');
const router = express.Router();

// JSON Feed 형식으로 최신 데이터 제공
router.get('/api/feed/latest.json', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // 더미 데이터 (실제로는 DB에서 조회)
    const feed = {
      version: "https://jsonfeed.org/version/1",
      title: "부산경매 최신 물건",
      home_page_url: "http://localhost:3000",
      feed_url: "http://localhost:3000/api/feed/latest.json",
      updated: new Date().toISOString(),
      items: [
        {
          id: "property_001",
          url: "http://localhost:3000/property/001",
          title: "해운대구 아파트",
          content_text: "감정가: 5억, 최저가: 3.5억, 투자점수: 85점",
          date_published: new Date().toISOString(),
          tags: ["아파트", "해운대구", "추천"],
          _auction: {
            appraisalValue: 500000000,
            minimumPrice: 350000000,
            investmentScore: 85,
            auctionDate: "2025-01-15",
            location: "부산 해운대구 우동"
          }
        }
      ]
    };
    
    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RSS 2.0 형식
router.get('/api/feed/latest.xml', async (req, res) => {
  try {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>부산경매 최신 물건</title>
    <link>http://localhost:3000</link>
    <description>부산지방법원 경매 물건 실시간 업데이트</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <item>
      <title>해운대구 아파트 - 투자점수 85점</title>
      <link>http://localhost:3000/property/001</link>
      <description>감정가: 5억, 최저가: 3.5억</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <guid>property_001</guid>
    </item>
  </channel>
</rss>`;
    
    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);
  } catch (error) {
    res.status(500).send('Feed generation error');
  }
});

module.exports = router;