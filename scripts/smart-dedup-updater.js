#!/usr/bin/env node

const pool = require('../config/database');
const crypto = require('crypto');

/**
 * 중복 방지 스마트 업데이터
 * 기존 데이터와 비교하여 변경된 내용만 업데이트
 */
class SmartDedupUpdater {
    constructor() {
        this.duplicateCount = 0;
        this.updatedCount = 0;
        this.newCount = 0;
        this.skippedCount = 0;
        this.hashCache = new Map();
    }

    /**
     * 데이터 해시 생성 (중복 검사용)
     */
    generateDataHash(property) {
        const hashData = {
            case_number: property.case_number?.trim() || '',
            address: property.address?.trim() || '',
            appraisal_value: property.appraisal_value || 0,
            minimum_sale_price: property.minimum_sale_price || 0,
            auction_date: property.auction_date || '',
            current_status: property.current_status || ''
        };
        
        const hashString = JSON.stringify(hashData, Object.keys(hashData).sort());
        return crypto.createHash('md5').update(hashString).digest('hex');
    }

    /**
     * 기존 데이터 로드 및 해시 캐시 생성
     */
    async loadExistingDataHashes() {
        console.log('📂 기존 데이터 해시 캐시 생성 중...');
        
        const query = `
            SELECT 
                case_number,
                address,
                appraisal_value,
                minimum_sale_price,
                auction_date,
                current_status,
                scraped_at,
                data_hash
            FROM auction_service.properties 
            WHERE is_real_data = true
        `;
        
        const result = await pool.query(query);
        const existingData = result.rows;
        
        console.log(`📊 기존 데이터 ${existingData.length}개 로드`);
        
        // 해시 캐시 생성
        for (const item of existingData) {
            const currentHash = item.data_hash || this.generateDataHash(item);
            this.hashCache.set(item.case_number, {
                hash: currentHash,
                scraped_at: item.scraped_at,
                data: item
            });
        }
        
        console.log('✅ 해시 캐시 생성 완료');
    }

    /**
     * 스마트 업데이트 실행
     */
    async processSmartUpdate(newProperties, sourceUrl = 'manual') {
        console.log(`🔄 스마트 업데이트 시작: ${newProperties.length}개 데이터 처리`);
        
        // 기존 데이터 로드
        await this.loadExistingDataHashes();
        
        // 각 데이터별 처리
        for (const property of newProperties) {
            await this.processProperty(property, sourceUrl);
        }
        
        // 결과 요약
        await this.printUpdateSummary();
        
        return {
            new: this.newCount,
            updated: this.updatedCount,
            duplicate: this.duplicateCount,
            skipped: this.skippedCount,
            total: newProperties.length
        };
    }

    /**
     * 개별 물건 처리
     */
    async processProperty(property, sourceUrl) {
        try {
            const caseNumber = property.case_number?.trim();
            if (!caseNumber || caseNumber.length < 3) {
                this.skippedCount++;
                return;
            }

            // 새 데이터 해시 생성
            const newHash = this.generateDataHash(property);
            const existing = this.hashCache.get(caseNumber);

            if (!existing) {
                // 신규 데이터
                await this.insertNewProperty(property, sourceUrl, newHash);
                this.newCount++;
                
            } else if (existing.hash !== newHash) {
                // 변경된 데이터
                await this.updateExistingProperty(property, sourceUrl, newHash);
                this.updatedCount++;
                
            } else {
                // 중복 (변경없음)
                await this.touchExistingProperty(caseNumber);
                this.duplicateCount++;
            }

        } catch (error) {
            console.error(`⚠️ 처리 실패 (${property.case_number}):`, error.message);
            this.skippedCount++;
        }
    }

    /**
     * 신규 데이터 삽입
     */
    async insertNewProperty(property, sourceUrl, dataHash) {
        const insertQuery = `
            INSERT INTO auction_service.properties (
                case_number, court_name, property_type, address, 
                appraisal_value, minimum_sale_price, auction_date,
                current_status, source_url, scraped_at, is_real_data, data_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        await pool.query(insertQuery, [
            property.case_number,
            property.court_name || '정보없음',
            property.property_type || '기타',
            property.address || '',
            property.appraisal_value || 0,
            property.minimum_sale_price || 0,
            property.auction_date || null,
            property.current_status || 'active',
            sourceUrl,
            new Date(),
            true,
            dataHash
        ]);

        if (this.newCount % 100 === 0) {
            console.log(`   ✨ 신규 ${this.newCount}개 추가...`);
        }
    }

    /**
     * 기존 데이터 업데이트
     */
    async updateExistingProperty(property, sourceUrl, dataHash) {
        const updateQuery = `
            UPDATE auction_service.properties SET
                court_name = $2,
                property_type = $3,
                address = $4,
                appraisal_value = $5,
                minimum_sale_price = $6,
                auction_date = $7,
                current_status = $8,
                source_url = $9,
                scraped_at = $10,
                data_hash = $11,
                updated_count = COALESCE(updated_count, 0) + 1
            WHERE case_number = $1 AND is_real_data = true
        `;

        await pool.query(updateQuery, [
            property.case_number,
            property.court_name || '정보없음',
            property.property_type || '기타', 
            property.address || '',
            property.appraisal_value || 0,
            property.minimum_sale_price || 0,
            property.auction_date || null,
            property.current_status || 'active',
            sourceUrl,
            new Date(),
            dataHash
        ]);

        if (this.updatedCount % 50 === 0) {
            console.log(`   🔄 업데이트 ${this.updatedCount}개 완료...`);
        }
    }

    /**
     * 기존 데이터 터치 (마지막 확인 시간 업데이트)
     */
    async touchExistingProperty(caseNumber) {
        const touchQuery = `
            UPDATE auction_service.properties SET
                last_checked_at = $2,
                check_count = COALESCE(check_count, 0) + 1
            WHERE case_number = $1 AND is_real_data = true
        `;

        await pool.query(touchQuery, [
            caseNumber,
            new Date()
        ]);
    }

    /**
     * 오래된 데이터 비활성화 (30일 이상 업데이트되지 않은 데이터)
     */
    async deactivateStaleData() {
        console.log('🧹 오래된 데이터 비활성화 중...');
        
        const deactivateQuery = `
            UPDATE auction_service.properties SET
                current_status = 'inactive',
                deactivated_at = NOW()
            WHERE is_real_data = true 
                AND current_status = 'active'
                AND (
                    last_checked_at IS NULL OR 
                    last_checked_at < NOW() - INTERVAL '30 days'
                )
                AND scraped_at < NOW() - INTERVAL '30 days'
        `;

        const result = await pool.query(deactivateQuery);
        
        console.log(`🗑️  ${result.rowCount}개 오래된 데이터 비활성화`);
        return result.rowCount;
    }

    /**
     * 완전 중복 데이터 제거
     */
    async removeDuplicates() {
        console.log('🔍 완전 중복 데이터 검사 및 제거...');
        
        // 동일한 주소와 사건번호를 가진 중복 데이터 찾기
        const duplicateQuery = `
            WITH duplicates AS (
                SELECT 
                    case_number,
                    address,
                    COUNT(*) as count,
                    MIN(id) as keep_id
                FROM auction_service.properties 
                WHERE is_real_data = true
                GROUP BY case_number, address
                HAVING COUNT(*) > 1
            )
            DELETE FROM auction_service.properties p
            WHERE p.is_real_data = true
                AND EXISTS (
                    SELECT 1 FROM duplicates d 
                    WHERE d.case_number = p.case_number 
                        AND d.address = p.address 
                        AND p.id != d.keep_id
                )
        `;

        const result = await pool.query(duplicateQuery);
        
        console.log(`🗑️  ${result.rowCount}개 완전 중복 데이터 제거`);
        return result.rowCount;
    }

    /**
     * 데이터 해시 컬럼 추가 (마이그레이션)
     */
    async ensureHashColumn() {
        try {
            await pool.query(`
                ALTER TABLE auction_service.properties 
                ADD COLUMN IF NOT EXISTS data_hash VARCHAR(32)
            `);
            
            await pool.query(`
                ALTER TABLE auction_service.properties 
                ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP
            `);
            
            await pool.query(`
                ALTER TABLE auction_service.properties 
                ADD COLUMN IF NOT EXISTS check_count INTEGER DEFAULT 0
            `);
            
            await pool.query(`
                ALTER TABLE auction_service.properties 
                ADD COLUMN IF NOT EXISTS updated_count INTEGER DEFAULT 0
            `);
            
            await pool.query(`
                ALTER TABLE auction_service.properties 
                ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP
            `);

            console.log('✅ 필요한 컬럼들이 확인/추가됨');
            
        } catch (error) {
            console.error('⚠️ 컬럼 추가 중 오류:', error.message);
        }
    }

    /**
     * 기존 데이터의 해시 값 생성 (초기 실행용)
     */
    async generateHashesForExistingData() {
        console.log('🔨 기존 데이터 해시 생성 중...');
        
        const query = `
            SELECT id, case_number, address, appraisal_value, 
                   minimum_sale_price, auction_date, current_status
            FROM auction_service.properties 
            WHERE is_real_data = true AND data_hash IS NULL
        `;
        
        const result = await pool.query(query);
        const items = result.rows;
        
        console.log(`📊 해시 생성 대상: ${items.length}개`);
        
        for (const item of items) {
            const hash = this.generateDataHash(item);
            
            await pool.query(
                'UPDATE auction_service.properties SET data_hash = $1 WHERE id = $2',
                [hash, item.id]
            );
        }
        
        console.log('✅ 기존 데이터 해시 생성 완료');
    }

    /**
     * 업데이트 결과 요약
     */
    async printUpdateSummary() {
        // 통계 조회
        const statsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN scraped_at::date = CURRENT_DATE THEN 1 END) as today_new,
                COUNT(CASE WHEN last_checked_at::date = CURRENT_DATE THEN 1 END) as today_checked,
                COUNT(CASE WHEN current_status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN current_status = 'inactive' THEN 1 END) as inactive,
                AVG(COALESCE(check_count, 0)) as avg_checks,
                AVG(COALESCE(updated_count, 0)) as avg_updates
            FROM auction_service.properties 
            WHERE is_real_data = true
        `;
        
        const statsResult = await pool.query(statsQuery);
        const stats = statsResult.rows[0];

        console.log('\n📊 스마트 업데이트 결과 요약');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✨ 신규 추가: ${this.newCount}개`);
        console.log(`🔄 업데이트: ${this.updatedCount}개`);
        console.log(`🔄 중복(변경없음): ${this.duplicateCount}개`);
        console.log(`⚠️ 스킵: ${this.skippedCount}개`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 총 데이터: ${stats.total}개`);
        console.log(`📊 오늘 신규: ${stats.today_new}개`);
        console.log(`📊 오늘 확인: ${stats.today_checked}개`);
        console.log(`🟢 활성: ${stats.active}개`);
        console.log(`🔴 비활성: ${stats.inactive}개`);
        console.log(`📈 평균 확인 횟수: ${Math.round(stats.avg_checks)}회`);
        console.log(`📈 평균 업데이트 횟수: ${Math.round(stats.avg_updates)}회`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * 전체 정리 작업 실행
     */
    async runMaintenance() {
        console.log('🧹 데이터 정리 작업 시작');
        
        await this.ensureHashColumn();
        await this.generateHashesForExistingData();
        const duplicatesRemoved = await this.removeDuplicates();
        const staleDeactivated = await this.deactivateStaleData();
        
        console.log(`✅ 정리 작업 완료: 중복 ${duplicatesRemoved}개 제거, 오래된 데이터 ${staleDeactivated}개 비활성화`);
        
        return { duplicatesRemoved, staleDeactivated };
    }
}

// CLI 실행
if (require.main === module) {
    const updater = new SmartDedupUpdater();
    const command = process.argv[2];
    
    if (command === 'maintenance') {
        // 정리 작업 실행
        updater.runMaintenance()
            .then(result => {
                console.log('✅ 정리 작업 완료:', result);
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ 정리 작업 실패:', error.message);
                process.exit(1);
            });
            
    } else if (command === 'hash-init') {
        // 기존 데이터 해시 초기화
        updater.ensureHashColumn()
            .then(() => updater.generateHashesForExistingData())
            .then(() => {
                console.log('✅ 해시 초기화 완료');
                process.exit(0);
            })
            .catch(error => {
                console.error('❌ 해시 초기화 실패:', error.message);
                process.exit(1);
            });
            
    } else {
        console.log('🔄 스마트 중복 방지 업데이터');
        console.log('사용법:');
        console.log('  node smart-dedup-updater.js maintenance  : 전체 정리 작업');
        console.log('  node smart-dedup-updater.js hash-init    : 해시 초기화');
        console.log('\n이 모듈은 다른 스크립트에서 import하여 사용됩니다.');
    }
}

module.exports = { SmartDedupUpdater };