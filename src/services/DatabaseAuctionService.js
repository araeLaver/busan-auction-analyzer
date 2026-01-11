const pool = require('../../config/database');

class DatabaseAuctionService {
    constructor() {
        this.serviceName = 'PostgreSQL Database Service';
        console.log(`🚀 ${this.serviceName} 초기화`);
    }
    
    async getDashboardStats() {
        try {
            const client = await pool.connect();
            
            try {
                // 대시보드 통계 직접 계산
                const statsQuery = `
                    SELECT
                        COUNT(*) FILTER (WHERE p.current_status = 'active') as total_active_properties,
                        COUNT(*) FILTER (WHERE DATE(p.created_at) = CURRENT_DATE) as new_today,
                        ROUND(AVG(ar.investment_score), 1) as avg_investment_score,
                        COUNT(*) FILTER (WHERE ar.investment_score >= 85) as excellent_properties,
                        COUNT(*) FILTER (WHERE ar.investment_grade = 'S') as s_grade_properties,
                        COUNT(*) FILTER (WHERE ar.investment_score >= 70) as good_properties,
                        COUNT(*) FILTER (WHERE DATE(p.auction_date) = CURRENT_DATE) as auctions_today,
                        COUNT(*) FILTER (WHERE p.auction_date BETWEEN NOW() AND NOW() + INTERVAL '7 days') as auctions_this_week
                    FROM properties p
                    LEFT JOIN analysis_results ar ON p.id = ar.property_id
                    WHERE p.current_status = 'active'
                `;
                const statsResult = await client.query(statsQuery);
                const stats = statsResult.rows[0] || {};
                
                // 추가 통계 계산
                const avgPriceResult = await client.query(`
                    SELECT
                        AVG(minimum_sale_price) as avg_price,
                        MIN(minimum_sale_price) as min_price,
                        MAX(minimum_sale_price) as max_price
                    FROM properties
                    WHERE current_status = $1
                `, ['active']);

                const priceStats = avgPriceResult.rows[0] || {};
                
                return {
                    total_properties: parseInt(stats.total_active_properties) || 0,
                    new_today: parseInt(stats.new_today) || 0,
                    avg_investment_score: parseFloat(stats.avg_investment_score) || 0,
                    excellent_properties: parseInt(stats.excellent_properties) || 0,
                    s_grade_properties: parseInt(stats.s_grade_properties) || 0,
                    good_properties: parseInt(stats.good_properties) || 0,
                    auctions_today: parseInt(stats.auctions_today) || 0,
                    auctions_this_week: parseInt(stats.auctions_this_week) || 0,
                    avg_price: parseInt(priceStats.avg_price) || 0,
                    min_price: parseInt(priceStats.min_price) || 0,
                    max_price: parseInt(priceStats.max_price) || 0,
                    last_updated: new Date(),
                    data_source: this.serviceName
                };
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ 대시보드 통계 조회 오류:', error);
            throw error;
        }
    }
    
    async getPropertiesList(page = 1, limit = 20, filters = {}) {
        try {
            const client = await pool.connect();
            
            try {
                const offset = (page - 1) * limit;
                
                // 필터 조건 구성
                let whereConditions = ['p.current_status = $1'];
                let queryParams = ['active'];
                let paramIndex = 2;
                
                if (filters.property_type) {
                    whereConditions.push(`p.property_type = $${paramIndex}`);
                    queryParams.push(filters.property_type);
                    paramIndex++;
                }
                
                if (filters.min_price) {
                    whereConditions.push(`p.minimum_sale_price >= $${paramIndex}`);
                    queryParams.push(filters.min_price);
                    paramIndex++;
                }
                
                if (filters.max_price) {
                    whereConditions.push(`p.minimum_sale_price <= $${paramIndex}`);
                    queryParams.push(filters.max_price);
                    paramIndex++;
                }
                
                if (filters.region) {
                    // 지역명에 따른 매칭 패턴 개선
                    let regionPattern = filters.region;
                    if (filters.region === '서울') {
                        regionPattern = '서울%';
                    } else if (filters.region === '부산') {
                        regionPattern = '부산%';
                    } else {
                        regionPattern = `%${filters.region}%`;
                    }
                    
                    whereConditions.push(`p.address LIKE $${paramIndex}`);
                    queryParams.push(regionPattern);
                    paramIndex++;
                }
                
                const whereClause = whereConditions.join(' AND ');
                
                // 전체 카운트 쿼리
                const countQuery = `
                    SELECT COUNT(*) as total 
                    FROM public.properties p 
                    WHERE ${whereClause}
                `;
                
                const countResult = await client.query(countQuery, queryParams);
                const totalCount = parseInt(countResult.rows[0].total);
                
                // 페이징된 데이터 쿼리 
                const dataQuery = `
                    SELECT 
                        p.*,
                        c.name as court_full_name,
                        ar.investment_score,
                        ar.investment_grade,
                        ar.profitability_score,
                        ar.risk_score,
                        ar.liquidity_score,
                        ar.location_score,
                        ar.roi_1year,
                        ar.roi_3year,
                        ar.success_probability,
                        ar.estimated_final_price,
                        ar.analyzed_at,
                        CASE 
                            WHEN p.appraisal_value IS NULL OR p.appraisal_value = 0 THEN 0
                            ELSE ROUND(((p.appraisal_value - p.minimum_sale_price)::numeric * 100.0) / p.appraisal_value::numeric, 2)
                        END AS calculated_discount_rate,
                        CASE 
                            WHEN ar.investment_score >= 85 THEN 'EXCELLENT'
                            WHEN ar.investment_score >= 70 THEN 'GOOD'
                            WHEN ar.investment_score >= 50 THEN 'AVERAGE'
                            ELSE 'POOR'
                        END as investment_category
                    FROM public.properties p
                    LEFT JOIN public.courts c ON p.court_id = c.id
                    LEFT JOIN public.analysis_results ar ON p.id = ar.property_id
                    WHERE ${whereClause}
                    ORDER BY p.created_at DESC, ar.investment_score DESC NULLS LAST
                    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
                `;
                
                queryParams.push(limit, offset);
                const dataResult = await client.query(dataQuery, queryParams);
                
                return {
                    properties: dataResult.rows.map(this.formatPropertyForAPI),
                    pagination: {
                        current_page: page,
                        total_pages: Math.ceil(totalCount / limit),
                        total_count: totalCount,
                        per_page: limit,
                        has_next: page < Math.ceil(totalCount / limit),
                        has_prev: page > 1
                    },
                    filters_applied: filters,
                    data_source: this.serviceName
                };
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ 물건 목록 조회 오류:', error);
            throw error;
        }
    }
    
    async getPropertyDetail(propertyId) {
        try {
            const client = await pool.connect();
            
            try {
                // propertyId가 숫자인지 case_number인지 확인
                const isNumericId = !isNaN(propertyId) && Number.isInteger(Number(propertyId));
                
                const query = `
                    SELECT 
                        p.*,
                        CASE 
                            WHEN p.discount_rate >= 0.3 THEN 'EXCELLENT'
                            WHEN p.discount_rate >= 0.2 THEN 'GOOD'
                            WHEN p.discount_rate >= 0.1 THEN 'AVERAGE'
                            ELSE 'POOR'
                        END as investment_category
                    FROM public.properties p
                    WHERE ${isNumericId ? 'p.id = $1' : 'p.case_number = $1'}
                `;
                
                const result = await client.query(query, [propertyId]);
                
                if (result.rows.length === 0) {
                    return null;
                }
                
                const property = result.rows[0];
                return this.formatPropertyForAPI(property);
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ 물건 상세 조회 오류:', error);
            throw error;
        }
    }
    
    formatPropertyForAPI(dbProperty) {
        return {
            id: dbProperty.id,
            case_number: dbProperty.case_number,
            item_number: dbProperty.item_number,
            court_name: dbProperty.court_full_name || dbProperty.court_name,
            property_type: dbProperty.property_type,
            address: dbProperty.address,
            building_name: dbProperty.building_name,
            building_year: dbProperty.building_year,
            floor_info: dbProperty.floor_info,
            area: parseFloat(dbProperty.area) || null,
            land_area: parseFloat(dbProperty.land_area) || null,
            building_area: parseFloat(dbProperty.building_area) || null,
            appraisal_value: parseInt(dbProperty.appraisal_value),
            minimum_sale_price: parseInt(dbProperty.minimum_sale_price),
            bid_deposit: parseInt(dbProperty.bid_deposit) || null,
            discount_rate: parseFloat(dbProperty.discount_rate) || parseFloat(dbProperty.calculated_discount_rate) || 0,
            auction_date: dbProperty.auction_date,
            auction_time: dbProperty.auction_time,
            failure_count: dbProperty.failure_count || 0,
            current_status: dbProperty.current_status,
            tenant_status: dbProperty.tenant_status,
            tenant_info: dbProperty.tenant_info,
            court_auction_url: dbProperty.source_url || `https://www.courtauction.go.kr/RetrieveRealEstateAuctionDetail.laf?saNo=${dbProperty.case_number.split('타경')[0]}0130${dbProperty.case_number.split('타경')[1]}`, // 대법원 상세 링크 추정 (사건번호 파싱 필요)
            // 실제 온비드 매물인지 확인 불가하므로, 통합 검색 링크로 제공하거나 제거
            onbid_url: null, 
            // 지지옥션 등 외부 링크는 실제 ID가 없으면 유효하지 않으므로 제거하거나 검색 페이지로 유도
            goodauction_url: `https://www.google.com/search?q=${encodeURIComponent(dbProperty.address + ' 경매')}`,
            ai_analysis: dbProperty.investment_score ? {
                investment_score: dbProperty.investment_score,
                investment_grade: dbProperty.investment_grade,
                investment_category: dbProperty.investment_category,
                profitability_score: dbProperty.profitability_score,
                risk_score: dbProperty.risk_score,
                liquidity_score: dbProperty.liquidity_score,
                location_score: dbProperty.location_score,
                roi_1year: parseFloat(dbProperty.roi_1year) || 0,
                roi_3year: parseFloat(dbProperty.roi_3year) || 0,
                success_probability: parseFloat(dbProperty.success_probability) || 0,
                estimated_final_price: parseInt(dbProperty.estimated_final_price) || 0,
                analyzed_at: dbProperty.analyzed_at
            } : null,
            is_dummy_data: false,
            data_description: "실제 경매 데이터입니다.",
            data_source: "PostgreSQL Database",
            scraped_at: dbProperty.scraped_at,
            created_at: dbProperty.created_at,
            updated_at: dbProperty.updated_at
        };
    }
    
    async getMarketTrends(region = null, propertyType = null) {
        try {
            const client = await pool.connect();
            
            try {
                let query = `
                    SELECT * FROM public.market_trends 
                    WHERE 1=1
                `;
                const params = [];
                let paramIndex = 1;
                
                if (region) {
                    query += ` AND region = $${paramIndex}`;
                    params.push(region);
                    paramIndex++;
                }
                
                if (propertyType) {
                    query += ` AND property_type = $${paramIndex}`;
                    params.push(propertyType);
                    paramIndex++;
                }
                
                query += ` ORDER BY year_month DESC LIMIT 12`;
                
                const result = await client.query(query, params);
                return result.rows;
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('❌ 시장 트렌드 조회 오류:', error);
            return [];
        }
    }
}

module.exports = DatabaseAuctionService;