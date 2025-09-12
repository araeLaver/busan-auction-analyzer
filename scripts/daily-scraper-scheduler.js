#!/usr/bin/env node

const cron = require('node-cron');
const { ComprehensiveCourtScraper } = require('./comprehensive-court-scraper');
const { SmartDedupUpdater } = require('./smart-dedup-updater');
const pool = require('../config/database');
const fs = require('fs').promises;

/**
 * 매일 자동 법원경매정보 데이터 업데이트 스케줄러
 */
class DailyScraperScheduler {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.successCount = 0;
        this.errorCount = 0;
        this.logFile = 'logs/daily-scraper.log';
    }

    async init() {
        // 로그 디렉토리 생성
        try {
            await fs.mkdir('logs', { recursive: true });
        } catch (error) {
            // 이미 존재하는 경우 무시
        }

        await this.log('📅 매일 자동 스크래핑 스케줄러 초기화 완료');
        
        // 스케줄 설정
        this.setupSchedules();
        
        // 프로세스 종료 시 정리
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGTERM', () => this.gracefulShutdown());
    }

    setupSchedules() {
        // 매일 오전 6시에 실행
        cron.schedule('0 6 * * *', async () => {
            await this.runDailyUpdate('morning');
        });

        // 매일 오후 2시에 실행 (점심시간 이후)
        cron.schedule('0 14 * * *', async () => {
            await this.runDailyUpdate('afternoon');
        });

        // 매일 오후 8시에 실행
        cron.schedule('0 20 * * *', async () => {
            await this.runDailyUpdate('evening');
        });

        // 매시간 정각에 간단한 상태 확인
        cron.schedule('0 * * * *', async () => {
            await this.hourlyHealthCheck();
        });

        console.log('⏰ 스케줄 설정 완료:');
        console.log('   - 06:00 매일 아침 업데이트');
        console.log('   - 14:00 매일 오후 업데이트'); 
        console.log('   - 20:00 매일 저녁 업데이트');
        console.log('   - 매시간 상태 확인');
    }

    async runDailyUpdate(timeSlot = 'scheduled') {
        if (this.isRunning) {
            await this.log(`⚠️ 이미 실행 중이므로 ${timeSlot} 업데이트 건너뜀`);
            return;
        }

        this.isRunning = true;
        const startTime = new Date();
        
        try {
            await this.log(`🚀 ${timeSlot} 일일 업데이트 시작`);
            
            // 기존 데이터 백업
            await this.backupCurrentData();
            
            // 데이터 정리 작업 먼저 실행 (주 1회)
            const now = new Date();
            if (now.getDay() === 1 && timeSlot === 'morning') { // 월요일 아침
                await this.log('🧹 주간 데이터 정리 작업 실행');
                const updater = new SmartDedupUpdater();
                await updater.runMaintenance();
            }
            
            // 완전한 법원경매 스크래핑 실행
            const { CompleteCourtScraper } = require('./complete-court-scraper');
            const scraper = new CompleteCourtScraper();
            await scraper.run();
            
            // 데이터 품질 검증
            const qualityReport = await this.validateDataQuality();
            
            // 성공 로그
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            
            await this.log(`✅ ${timeSlot} 업데이트 성공 (소요시간: ${duration}초)`);
            await this.log(`📊 품질 보고서: ${JSON.stringify(qualityReport)}`);
            
            this.successCount++;
            this.lastRun = endTime;
            
            // 성공 알림
            await this.sendSuccessNotification(timeSlot, qualityReport, duration);
            
        } catch (error) {
            await this.log(`❌ ${timeSlot} 업데이트 실패: ${error.message}`);
            await this.log(`📋 스택 추적: ${error.stack}`);
            
            this.errorCount++;
            
            // 실패 알림
            await this.sendErrorNotification(timeSlot, error);
            
        } finally {
            this.isRunning = false;
        }
    }

    async backupCurrentData() {
        try {
            const backupQuery = `
                CREATE TABLE IF NOT EXISTS auction_service.properties_backup_${this.getDateString()} AS 
                SELECT * FROM auction_service.properties WHERE is_real_data = true
            `;
            
            await pool.query(backupQuery);
            await this.log('💾 현재 데이터 백업 완료');
            
        } catch (error) {
            await this.log(`⚠️ 데이터 백업 실패: ${error.message}`);
        }
    }

    async validateDataQuality() {
        try {
            const qualityQuery = `
                SELECT 
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN scraped_at::date = CURRENT_DATE THEN 1 END) as today_count,
                    COUNT(CASE WHEN address IS NOT NULL AND address != '' THEN 1 END) as valid_address_count,
                    COUNT(CASE WHEN minimum_sale_price > 0 THEN 1 END) as valid_price_count,
                    COUNT(DISTINCT court_name) as unique_courts,
                    COUNT(DISTINCT property_type) as unique_types,
                    AVG(CASE WHEN minimum_sale_price > 0 THEN minimum_sale_price END) as avg_price
                FROM auction_service.properties 
                WHERE is_real_data = true
            `;
            
            const result = await pool.query(qualityQuery);
            const quality = result.rows[0];
            
            // 데이터 품질 점수 계산
            const addressQuality = (quality.valid_address_count / quality.total_count) * 100;
            const priceQuality = (quality.valid_price_count / quality.total_count) * 100;
            
            const report = {
                total_count: parseInt(quality.total_count),
                today_count: parseInt(quality.today_count),
                address_quality: Math.round(addressQuality),
                price_quality: Math.round(priceQuality),
                unique_courts: parseInt(quality.unique_courts),
                unique_types: parseInt(quality.unique_types),
                avg_price: Math.round(quality.avg_price || 0),
                overall_quality: Math.round((addressQuality + priceQuality) / 2)
            };
            
            return report;
            
        } catch (error) {
            await this.log(`⚠️ 데이터 품질 검증 실패: ${error.message}`);
            return { error: error.message };
        }
    }

    async hourlyHealthCheck() {
        try {
            // 데이터베이스 연결 확인
            await pool.query('SELECT 1');
            
            // 최근 데이터 확인
            const recentDataQuery = `
                SELECT COUNT(*) as count
                FROM auction_service.properties 
                WHERE scraped_at >= NOW() - INTERVAL '24 hours'
                AND is_real_data = true
            `;
            
            const result = await pool.query(recentDataQuery);
            const recentCount = result.rows[0].count;
            
            if (recentCount === 0 && this.lastRun && 
                (new Date() - this.lastRun) > 25 * 60 * 60 * 1000) { // 25시간 이상
                await this.log('⚠️ 24시간 이상 새로운 데이터가 없습니다.');
            }
            
        } catch (error) {
            await this.log(`❌ 상태 확인 실패: ${error.message}`);
        }
    }

    async sendSuccessNotification(timeSlot, qualityReport, duration) {
        const notification = {
            type: 'success',
            timeSlot: timeSlot,
            timestamp: new Date().toISOString(),
            duration: duration,
            data: qualityReport,
            successCount: this.successCount,
            errorCount: this.errorCount
        };

        await this.log(`🔔 성공 알림: ${JSON.stringify(notification)}`);
        
        // 여기에 실제 알림 로직 추가 (이메일, 슬랙 등)
        // await this.sendToNotificationService(notification);
    }

    async sendErrorNotification(timeSlot, error) {
        const notification = {
            type: 'error',
            timeSlot: timeSlot,
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            successCount: this.successCount,
            errorCount: this.errorCount
        };

        await this.log(`🚨 오류 알림: ${JSON.stringify(notification)}`);
        
        // 여기에 실제 알림 로직 추가 (이메일, 슬랙 등)
        // await this.sendToNotificationService(notification);
    }

    async log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        
        console.log(logMessage);
        
        try {
            await fs.appendFile(this.logFile, logMessage + '\n');
        } catch (error) {
            console.error('로그 저장 실패:', error.message);
        }
    }

    getDateString() {
        return new Date().toISOString().split('T')[0].replace(/-/g, '');
    }

    async gracefulShutdown() {
        await this.log('🛑 스케줄러 종료 중...');
        
        if (this.isRunning) {
            await this.log('⏳ 현재 실행 중인 작업 완료 대기...');
            // 실행 중인 작업이 완료될 때까지 대기
            while (this.isRunning) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        await this.log('✅ 스케줄러 정상 종료');
        process.exit(0);
    }

    async getStatus() {
        const status = {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            successCount: this.successCount,
            errorCount: this.errorCount,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };

        return status;
    }

    // 수동 실행 메서드
    async runManualUpdate() {
        if (this.isRunning) {
            throw new Error('이미 실행 중입니다.');
        }
        
        await this.runDailyUpdate('manual');
    }
}

// CLI 실행
if (require.main === module) {
    const scheduler = new DailyScraperScheduler();
    
    const command = process.argv[2];
    
    if (command === 'run-now') {
        // 즉시 수동 실행
        scheduler.runManualUpdate()
            .then(() => {
                console.log('✅ 수동 업데이트 완료');
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ 수동 업데이트 실패:', error.message);
                process.exit(1);
            });
            
    } else if (command === 'status') {
        // 상태 확인
        scheduler.getStatus()
            .then(status => {
                console.log('📊 스케줄러 상태:', JSON.stringify(status, null, 2));
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ 상태 확인 실패:', error.message);
                process.exit(1);
            });
            
    } else {
        // 스케줄러 시작
        scheduler.init()
            .then(() => {
                console.log('🎯 매일 자동 스크래핑 스케줄러 시작됨');
                console.log('   사용법:');
                console.log('   - node daily-scraper-scheduler.js          : 스케줄러 시작');  
                console.log('   - node daily-scraper-scheduler.js run-now  : 즉시 실행');
                console.log('   - node daily-scraper-scheduler.js status   : 상태 확인');
                console.log('\n⏰ Ctrl+C로 종료');
            })
            .catch(error => {
                console.error('❌ 스케줄러 시작 실패:', error.message);
                process.exit(1);
            });
    }
}

module.exports = { DailyScraperScheduler };