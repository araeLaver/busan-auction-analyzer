const CourtAuctionScraper = require('./src/scraper/CourtAuctionScraper');
const PropertyAnalyzer = require('./src/analyzer/PropertyAnalyzer');
const DailyScheduler = require('./src/scheduler/DailyScheduler');

// Express 서버 시작
require('./src/api/server');

// 메인 애플리케이션 클래스
class SeoulAuctionAnalyzer {
  constructor() {
    this.scraper = null;
    this.analyzer = null;
    this.scheduler = null;
  }

  async start() {
    console.log('🚀 서울경매 분석 서비스 시작...');
    
    try {
      // 스케줄러 시작
      this.scheduler = new DailyScheduler();
      this.scheduler.start();
      
      console.log('✅ 서비스가 성공적으로 시작되었습니다.');
      console.log('📅 자동 스크래핑: 매일 06:00, 14:00');
      console.log('📊 일일 리포트: 매일 23:00');
      console.log('🌐 웹 서비스: http://localhost:3000');
      
    } catch (error) {
      console.error('❌ 서비스 시작 오류:', error);
      process.exit(1);
    }
  }

  async runManualScraping() {
    console.log('🔧 수동 스크래핑 시작...');
    
    try {
      this.scraper = new CourtAuctionScraper();
      await this.scraper.initialize();
      
      const results = await this.scraper.scrapeSeoulAuctions();
      await this.scraper.close();
      
      console.log('✅ 수동 스크래핑 완료:', results);
      return results;
      
    } catch (error) {
      console.error('❌ 수동 스크래핑 오류:', error);
      if (this.scraper) {
        await this.scraper.close();
      }
      throw error;
    }
  }

  async runManualAnalysis() {
    console.log('🔧 수동 분석 시작...');
    
    try {
      this.analyzer = new PropertyAnalyzer();
      await this.analyzer.analyzeAllProperties();
      
      console.log('✅ 수동 분석 완료');
      
    } catch (error) {
      console.error('❌ 수동 분석 오류:', error);
      throw error;
    }
  }

  async runFullProcess() {
    console.log('🔧 전체 프로세스 수동 실행...');
    
    try {
      // 1. 스크래핑
      await this.runManualScraping();
      
      // 2. 분석
      await this.runManualAnalysis();
      
      // 3. 리포트 생성 (선택사항)
      if (this.scheduler) {
        await this.scheduler.generateReportNow();
      }
      
      console.log('✅ 전체 프로세스 완료');
      
    } catch (error) {
      console.error('❌ 전체 프로세스 오류:', error);
      throw error;
    }
  }

  stop() {
    console.log('🛑 서비스 중지...');
    
    if (this.scheduler) {
      this.scheduler.stop();
    }
    
    if (this.scraper) {
      this.scraper.close();
    }
    
    console.log('✅ 서비스가 중지되었습니다.');
  }
}

// CLI 명령어 처리
async function handleCommand() {
  const app = new SeoulAuctionAnalyzer();
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await app.start();
      break;
      
    case 'scrape':
      try {
        await app.runManualScraping();
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
      break;
      
    case 'analyze':
      try {
        await app.runManualAnalysis();
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
      break;
      
    case 'full':
      try {
        await app.runFullProcess();
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
      break;
      
    default:
      console.log(`
📋 서울경매 분석 서비스

사용법:
  node app.js start    - 서비스 시작 (웹서버 + 스케줄러)
  node app.js scrape   - 수동 스크래핑 실행
  node app.js analyze  - 수동 분석 실행  
  node app.js full     - 전체 프로세스 실행 (스크래핑 + 분석)

예시:
  node app.js start           # 서비스 시작
  node app.js scrape          # 즉시 스크래핑
  node app.js full            # 전체 실행
      `);
      break;
  }
}

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 서비스 종료 중...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 서비스 종료 중...');
  process.exit(0);
});

// 실행
if (require.main === module) {
  handleCommand().catch(error => {
    console.error('❌ 애플리케이션 오류:', error);
    process.exit(1);
  });
}

module.exports = SeoulAuctionAnalyzer;