/**
 * 부산경매 AI 분석 시스템 - 모던 JavaScript 애플리케이션
 * 
 * 주요 기능:
 * - 실시간 데이터 업데이트 (Socket.IO)
 * - AI 기반 필터링 및 정렬
 * - 인터랙티브 차트 및 시각화
 * - 반응형 UI 컴포넌트
 * - 성능 최적화된 렌더링
 */

class BusanAuctionApp {
    constructor() {
        this.apiBase = '/api';
        this.socket = null;
        this.properties = [];
        this.filteredProperties = [];
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 0;
        this.isLoading = false;
        
        // 차트 인스턴스
        this.charts = {
            gradeDistribution: null,
            regionScore: null
        };
        
        // 필터 상태
        this.filters = {
            type: '',
            region: '',
            minPrice: '',
            maxPrice: '',
            minScore: 50,
            grade: '',
            failureCount: '',
            auctionDate: '',
            roi: '',
            tenant: '',
            quickFilter: null
        };
        
        // 정렬 상태
        this.sortConfig = {
            field: 'investment_score',
            order: 'DESC'
        };
        
        this.init();
    }

    /**
     * 애플리케이션 초기화
     */
    async init() {
        console.log('🚀 부산경매 AI 분석 시스템 초기화 중...');
        
        try {
            await this.initializeSocket();
            await this.setupEventListeners();
            await this.loadInitialData();
            await this.initializeCharts();
            
            // 실시간 업데이트 시작
            this.startRealTimeUpdates();
            
            console.log('✅ 시스템 초기화 완료');
            
        } catch (error) {
            console.error('❌ 초기화 실패:', error);
            this.showError('시스템 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
        }
    }

    /**
     * Socket.IO 연결 초기화
     */
    async initializeSocket() {
        try {
            if (typeof io !== 'undefined') {
                this.socket = io();
                
                this.socket.on('connect', () => {
                    console.log('🔗 실시간 연결 성공');
                    this.updateConnectionStatus(true);
                });
                
                this.socket.on('disconnect', () => {
                    console.log('🔌 실시간 연결 끊김');
                    this.updateConnectionStatus(false);
                });
                
                this.socket.on('property-update', (data) => {
                    this.handlePropertyUpdate(data);
                });
                
                this.socket.on('market-update', (data) => {
                    this.handleMarketUpdate(data);
                });
                
                this.socket.on('analysis-complete', (data) => {
                    this.handleAnalysisComplete(data);
                });
                
            }
        } catch (error) {
            console.warn('⚠️ 실시간 연결 설정 실패 (Socket.IO 없음)');
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    async setupEventListeners() {
        // 필터 이벤트
        document.getElementById('filterScoreRange')?.addEventListener('input', (e) => {
            document.getElementById('filterScoreValue').textContent = e.target.value;
            this.filters.minScore = parseInt(e.target.value);
        });
        
        // 정렬 변경 이벤트
        document.getElementById('sortBy')?.addEventListener('change', (e) => {
            this.sortConfig.field = e.target.value;
            this.applyFiltersAndSort();
        });
        
        document.getElementById('sortOrder')?.addEventListener('change', (e) => {
            this.sortConfig.order = e.target.value;
            this.applyFiltersAndSort();
        });
        
        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('filterType')?.focus();
            }
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        
        // 윈도우 리사이즈
        window.addEventListener('resize', debounce(() => {
            this.resizeCharts();
        }, 250));
    }

    /**
     * 초기 데이터 로드
     */
    async loadInitialData() {
        this.showLoading(true);
        
        try {
            // 병렬로 데이터 로드
            const [dashboardData, propertiesData] = await Promise.all([
                this.fetchDashboardStats(),
                this.fetchProperties()
            ]);
            
            this.updateDashboard(dashboardData);
            this.properties = propertiesData.properties || [];
            this.applyFiltersAndSort();
            
        } catch (error) {
            console.error('❌ 초기 데이터 로드 실패:', error);
            this.showError('데이터를 불러오는데 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 대시보드 통계 데이터 조회
     */
    async fetchDashboardStats() {
        try {
            const response = await fetch(`${this.apiBase}/dashboard/stats`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('대시보드 데이터 조회 실패:', error);
            return this.getDefaultDashboardData();
        }
    }

    /**
     * 물건 목록 데이터 조회
     */
    async fetchProperties(page = 1, filters = {}) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pageSize.toString(),
                ...filters
            });
            
            const response = await fetch(`${this.apiBase}/properties?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error('물건 데이터 조회 실패:', error);
            return { properties: [], total: 0, page: 1 };
        }
    }

    /**
     * 대시보드 업데이트
     */
    updateDashboard(data) {
        // 기본 통계
        this.updateElement('totalProperties', this.formatNumber(data.total_active_properties));
        this.updateElement('newToday', this.formatNumber(data.new_today));
        this.updateElement('avgScore', data.avg_investment_score?.toFixed(1) || '--');
        this.updateElement('sGradeProperties', this.formatNumber(data.excellent_properties));
        
        // 평균 점수 바 업데이트
        const avgScore = data.avg_investment_score || 0;
        const scoreBar = document.getElementById('avgScoreBar');
        const scoreGrade = document.getElementById('avgScoreGrade');
        
        if (scoreBar && scoreGrade) {
            scoreBar.style.width = `${avgScore}%`;
            scoreBar.className = `score-fill ${this.getScoreClass(avgScore)}`;
            scoreGrade.textContent = this.getInvestmentGrade(avgScore);
            scoreGrade.className = `text-xs grade-${this.getInvestmentGrade(avgScore).toLowerCase()}`;
        }
        
        // 변화량 표시
        this.updateTrendIndicators(data);
        
        // 마지막 업데이트 시간
        this.updateElement('lastUpdate', this.formatDateTime(new Date()));
    }

    /**
     * 필터 및 정렬 적용
     */
    applyFiltersAndSort() {
        this.showLoading(true);
        
        try {
            // 필터링 적용
            this.filteredProperties = this.properties.filter(property => {
                return this.matchesFilters(property);
            });
            
            // 정렬 적용
            this.filteredProperties.sort((a, b) => {
                return this.compareProperties(a, b);
            });
            
            // 페이지네이션 계산
            this.totalPages = Math.ceil(this.filteredProperties.length / this.pageSize);
            this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
            
            // UI 업데이트
            this.updatePropertyList();
            this.updatePagination();
            this.updateFilterResultCount();
            
        } catch (error) {
            console.error('❌ 필터링/정렬 오류:', error);
            this.showError('필터 적용 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 필터 조건 매칭
     */
    matchesFilters(property) {
        const filters = this.filters;
        
        // 물건 유형
        if (filters.type && !property.property_type?.includes(filters.type)) {
            return false;
        }
        
        // 지역
        if (filters.region && !property.address?.includes(filters.region)) {
            return false;
        }
        
        // 가격 범위
        const minPrice = property.minimum_sale_price || 0;
        if (filters.minPrice && minPrice < filters.minPrice * 100000000) {
            return false;
        }
        if (filters.maxPrice && minPrice > filters.maxPrice * 100000000) {
            return false;
        }
        
        // AI 점수
        const score = property.investment_score || 0;
        if (filters.minScore && score < filters.minScore) {
            return false;
        }
        
        // 투자 등급
        if (filters.grade && this.getInvestmentGrade(score) !== filters.grade) {
            return false;
        }
        
        // 유찰 횟수
        if (filters.failureCount !== '' && property.failure_count > parseInt(filters.failureCount)) {
            return false;
        }
        
        // ROI
        if (filters.roi && (property.roi_1year || 0) < parseInt(filters.roi)) {
            return false;
        }
        
        // 임차인 현황
        if (filters.tenant && property.tenant_status !== filters.tenant) {
            return false;
        }
        
        // 입찰일 필터
        if (filters.auctionDate) {
            const days = parseInt(filters.auctionDate);
            const auctionDate = new Date(property.auction_date);
            const today = new Date();
            const diffDays = (auctionDate - today) / (1000 * 60 * 60 * 24);
            
            if (diffDays < 0 || diffDays > days) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 속성 비교 (정렬용)
     */
    compareProperties(a, b) {
        const { field, order } = this.sortConfig;
        let aValue = a[field];
        let bValue = b[field];
        
        // null/undefined 처리
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        
        // 날짜 처리
        if (field === 'auction_date') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }
        
        // 숫자 처리
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return order === 'ASC' ? aValue - bValue : bValue - aValue;
        }
        
        // 문자열 처리
        const comparison = String(aValue).localeCompare(String(bValue), 'ko');
        return order === 'ASC' ? comparison : -comparison;
    }

    /**
     * 물건 목록 UI 업데이트
     */
    updatePropertyList() {
        const container = document.getElementById('propertiesContainer');
        if (!container) return;
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageProperties = this.filteredProperties.slice(startIndex, endIndex);
        
        if (pageProperties.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        const html = pageProperties.map(property => this.createPropertyCard(property)).join('');
        container.innerHTML = html;
        
        // 카드 애니메이션
        this.animatePropertyCards();
    }

    /**
     * 물건 카드 HTML 생성
     */
    createPropertyCard(property) {
        const score = property.investment_score || 0;
        const grade = this.getInvestmentGrade(score);
        const gradeClass = `grade-${grade.toLowerCase()}`;
        const scoreClass = this.getScoreClass(score);
        
        const discountRate = this.calculateDiscountRate(property);
        const roi = property.roi_1year || 0;
        const pricePerSqm = property.building_area ? 
            Math.round(property.minimum_sale_price / property.building_area / 10000) : 0;
        
        return `
            <div class="property-card bg-white rounded-xl shadow-md p-6 mb-4 border border-gray-100" 
                 onclick="showPropertyDetail(${property.id})">
                <!-- 헤더 -->
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <h3 class="text-lg font-bold text-gray-900 truncate">${property.address || '주소 정보 없음'}</h3>
                            <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">${property.property_type || '기타'}</span>
                        </div>
                        <p class="text-sm text-gray-600">${property.case_number || ''} ${property.item_number || ''}</p>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="text-2xl font-bold ${gradeClass}">${grade}</span>
                            <span class="text-lg font-semibold text-gray-900">${score}점</span>
                        </div>
                        <div class="text-xs text-gray-500">AI 투자점수</div>
                    </div>
                </div>
                
                <!-- AI 점수 바 -->
                <div class="mb-4">
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span>AI 분석 점수</span>
                        <span>${score}/100</span>
                    </div>
                    <div class="score-bar">
                        <div class="score-fill ${scoreClass}" style="width: ${score}%"></div>
                    </div>
                </div>
                
                <!-- 주요 정보 그리드 -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div class="text-center">
                        <div class="text-lg font-bold text-blue-600">${this.formatPrice(property.minimum_sale_price)}</div>
                        <div class="text-xs text-gray-500">최저매각가</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-green-600">${discountRate.toFixed(1)}%</div>
                        <div class="text-xs text-gray-500">할인율</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-purple-600">${roi.toFixed(1)}%</div>
                        <div class="text-xs text-gray-500">예상 ROI</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-orange-600">${pricePerSqm.toLocaleString()}</div>
                        <div class="text-xs text-gray-500">만원/평</div>
                    </div>
                </div>
                
                <!-- 세부 분석 점수 -->
                <div class="grid grid-cols-3 gap-3 mb-4 text-xs">
                    <div class="text-center">
                        <div class="font-semibold text-gray-700">${property.location_score || 0}</div>
                        <div class="text-gray-500">입지</div>
                    </div>
                    <div class="text-center">
                        <div class="font-semibold text-gray-700">${100 - (property.legal_risk_score || 0)}</div>
                        <div class="text-gray-500">안전성</div>
                    </div>
                    <div class="text-center">
                        <div class="font-semibold text-gray-700">${property.market_trend_score || 0}</div>
                        <div class="text-gray-500">시장성</div>
                    </div>
                </div>
                
                <!-- 하단 정보 -->
                <div class="flex justify-between items-center text-sm pt-3 border-t border-gray-100">
                    <div class="flex items-center space-x-4">
                        <span class="text-gray-600">
                            <i class="fas fa-calendar-alt mr-1"></i>
                            ${this.formatDate(property.auction_date)}
                        </span>
                        ${property.failure_count ? `
                            <span class="text-red-600">
                                <i class="fas fa-exclamation-triangle mr-1"></i>
                                유찰 ${property.failure_count}회
                            </span>
                        ` : ''}
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="event.stopPropagation(); showMap('${property.address}')" 
                                class="text-gray-400 hover:text-blue-600 transition-colors">
                            <i class="fas fa-map-marker-alt"></i>
                        </button>
                        <button onclick="event.stopPropagation(); addToWatchlist(${property.id})" 
                                class="text-gray-400 hover:text-yellow-600 transition-colors">
                            <i class="fas fa-star"></i>
                        </button>
                        <button onclick="event.stopPropagation(); shareProperty(${property.id})" 
                                class="text-gray-400 hover:text-green-600 transition-colors">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
                
                <!-- 특이사항 -->
                ${property.special_notes ? `
                    <div class="mt-3 p-2 bg-yellow-50 rounded-lg">
                        <div class="text-xs text-yellow-800">
                            <i class="fas fa-info-circle mr-1"></i>
                            ${property.special_notes}
                        </div>
                    </div>
                ` : ''}
                
                <!-- AI 예측 -->
                ${property.success_probability ? `
                    <div class="mt-3 p-2 bg-blue-50 rounded-lg">
                        <div class="text-xs text-blue-800 flex items-center justify-between">
                            <span>
                                <i class="fas fa-brain mr-1"></i>
                                AI 예측: 낙찰확률 ${property.success_probability?.toFixed(1)}%
                            </span>
                            <span>예상낙찰가 ${this.formatPrice(property.estimated_final_price)}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 차트 초기화
     */
    async initializeCharts() {
        try {
            // 투자 등급 분포 차트
            await this.initGradeDistributionChart();
            
            // 지역별 점수 차트
            await this.initRegionScoreChart();
            
        } catch (error) {
            console.error('❌ 차트 초기화 실패:', error);
        }
    }

    /**
     * 투자 등급 분포 차트
     */
    async initGradeDistributionChart() {
        const ctx = document.getElementById('gradeDistributionChart');
        if (!ctx) return;
        
        const gradeData = this.calculateGradeDistribution();
        
        this.charts.gradeDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['S급', 'A급', 'B급', 'C급', 'D급'],
                datasets: [{
                    data: [gradeData.S, gradeData.A, gradeData.B, gradeData.C, gradeData.D],
                    backgroundColor: [
                        '#10b981',  // S급 - 녹색
                        '#3b82f6',  // A급 - 파랑
                        '#f59e0b',  // B급 - 노랑
                        '#ef4444',  // C급 - 빨강
                        '#6b7280'   // D급 - 회색
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value}개 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 지역별 평균 점수 차트
     */
    async initRegionScoreChart() {
        const ctx = document.getElementById('regionScoreChart');
        if (!ctx) return;
        
        const regionData = this.calculateRegionScores();
        
        this.charts.regionScore = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: regionData.labels,
                datasets: [{
                    label: '평균 AI 점수',
                    data: regionData.scores,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            font: {
                                size: 10
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `평균 점수: ${context.parsed.y.toFixed(1)}점`;
                            }
                        }
                    }
                }
            }
        });
    }

    // === 유틸리티 메서드들 ===

    /**
     * 투자 등급 계산
     */
    getInvestmentGrade(score) {
        if (score >= 85) return 'S';
        if (score >= 70) return 'A';
        if (score >= 55) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    }

    /**
     * 점수 클래스 반환
     */
    getScoreClass(score) {
        if (score >= 80) return 'score-excellent';
        if (score >= 60) return 'score-good';
        if (score >= 40) return 'score-fair';
        return 'score-poor';
    }

    /**
     * 할인율 계산
     */
    calculateDiscountRate(property) {
        if (!property.appraisal_value || !property.minimum_sale_price) return 0;
        return ((property.appraisal_value - property.minimum_sale_price) / property.appraisal_value) * 100;
    }

    /**
     * 가격 포맷팅
     */
    formatPrice(price) {
        if (!price) return '미정';
        
        const oku = Math.floor(price / 100000000);
        const man = Math.floor((price % 100000000) / 10000);
        
        if (oku > 0) {
            return man > 0 ? `${oku}억 ${man.toLocaleString()}만원` : `${oku}억원`;
        } else {
            return `${man.toLocaleString()}만원`;
        }
    }

    /**
     * 날짜 포맷팅
     */
    formatDate(dateString) {
        if (!dateString) return '미정';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * 날짜시간 포맷팅
     */
    formatDateTime(date) {
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 숫자 포맷팅
     */
    formatNumber(num) {
        if (num == null) return '--';
        return num.toLocaleString();
    }

    /**
     * 로딩 상태 표시/숨김
     */
    showLoading(show) {
        const container = document.getElementById('propertiesContainer');
        if (!container) return;
        
        this.isLoading = show;
        
        if (show) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="loading-spinner mx-auto mb-4"></div>
                    <p class="text-gray-500">데이터를 불러오는 중...</p>
                </div>
            `;
        }
    }

    /**
     * 에러 메시지 표시
     */
    showError(message) {
        console.error('Error:', message);
        
        // 토스트 알림으로 표시
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transition-all duration-300';
        toast.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-red-200 hover:text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    /**
     * Element 업데이트 헬퍼
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * 연결 상태 업데이트
     */
    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.w-2.h-2.bg-green-400');
        if (statusElement) {
            statusElement.className = connected ? 
                'w-2 h-2 bg-green-400 rounded-full animate-pulse-slow' :
                'w-2 h-2 bg-red-400 rounded-full';
        }
        
        const statusText = statusElement?.nextElementSibling;
        if (statusText) {
            statusText.textContent = connected ? '실시간 연결' : '연결 끊김';
        }
    }

    /**
     * 기본 대시보드 데이터
     */
    getDefaultDashboardData() {
        return {
            total_active_properties: 0,
            new_today: 0,
            avg_investment_score: 0,
            excellent_properties: 0,
            auctions_today: 0,
            auctions_this_week: 0
        };
    }

    /**
     * 빈 상태 HTML
     */
    getEmptyStateHTML() {
        return `
            <div class="text-center py-12">
                <div class="text-6xl text-gray-300 mb-4">
                    <i class="fas fa-search"></i>
                </div>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">검색 결과가 없습니다</h3>
                <p class="text-gray-500 mb-6">필터 조건을 조정해서 다시 검색해보세요.</p>
                <button onclick="busanApp.resetFilters()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                    <i class="fas fa-undo mr-2"></i>필터 초기화
                </button>
            </div>
        `;
    }

    /**
     * 실시간 업데이트 시작
     */
    startRealTimeUpdates() {
        // 1분마다 대시보드 업데이트
        setInterval(async () => {
            try {
                const dashboardData = await this.fetchDashboardStats();
                this.updateDashboard(dashboardData);
            } catch (error) {
                console.warn('대시보드 업데이트 실패:', error);
            }
        }, 60000);
    }
}

// === 전역 함수들 (HTML에서 호출) ===

let busanApp;

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    busanApp = new BusanAuctionApp();
});

// 필터 적용
function applyFilters() {
    if (!busanApp) return;
    
    // 필터 값들 수집
    busanApp.filters = {
        type: document.getElementById('filterType')?.value || '',
        region: document.getElementById('filterRegion')?.value || '',
        minPrice: document.getElementById('filterMinPrice')?.value || '',
        maxPrice: document.getElementById('filterMaxPrice')?.value || '',
        minScore: parseInt(document.getElementById('filterScoreRange')?.value || 50),
        grade: document.getElementById('filterGrade')?.value || '',
        failureCount: document.getElementById('filterFailureCount')?.value || '',
        auctionDate: document.getElementById('filterAuctionDate')?.value || '',
        roi: document.getElementById('filterROI')?.value || '',
        tenant: document.getElementById('filterTenant')?.value || ''
    };
    
    busanApp.currentPage = 1;
    busanApp.applyFiltersAndSort();
}

// 빠른 필터 설정
function setQuickFilter(type, value) {
    if (!busanApp) return;
    
    // 모든 빠른 필터 버튼 비활성화
    document.querySelectorAll('[id^="quickFilter"]').forEach(btn => {
        btn.className = btn.className.replace(/bg-\w+-100/g, 'bg-gray-100').replace(/text-\w+-700/g, '');
    });
    
    if (type === 'grade') {
        document.getElementById('filterGrade').value = value;
        document.getElementById(`quickFilter${value}`).className = 
            document.getElementById(`quickFilter${value}`).className.replace('bg-gray-100', 'bg-green-100').replace(/hover:text-\w+-700/, 'text-green-700');
    } else if (type === 'discount') {
        // 할인율 30% 이상을 위한 복잡한 로직은 추후 구현
        document.getElementById('quickFilterDiscount').className = 
            document.getElementById('quickFilterDiscount').className.replace('bg-gray-100', 'bg-yellow-100').replace(/hover:text-\w+-700/, 'text-yellow-700');
    }
    
    applyFilters();
}

// 필터 초기화
function resetFilters() {
    if (!busanApp) return;
    
    // 모든 필터 입력값 초기화
    document.getElementById('filterType').value = '';
    document.getElementById('filterRegion').value = '';
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';
    document.getElementById('filterScoreRange').value = 50;
    document.getElementById('filterScoreValue').textContent = '50';
    document.getElementById('filterGrade').value = '';
    document.getElementById('filterFailureCount').value = '';
    document.getElementById('filterAuctionDate').value = '';
    document.getElementById('filterROI').value = '';
    document.getElementById('filterTenant').value = '';
    
    // 빠른 필터 버튼 초기화
    document.querySelectorAll('[id^="quickFilter"]').forEach(btn => {
        btn.className = btn.className.replace(/bg-\w+-100/g, 'bg-gray-100').replace(/text-\w+-700/g, '');
    });
    
    applyFilters();
}

// 고급 필터 토글
function toggleAdvancedFilter() {
    const advancedFilters = document.getElementById('advancedFilters');
    const icon = document.getElementById('advancedFilterIcon');
    
    if (advancedFilters && icon) {
        const isHidden = advancedFilters.classList.contains('hidden');
        
        if (isHidden) {
            advancedFilters.classList.remove('hidden');
            icon.className = 'fas fa-chevron-up mr-1';
        } else {
            advancedFilters.classList.add('hidden');
            icon.className = 'fas fa-chevron-down mr-1';
        }
    }
}

// 데이터 새로고침
async function refreshData() {
    if (!busanApp) return;
    
    const button = event.target.closest('button');
    const icon = button.querySelector('i');
    
    // 회전 애니메이션 시작
    icon.className = 'fas fa-sync fa-spin mr-1';
    button.disabled = true;
    
    try {
        await busanApp.loadInitialData();
    } finally {
        // 애니메이션 중지
        icon.className = 'fas fa-sync mr-1';
        button.disabled = false;
    }
}

// 설정 토글
function toggleSettings() {
    console.log('설정 패널 토글 (추후 구현)');
}

// 물건 상세 정보 표시
function showPropertyDetail(propertyId) {
    console.log(`물건 상세 정보 표시: ${propertyId}`);
    // 추후 구현
}

// 지도 표시
function showMap(address) {
    console.log(`지도 표시: ${address}`);
    // 추후 구현
}

// 관심목록 추가
function addToWatchlist(propertyId) {
    console.log(`관심목록 추가: ${propertyId}`);
    // 추후 구현
}

// 물건 공유
function shareProperty(propertyId) {
    console.log(`물건 공유: ${propertyId}`);
    // 추후 구현
}

// 결과 엑셀 내보내기
function exportResults() {
    console.log('엑셀 내보내기 (추후 구현)');
    // 추후 구현
}

// === 헬퍼 함수들 ===

/**
 * 디바운스 함수
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 개발자 도구 확인
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🚀 부산경매 AI 분석 시스템 - 개발 모드');
    console.log('✨ 실시간 데이터 업데이트 및 AI 분석 기능 활성화');
}