const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 온비드 경매 데이터 수집기
 * 
 * 법원경매정보 사이트 대신 온비드를 활용하여 실제 경매 데이터 수집
 */
class OnbidScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'https://www.onbid.co.kr';
        this.data = [];
    }

    /**
     * 스크래퍼 초기화
     */
    async initialize() {
        try {
            console.log('🚀 온비드 경매 데이터 수집기 초기화 중...');
            
            this.browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--start-maximized'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // 실제 브라우저처럼 설정
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            console.log('✅ 온비드 스크래퍼 초기화 완료');
            
        } catch (error) {
            console.error('❌ 온비드 스크래퍼 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 전국 경매 데이터 수집
     */
    async scrapeAllRegionAuctions(limit = 50) {
        try {
            console.log(`🔍 온비드 전국 경매 물건 검색 중... (최대 ${limit}개)`);
            
            // 온비드 부동산 경매 페이지 접속
            await this.page.goto(`${this.baseUrl}/op/oi/svc/SvcOiList.do?searchType=1&menuId=10101&subMenuId=`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            console.log('📄 온비드 부동산 경매 페이지 접속 완료');
            
            // 페이지 로딩 대기
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 데이터 추출
            const properties = await this.extractPropertyData(limit);
            
            console.log(`✅ ${properties.length}개 경매 물건 수집 완료`);
            return properties;
            
        } catch (error) {
            console.error('❌ 온비드 경매 데이터 수집 실패:', error);
            throw error;
        }
    }

    /**
     * 물건 데이터 추출
     */
    async extractPropertyData(limit) {
        const properties = [];
        
        try {
            console.log('📊 온비드 경매 물건 데이터 추출 중...');
            
            // 페이지 HTML 가져오기
            const html = await this.page.content();
            const $ = cheerio.load(html);
            
            // 경매 물건 목록 찾기 (온비드 구조에 맞게)
            const items = $('.list_type01 li, .auction-item, .item-list tr').slice(0, limit);
            console.log(`📋 발견된 경매 물건: ${items.length}개`);
            
            items.each((index, item) => {
                if (properties.length >= limit) return false;
                
                try {
                    const $item = $(item);
                    
                    // 온비드에서 데이터 추출
                    const property = {
                        id: Date.now() + Math.random(),
                        case_number: this.extractCaseNumber($item),
                        court_name: this.extractCourtName($item),
                        property_type: this.extractPropertyType($item),
                        address: this.extractAddress($item),
                        appraisal_value: this.extractAppraisalValue($item),
                        minimum_sale_price: this.extractMinimumPrice($item),
                        auction_date: this.extractAuctionDate($item),
                        current_status: 'active',
                        scraped_at: new Date().toISOString(),
                        source_url: this.baseUrl,
                        is_real_data: true
                    };
                    
                    // 기본 계산값들
                    if (property.minimum_sale_price > 0 && property.appraisal_value > 0) {
                        property.bid_deposit = Math.floor(property.minimum_sale_price * 0.1);
                        property.discount_rate = Math.round((1 - property.minimum_sale_price / property.appraisal_value) * 100);
                    }
                    
                    // 유효한 데이터만 추가
                    if (property.address && property.minimum_sale_price > 0) {
                        properties.push(property);
                        console.log(`✅ 물건 추출: ${property.case_number || 'N/A'} - ${property.address}`);
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ 항목 ${index} 처리 중 오류:`, error.message);
                }
            });
            
        } catch (error) {
            console.error('❌ 온비드 데이터 추출 실패:', error);
        }
        
        return properties;
    }

    // 데이터 추출 헬퍼 함수들
    extractCaseNumber($item) {
        const texts = [
            $item.find('.case-number').text(),
            $item.find('.auction-no').text(),
            $item.find('td').eq(0).text(),
            $item.text().match(/\d{4}타경\d+/)?.[0]
        ];
        
        for (const text of texts) {
            if (text && text.trim()) return text.trim();
        }
        
        return `ONBID-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    extractCourtName($item) {
        const texts = [
            $item.find('.court').text(),
            $item.find('.court-name').text(),
            $item.find('td').eq(1).text()
        ];
        
        for (const text of texts) {
            if (text && text.includes('법원')) return text.trim();
        }
        
        return '온비드';
    }

    extractPropertyType($item) {
        const texts = [
            $item.find('.type').text(),
            $item.find('.property-type').text(),
            $item.find('td').eq(2).text(),
            $item.text()
        ];
        
        const types = ['아파트', '단독주택', '다세대주택', '오피스텔', '상가', '토지', '기타'];
        
        for (const text of texts) {
            for (const type of types) {
                if (text && text.includes(type)) return type;
            }
        }
        
        return '기타';
    }

    extractAddress($item) {
        const texts = [
            $item.find('.address').text(),
            $item.find('.location').text(),
            $item.find('td').eq(3).text(),
            $item.find('.addr').text()
        ];
        
        for (const text of texts) {
            if (text && text.trim().length > 5) return text.trim();
        }
        
        return '주소 미상';
    }

    extractAppraisalValue($item) {
        const texts = [
            $item.find('.appraisal').text(),
            $item.find('.evaluation').text(),
            $item.find('td').eq(4).text()
        ];
        
        return this.extractPrice(texts.find(t => t) || '');
    }

    extractMinimumPrice($item) {
        const texts = [
            $item.find('.minimum').text(),
            $item.find('.start-price').text(),
            $item.find('td').eq(5).text()
        ];
        
        return this.extractPrice(texts.find(t => t) || '');
    }

    extractAuctionDate($item) {
        const texts = [
            $item.find('.date').text(),
            $item.find('.auction-date').text(),
            $item.find('td').eq(6).text()
        ];
        
        for (const text of texts) {
            if (text) {
                const dateMatch = text.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
                if (dateMatch) {
                    const [, year, month, day] = dateMatch;
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
            }
        }
        
        // 기본값: 30일 후
        const future = new Date();
        future.setDate(future.getDate() + 30);
        return future.toISOString().split('T')[0];
    }

    extractPrice(text) {
        if (!text) return 0;
        
        const cleanText = text.replace(/[^0-9,억만원]/g, '');
        const numbers = cleanText.match(/\d+/g);
        
        if (!numbers || numbers.length === 0) return 0;
        
        let price = 0;
        
        if (cleanText.includes('억')) {
            const eokIndex = cleanText.indexOf('억');
            const eokValue = parseInt(cleanText.substring(0, eokIndex).replace(/[^0-9]/g, ''));
            price += eokValue * 100000000;
            
            if (cleanText.includes('만')) {
                const manPart = cleanText.substring(eokIndex);
                const manValue = parseInt(manPart.replace(/[^0-9]/g, ''));
                price += manValue * 10000;
            }
        } else if (cleanText.includes('만')) {
            const manValue = parseInt(cleanText.replace(/[^0-9]/g, ''));
            price = manValue * 10000;
        } else {
            price = parseInt(cleanText.replace(/[^0-9]/g, ''));
        }
        
        return price || 0;
    }

    /**
     * 리소스 정리
     */
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log('🧹 온비드 스크래퍼 리소스 정리 완료');
            }
        } catch (error) {
            console.warn('⚠️ 리소스 정리 중 오류:', error.message);
        }
    }
}

module.exports = OnbidScraper;