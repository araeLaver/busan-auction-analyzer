// 전역 변수
let currentPage = 1;
let currentFilters = {};
let currentSort = { by: 'auction_date', order: 'ASC' };

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 애플리케이션 시작...');
    await loadDashboardStats();
    await loadProperties();
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 정렬 변경
    document.getElementById('sortBy').addEventListener('change', (e) => {
        currentSort.by = e.target.value;
        loadProperties();
    });

    document.getElementById('sortOrder').addEventListener('change', (e) => {
        currentSort.order = e.target.value;
        loadProperties();
    });
}

// 대시보드 통계 로드
async function loadDashboardStats() {
    try {
        console.log('📊 대시보드 통계 로딩...');
        const response = await fetch('/api/dashboard/stats');
        const stats = await response.json();

        document.getElementById('totalProperties').textContent = stats.totalActiveProperties?.toLocaleString() || '0';
        document.getElementById('newToday').textContent = stats.newTodayCount?.toLocaleString() || '0';
        document.getElementById('avgScore').textContent = stats.averageInvestmentScore || '0';
        document.getElementById('sGradeProperties').textContent = stats.highScoreCount?.toLocaleString() || '0';

        // 마지막 업데이트 시간 표시
        document.getElementById('lastUpdate').textContent = `마지막 업데이트: ${new Date().toLocaleString()}`;

    } catch (error) {
        console.error('대시보드 통계 로딩 오류:', error);
        showError('대시보드 통계를 불러오는데 실패했습니다.');
    }
}

// 물건 목록 로드
async function loadProperties() {
    try {
        showLoading();
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 20,
            sort: currentSort.by,
            order: currentSort.order,
            ...currentFilters
        });

        console.log(`📋 물건 목록 로딩... (페이지: ${currentPage})`);
        const response = await fetch(`/api/properties?${params}`);
        const data = await response.json();

        displayProperties(data.data);
        displayPagination(data.pagination);
        updatePropertyCount(data.pagination);

    } catch (error) {
        console.error('물건 목록 로딩 오류:', error);
        showError('물건 목록을 불러오는데 실패했습니다.');
    }
}

// 물건 개수 업데이트
function updatePropertyCount(pagination) {
    const countElement = document.getElementById('propertyCount');
    const page = parseInt(pagination.page);
    const limit = parseInt(pagination.limit);
    const total = parseInt(pagination.total);
    
    if (total === 0) {
        countElement.textContent = '(0개)';
    } else {
        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);
        countElement.textContent = `(${start}-${end}/${total}개)`;
    }
}

// 물건 목록 표시
function displayProperties(properties) {
    const container = document.getElementById('propertiesContainer');
    
    if (!properties || properties.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-search text-2xl text-gray-400"></i>
                <p class="mt-2 text-gray-500">검색 결과가 없습니다.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = properties.map(property => `
        <div class="border-b last:border-b-0 py-4 hover:bg-gray-50 cursor-pointer" 
             onclick="showPropertyDetail(${property.id})">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2">
                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                            ${property.case_number}-${property.item_number}
                        </span>
                        <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                            ${property.property_type || '기타'}
                        </span>
                        ${property.failure_count > 0 ? `
                            <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                                ${property.failure_count}회 유찰
                            </span>
                        ` : ''}
                    </div>

                    <h3 class="font-medium text-gray-900 mb-1">
                        ${property.building_name || property.address}
                    </h3>
                    
                    <div class="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <div class="flex items-center">
                            <i class="fas fa-map-marker-alt mr-1"></i>
                            ${property.address}
                        </div>
                        <button onclick="showPropertyMap('${property.address}', '${property.building_name || property.case_number}'); event.stopPropagation();" 
                                class="text-blue-600 hover:text-blue-800 ml-2 p-1 rounded hover:bg-blue-50" 
                                title="지도에서 위치 보기">
                            <i class="fas fa-map text-sm"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">감정가:</span>
                            <span class="font-medium">${formatPrice(property.appraisal_value)}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">최저가:</span>
                            <span class="font-medium text-blue-600">${formatPrice(property.minimum_sale_price)}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">할인율:</span>
                            <span class="font-medium text-green-600">${property.discount_rate || 0}%</span>
                        </div>
                        <div>
                            <span class="text-gray-500">입찰일:</span>
                            <span class="font-medium">${formatDate(property.auction_date)}</span>
                        </div>
                    </div>
                </div>

                <div class="ml-4 text-right">
                    ${property.investment_score ? `
                        <div class="mb-2">
                            <div class="text-2xl font-bold ${getScoreColor(property.investment_score)}">
                                ${property.investment_score}
                            </div>
                            <div class="text-xs text-gray-500">투자점수</div>
                        </div>
                        
                        ${property.success_probability ? `
                            <div class="text-sm">
                                <span class="text-gray-500">낙찰확률:</span>
                                <span class="font-medium">${property.success_probability}%</span>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="text-sm text-gray-400">분석 대기중</div>
                    `}
                </div>
            </div>
        </div>
    `).join('');
}

// 페이지네이션 표시
function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    
    const page = parseInt(pagination.page);
    const totalPages = parseInt(pagination.totalPages);
    const total = parseInt(pagination.total);
    const limit = parseInt(pagination.limit);
    
    if (!pagination || totalPages <= 1) {
        container.innerHTML = `
            <div class="flex justify-center">
                <div class="text-sm text-gray-700">
                    전체 ${total?.toLocaleString() || 0}개 중 1-${Math.min(limit, total)} 표시
                </div>
            </div>
        `;
        return;
    }

    // 페이지 정보 (상단 중앙)
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    
    let paginationHtml = `
        <div class="flex flex-col items-center space-y-4">
            <!-- 페이지 정보 -->
            <div class="text-sm text-gray-700">
                전체 ${total.toLocaleString()}개 중 ${start}-${end} 표시
            </div>
            
            <!-- 페이지 버튼들 -->
            <div class="flex items-center space-x-1">
    `;
    
    // 맨 처음 페이지 버튼
    if (page > 1) {
        paginationHtml += `
            <button onclick="goToPage(1)" 
                    class="px-3 py-2 border rounded-lg hover:bg-gray-50" 
                    title="첫 페이지">
                <i class="fas fa-angle-double-left"></i>
            </button>
        `;
    }
    
    // 이전 페이지 버튼
    if (page > 1) {
        paginationHtml += `
            <button onclick="goToPage(${page - 1})" 
                    class="px-3 py-2 border rounded-lg hover:bg-gray-50"
                    title="이전 페이지">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
    }
    
    // 페이지 번호들 (항상 5개 표시)
    let startPage, endPage;
    
    if (totalPages <= 5) {
        // 전체 페이지가 5개 이하면 모두 표시
        startPage = 1;
        endPage = totalPages;
    } else {
        // 전체 페이지가 5개 초과
        if (page <= 3) {
            // 현재 페이지가 1,2,3인 경우 -> 1,2,3,4,5 표시
            startPage = 1;
            endPage = 5;
        } else if (page >= totalPages - 2) {
            // 현재 페이지가 뒤에서 3번째 이내 -> 마지막 5개 표시
            startPage = totalPages - 4;
            endPage = totalPages;
        } else {
            // 중간 페이지 -> 현재 페이지 중심으로 5개 표시
            startPage = page - 2;
            endPage = page + 2;
        }
    }
    
    for (let p = startPage; p <= endPage; p++) {
        const isActive = p === page;
        paginationHtml += `
            <button onclick="goToPage(${p})" 
                    class="px-3 py-2 border rounded-lg ${isActive 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'hover:bg-gray-50 text-gray-700'}">
                ${p}
            </button>
        `;
    }
    
    // 다음 페이지 버튼
    if (page < totalPages) {
        paginationHtml += `
            <button onclick="goToPage(${page + 1})" 
                    class="px-3 py-2 border rounded-lg hover:bg-gray-50"
                    title="다음 페이지">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    // 맨 마지막 페이지 버튼
    if (page < totalPages) {
        paginationHtml += `
            <button onclick="goToPage(${totalPages})" 
                    class="px-3 py-2 border rounded-lg hover:bg-gray-50"
                    title="마지막 페이지">
                <i class="fas fa-angle-double-right"></i>
            </button>
        `;
    }
    
    paginationHtml += `
            </div>
        </div>
    `;
    
    container.innerHTML = paginationHtml;
}

// 필터 적용
function applyFilters() {
    const filters = {};
    
    const type = document.getElementById('filterType').value;
    if (type) filters.propertyType = type;
    
    const region = document.getElementById('filterRegion').value;
    if (region) filters.region = region;
    
    const minPrice = document.getElementById('filterMinPrice').value;
    if (minPrice) filters.minPrice = parseInt(minPrice); // 억원 단위로 전송
    
    const maxPrice = document.getElementById('filterMaxPrice').value;
    if (maxPrice) filters.maxPrice = parseInt(maxPrice); // 억원 단위로 전송
    
    const minScore = document.getElementById('filterMinScore').value;
    if (minScore) filters.minScore = parseInt(minScore);
    
    currentFilters = filters;
    currentPage = 1; // 첫 페이지로 리셋
    
    console.log('🔍 필터 적용:', currentFilters);
    loadProperties();
}

// 페이지 이동
function goToPage(page) {
    currentPage = page;
    loadProperties();
}

// 물건 상세 정보 표시
async function showPropertyDetail(propertyId) {
    try {
        console.log(`🏠 물건 상세 정보 로딩... (ID: ${propertyId})`);
        
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('detailContent');
        
        // 로딩 표시
        content.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
                <p class="mt-2 text-gray-500">상세 정보를 불러오는 중...</p>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        const response = await fetch(`/api/properties/${propertyId}`);
        const property = await response.json();
        
        // 상세 정보 표시
        content.innerHTML = generateDetailContent(property);
        
    } catch (error) {
        console.error('물건 상세 정보 로딩 오류:', error);
        document.getElementById('detailContent').innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-triangle text-2xl text-red-400"></i>
                <p class="mt-2 text-red-500">상세 정보를 불러오는데 실패했습니다.</p>
            </div>
        `;
    }
}

// 상세 정보 HTML 생성
function generateDetailContent(property) {
    return `
        <div class="space-y-6">
            <!-- 기본 정보 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-semibold mb-3 text-lg">기본 정보</h4>
                    <div class="space-y-2 text-sm">
                        <div><span class="text-gray-600">사건번호:</span> <span class="font-medium">${property.case_number}-${property.item_number}</span></div>
                        <div><span class="text-gray-600">법원:</span> <span class="font-medium">${property.court_name || '서울중앙지법'}</span></div>
                        <div><span class="text-gray-600">물건종류:</span> <span class="font-medium">${property.property_type || '미분류'}</span></div>
                        <div><span class="text-gray-600">소재지:</span> <span class="font-medium">${property.address}</span></div>
                        ${property.building_name ? `<div><span class="text-gray-600">건물명:</span> <span class="font-medium">${property.building_name}</span></div>` : ''}
                        ${property.building_year ? `<div><span class="text-gray-600">건축년도:</span> <span class="font-medium">${property.building_year}년</span></div>` : ''}
                    </div>
                </div>

                <div>
                    <h4 class="font-semibold mb-3 text-lg">면적 정보</h4>
                    <div class="space-y-2 text-sm">
                        ${property.land_area ? `<div><span class="text-gray-600">토지면적:</span> <span class="font-medium">${property.land_area.toLocaleString()}㎡</span></div>` : ''}
                        ${property.building_area ? `<div><span class="text-gray-600">건물면적:</span> <span class="font-medium">${property.building_area.toLocaleString()}㎡</span></div>` : ''}
                        ${property.exclusive_area ? `<div><span class="text-gray-600">전용면적:</span> <span class="font-medium">${property.exclusive_area.toLocaleString()}㎡</span></div>` : ''}
                        ${property.floor_info ? `<div><span class="text-gray-600">층수:</span> <span class="font-medium">${property.floor_info}</span></div>` : ''}
                    </div>
                </div>
            </div>

            <!-- 가격 정보 -->
            <div>
                <h4 class="font-semibold mb-3 text-lg">가격 정보</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="text-sm text-gray-600">감정가액</div>
                        <div class="text-xl font-bold">${formatPrice(property.appraisal_value)}</div>
                    </div>
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <div class="text-sm text-gray-600">최저매각가격</div>
                        <div class="text-xl font-bold text-blue-600">${formatPrice(property.minimum_sale_price)}</div>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg">
                        <div class="text-sm text-gray-600">입찰보증금</div>
                        <div class="text-xl font-bold text-green-600">${formatPrice(property.bid_deposit)}</div>
                    </div>
                </div>
            </div>

            <!-- 입찰 정보 -->
            <div>
                <h4 class="font-semibold mb-3 text-lg">입찰 정보</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <span class="text-gray-600">매각기일:</span>
                        <span class="font-medium">${formatDate(property.auction_date)}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">유찰횟수:</span>
                        <span class="font-medium">${property.failure_count || 0}회</span>
                    </div>
                    <div>
                        <span class="text-gray-600">현재상태:</span>
                        <span class="font-medium">${getStatusText(property.current_status)}</span>
                    </div>
                </div>
            </div>

            ${property.investment_score ? `
                <!-- 투자 분석 -->
                <div>
                    <h4 class="font-semibold mb-3 text-lg">투자 분석</h4>
                    
                    <!-- 투자 점수 -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div class="text-center">
                            <div class="text-3xl font-bold ${getScoreColor(property.investment_score)}">${property.investment_score}</div>
                            <div class="text-sm text-gray-600">종합점수</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">${property.profitability_score || 0}</div>
                            <div class="text-sm text-gray-600">수익성</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">${property.risk_score || 0}</div>
                            <div class="text-sm text-gray-600">안전성</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-purple-600">${property.liquidity_score || 0}</div>
                            <div class="text-sm text-gray-600">유동성</div>
                        </div>
                    </div>

                    <!-- 추가 분석 정보 -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${property.discount_rate ? `
                            <div class="bg-yellow-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">할인율</div>
                                <div class="text-lg font-bold text-yellow-600">${property.discount_rate}%</div>
                            </div>
                        ` : ''}
                        
                        ${property.success_probability ? `
                            <div class="bg-indigo-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">낙찰 예상확률</div>
                                <div class="text-lg font-bold text-indigo-600">${property.success_probability}%</div>
                            </div>
                        ` : ''}
                        
                        ${property.estimated_final_price ? `
                            <div class="bg-red-50 p-3 rounded-lg">
                                <div class="text-sm text-gray-600">예상 낙찰가</div>
                                <div class="text-lg font-bold text-red-600">${formatPrice(property.estimated_final_price)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : `
                <div class="bg-gray-50 p-4 rounded-lg text-center">
                    <i class="fas fa-chart-bar text-2xl text-gray-400 mb-2"></i>
                    <p class="text-gray-600">투자 분석이 아직 진행되지 않았습니다.</p>
                </div>
            `}

            ${property.special_notes ? `
                <!-- 특이사항 -->
                <div>
                    <h4 class="font-semibold mb-3 text-lg">특이사항</h4>
                    <div class="bg-yellow-50 p-4 rounded-lg">
                        <p class="text-sm">${property.special_notes}</p>
                    </div>
                </div>
            ` : ''}

            <!-- 더미 데이터 안내 -->
            ${property.is_dummy_data ? `
                <div class="pt-4 border-t">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <div class="flex items-start">
                            <i class="fas fa-exclamation-triangle text-yellow-500 mr-3 mt-1"></i>
                            <div>
                                <h5 class="font-medium text-yellow-800 mb-1">시연용 더미 데이터</h5>
                                <p class="text-sm text-yellow-700 mb-3">${property.data_description}</p>
                                <div class="space-y-2">
                                    <p class="text-sm text-yellow-700 font-medium">실제 경매 정보는 아래 사이트에서 확인하세요:</p>
                                    <div class="flex flex-wrap gap-2">
                                        <a href="${property.court_auction_url}" target="_blank" 
                                           class="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                                            <i class="fas fa-gavel mr-2"></i>
                                            온비드 (법원경매)
                                        </a>
                                        <a href="https://www.courtauction.go.kr" target="_blank" 
                                           class="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                                            <i class="fas fa-building mr-2"></i>
                                            법원경매정보
                                        </a>
                                        <a href="https://www.goodauction.land" target="_blank" 
                                           class="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-chart-line mr-2"></i>
                                            굿옥션랜드
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : `
                <!-- 실제 데이터 안내 -->
                <div class="pt-4 border-t">
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div class="flex items-start">
                            <i class="fas fa-check-circle text-green-500 mr-3 mt-1"></i>
                            <div>
                                <h5 class="font-medium text-green-800 mb-1">실제 경매 데이터</h5>
                                <p class="text-sm text-green-700 mb-3">${property.data_description || '실제 경매 정보입니다.'}</p>
                                <div class="space-y-2">
                                    <p class="text-sm text-green-700 font-medium">실제 경매 사이트에서 상세정보 확인:</p>
                                    <div class="flex flex-wrap gap-2">
                                        <a href="https://www.courtauction.go.kr/RetrieveRealEstDetailInqSaList.laf?jiwonNm=${encodeURIComponent(property.court_name || '')}&caseNo=${encodeURIComponent(property.case_number || '')}" target="_blank" 
                                           class="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                                            <i class="fas fa-gavel mr-2"></i>
                                            법원경매정보 (${property.case_number})
                                        </a>
                                        <a href="https://www.goodauction.land" target="_blank" 
                                           class="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-search mr-2"></i>
                                            굿옥션
                                        </a>
                                        <a href="https://www.onbid.co.kr" target="_blank" 
                                           class="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                                            <i class="fas fa-building mr-2"></i>
                                            온비드
                                        </a>
                                    </div>
                                    <p class="text-xs text-green-600 mt-2">
                                        <i class="fas fa-info-circle mr-1"></i>
                                        사건번호 <strong>${property.case_number}</strong>로 직접 검색하여 최신 경매 상태를 확인하세요.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 원본 링크 -->
                <div
                    <a href="${property.source_url || '#'}" target="_blank" 
                       class="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-external-link-alt mr-2"></i>
                        법원경매정보에서 보기
                    </a>
                </div>
            `}
        </div>
    `;
}

// 상세 모달 닫기
function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

// 데이터 새로고침
async function refreshData() {
    console.log('🔄 데이터 새로고침...');
    await loadDashboardStats();
    await loadProperties();
    showSuccess('데이터가 새로고침되었습니다.');
}

// 유틸리티 함수들
function formatPrice(price) {
    if (!price) return '-';
    
    const billion = Math.floor(price / 100000000);
    const million = Math.floor((price % 100000000) / 10000);
    
    if (billion > 0) {
        return million > 0 ? `${billion}억 ${million}만원` : `${billion}억원`;
    } else if (million > 0) {
        return `${million}만원`;
    } else {
        return `${price.toLocaleString()}원`;
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    });
}

function getScoreColor(score) {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
}

function getStatusText(status) {
    const statusMap = {
        'active': '진행중',
        'sold': '낙찰',
        'failed': '유찰',
        'cancelled': '취하'
    };
    return statusMap[status] || status;
}

function showLoading() {
    document.getElementById('propertiesContainer').innerHTML = `
        <div class="text-center py-8">
            <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
            <p class="mt-2 text-gray-500">로딩 중...</p>
        </div>
    `;
}

function showError(message) {
    // 간단한 에러 표시 (추후 토스트 메시지로 개선 가능)
    alert('오류: ' + message);
}

function showSuccess(message) {
    // 간단한 성공 표시 (추후 토스트 메시지로 개선 가능)
    console.log('✅ ' + message);
}

// 모달 외부 클릭 시 닫기
document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') {
        closeDetailModal();
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDetailModal();
        closeMapModal();
    }
});

// 지도 관련 변수
let currentMap = null;

// 물건 위치를 지도에 표시
function showPropertyMap(address, title) {
    console.log(`🗺️ 지도 표시: ${address}`);
    
    const modal = document.getElementById('mapModal');
    const addressElement = document.getElementById('mapAddress');
    const mapContainer = document.getElementById('map');
    const fallbackContainer = document.getElementById('mapFallback');
    const fallbackAddress = document.getElementById('fallbackAddress');
    
    // 주소 표시
    addressElement.textContent = address;
    fallbackAddress.textContent = address;
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // 카카오맵 API 사용 가능 여부 확인
    if (typeof kakao !== 'undefined' && kakao.maps) {
        try {
            // 기존 지도 정리
            if (currentMap) {
                currentMap = null;
            }
            
            // 지도 컨테이너 표시, 대체 화면 숨기기
            mapContainer.style.display = 'block';
            fallbackContainer.classList.add('hidden');
            
            // 지도 초기화
            const mapOption = {
                center: new kakao.maps.LatLng(37.566826, 126.9786567), // 서울 시청 기준
                level: 3 // 지도 확대 레벨
            };
            
            currentMap = new kakao.maps.Map(mapContainer, mapOption);
            
            // 주소로 좌표 검색
            const geocoder = new kakao.maps.services.Geocoder();
            
            geocoder.addressSearch(address, function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                    const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
                    
                    // 지도 중심 이동
                    currentMap.setCenter(coords);
                    
                    // 마커 생성
                    const marker = new kakao.maps.Marker({
                        map: currentMap,
                        position: coords
                    });
                    
                    // 인포윈도우 생성
                    const infowindow = new kakao.maps.InfoWindow({
                        content: `
                            <div style="padding:8px; min-width:200px;">
                                <div style="font-weight:bold; margin-bottom:4px;">${title}</div>
                                <div style="font-size:12px; color:#666;">${address}</div>
                            </div>
                        `,
                        removable: false
                    });
                    
                    // 인포윈도우 표시
                    infowindow.open(currentMap, marker);
                    
                    console.log('✅ 지도에 위치 표시 완료');
                } else {
                    console.warn('⚠️ 주소 검색 실패:', status);
                    showMapFallback(address);
                }
            });
            
        } catch (error) {
            console.error('❌ 지도 초기화 오류:', error);
            showMapFallback(address);
        }
    } else {
        console.log('⚠️ 카카오맵 API 사용 불가, 대체 화면 표시');
        showMapFallback(address);
    }
}

// 네이버맵 직접 표시 (API 키가 있는 경우)
async function showNaverMapDirect(address) {
    const mapContainer = document.getElementById('map');
    const fallbackContainer = document.getElementById('mapFallback');
    
    try {
        // 네이버맵 API 사용 가능 여부 확인
        if (typeof naver !== 'undefined' && naver.maps) {
            // 지도 컨테이너 초기화
            mapContainer.innerHTML = '<div id="naverMapContainer" style="width:100%; height:500px;"></div>';
            mapContainer.style.display = 'block';
            fallbackContainer.classList.add('hidden');
            
            // 서울 시청을 기본 위치로 설정
            const defaultLocation = new naver.maps.LatLng(37.5665, 126.9780);
            
            const map = new naver.maps.Map('naverMapContainer', {
                center: defaultLocation,
                zoom: 15,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: naver.maps.MapTypeControlStyle.BUTTON,
                    position: naver.maps.Position.TOP_RIGHT
                },
                zoomControl: true,
                zoomControlOptions: {
                    style: naver.maps.ZoomControlStyle.SMALL,
                    position: naver.maps.Position.RIGHT_CENTER
                }
            });
            
            // 주소를 좌표로 변환하여 마커 표시 (실제로는 Geocoding API 필요)
            // 여기서는 서울의 주요 구별로 대략적인 위치 설정
            const seoulDistrictCoords = {
                '강남구': new naver.maps.LatLng(37.5172, 127.0473),
                '서초구': new naver.maps.LatLng(37.4837, 127.0324),
                '송파구': new naver.maps.LatLng(37.5145, 127.1059),
                '강동구': new naver.maps.LatLng(37.5301, 127.1238),
                '영등포구': new naver.maps.LatLng(37.5264, 126.8962),
                '구로구': new naver.maps.LatLng(37.4954, 126.8874),
                '종로구': new naver.maps.LatLng(37.5735, 126.9788),
                '중구': new naver.maps.LatLng(37.5636, 126.9977),
                '용산구': new naver.maps.LatLng(37.5384, 126.9655),
                '마포구': new naver.maps.LatLng(37.5637, 126.9084),
                '서대문구': new naver.maps.LatLng(37.5794, 126.9368)
            };
            
            // 주소에서 구 이름 추출
            let markerPosition = defaultLocation;
            for (const [district, coords] of Object.entries(seoulDistrictCoords)) {
                if (address.includes(district)) {
                    markerPosition = coords;
                    break;
                }
            }
            
            // 지도 중심을 마커 위치로 이동
            map.setCenter(markerPosition);
            
            // 마커 생성
            const marker = new naver.maps.Marker({
                position: markerPosition,
                map: map,
                title: address
            });
            
            // 정보창 생성
            const infoWindow = new naver.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; min-width: 200px;">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold; font-size: 14px;">경매 물건 위치</h4>
                        <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">${address}</p>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                            <a href="https://map.naver.com/v5/search/${encodeURIComponent(address)}" 
                               target="_blank" 
                               style="color: #03C75A; text-decoration: none; font-size: 11px;">
                                🔗 네이버맵에서 상세보기
                            </a>
                        </div>
                    </div>
                `,
                borderWidth: 0,
                anchorSize: new naver.maps.Size(20, 20),
                anchorSkew: true,
                anchorColor: '#fff',
                pixelOffset: new naver.maps.Point(0, -10)
            });
            
            // 마커 클릭 시 정보창 표시
            naver.maps.Event.addListener(marker, 'click', function() {
                if (infoWindow.getMap()) {
                    infoWindow.close();
                } else {
                    infoWindow.open(map, marker);
                }
            });
            
            // 기본적으로 정보창 표시
            infoWindow.open(map, marker);
            
            // 지도 하단에 추가 정보 표시
            const controlDiv = document.createElement('div');
            controlDiv.innerHTML = `
                <div style="background: white; margin: 10px; padding: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #666;">📍 ${address}</span>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="copyAddress('${address}')" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">주소복사</button>
                            <a href="https://map.naver.com/v5/search/${encodeURIComponent(address)}" target="_blank" style="background: #03C75A; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; text-decoration: none;">길찾기</a>
                        </div>
                    </div>
                </div>
            `;
            
            map.controls[naver.maps.Position.BOTTOM_CENTER].push(controlDiv);
            
            console.log('✅ 네이버맵 직접 표시 완료:', address);
            return true;
            
        } else {
            throw new Error('네이버맵 API를 사용할 수 없습니다');
        }
        
    } catch (error) {
        console.warn('⚠️ 네이버맵 직접 표시 실패:', error.message);
        return false;
    }
}

// 네이버맵 iframe으로 직접 표시 (API 키 없이도 사용 가능)
function showNaverMapIframe(address) {
    const mapContainer = document.getElementById('map');
    const fallbackContainer = document.getElementById('mapFallback');
    
    try {
        const encodedAddress = encodeURIComponent(address);
        
        // 네이버맵 iframe 직접 임베드
        const iframeMapView = `
            <div style="width:100%; height:650px; position:relative; background: #f8f9fa;">
                <!-- 지도 상단 헤더 -->
                <div style="position: absolute; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #03C75A 0%, #02B550 100%); color: white; padding: 12px; z-index: 10; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center;">
                        <i class="fas fa-map-pin" style="margin-right: 8px;"></i>
                        <div>
                            <div style="font-size: 14px; font-weight: bold;">경매 물건 위치</div>
                            <div style="font-size: 11px; opacity: 0.8;">${address}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="copyAddress('${address}')" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                                onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            <i class="fas fa-copy" style="margin-right: 4px;"></i>복사
                        </button>
                        <a href="https://map.naver.com/v5/search/${encodedAddress}" 
                           target="_blank"
                           style="background: rgba(255,255,255,0.9); color: #03C75A; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11px; text-decoration: none; font-weight: bold; transition: all 0.2s;"
                           onmouseover="this.style.background='white'"
                           onmouseout="this.style.background='rgba(255,255,255,0.9)'">
                            <i class="fas fa-external-link-alt" style="margin-right: 4px;"></i>새창
                        </a>
                    </div>
                </div>
                
                <!-- 네이버맵 iframe -->
                <iframe 
                    src="https://map.naver.com/v5/search/${encodedAddress}?c=14,0,0,0,dh"
                    width="100%" 
                    height="650px" 
                    style="border: none; background: white;"
                    allowfullscreen="true"
                    loading="lazy"
                    title="네이버 지도 - ${address}">
                </iframe>
                
                <!-- 하단 지도 선택 버튼들 -->
                <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 20;">
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.95); padding: 8px 12px; border-radius: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(10px);">
                        <!-- 현재 네이버맵 표시 -->
                        <div style="display: flex; align-items: center; background: #03C75A; color: white; padding: 6px 10px; border-radius: 15px; font-size: 11px; font-weight: bold;">
                            <i class="fas fa-map-pin" style="margin-right: 4px;"></i>
                            네이버
                        </div>
                        
                        <!-- 구분선 -->
                        <div style="width: 1px; height: 20px; background: #dee2e6;"></div>
                        
                        <!-- 카카오맵 버튼 -->
                        <button onclick="switchToKakaoMap('${address}')" 
                                style="display: flex; align-items: center; background: transparent; border: 1px solid #FEE500; color: #3C1E1E; padding: 6px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.background='#FEE500'; this.style.color='#3C1E1E'"
                                onmouseout="this.style.background='transparent'; this.style.color='#3C1E1E'"
                                title="카카오맵으로 전환">
                            <i class="fas fa-map" style="margin-right: 4px;"></i>
                            카카오
                        </button>
                        
                        <!-- 구글맵 버튼 -->
                        <button onclick="switchToGoogleMap('${address}')" 
                                style="display: flex; align-items: center; background: transparent; border: 1px solid #4285F4; color: #4285F4; padding: 6px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.background='#4285F4'; this.style.color='white'"
                                onmouseout="this.style.background='transparent'; this.style.color='#4285F4'"
                                title="구글맵으로 전환">
                            <i class="fab fa-google" style="margin-right: 4px;"></i>
                            구글
                        </button>
                        
                        <!-- 구분선 -->
                        <div style="width: 1px; height: 20px; background: #dee2e6;"></div>
                        
                        <!-- 정보 아이콘 -->
                        <div style="color: #6c757d; font-size: 11px; display: flex; align-items: center;">
                            <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                            다른 지도로 전환 가능
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        mapContainer.innerHTML = iframeMapView;
        mapContainer.style.display = 'block';
        fallbackContainer.classList.add('hidden');
        
        console.log('✅ 네이버맵 iframe 직접 표시 완료:', address);
        return true;
        
    } catch (error) {
        console.warn('⚠️ 네이버맵 iframe 표시 실패:', error.message);
        return false;
    }
}

// 카카오맵으로 전환
function switchToKakaoMap(address) {
    const mapContainer = document.getElementById('map');
    const encodedAddress = encodeURIComponent(address);
    
    const kakaoMapView = `
        <div style="width:100%; height:650px; position:relative; background: #f8f9fa;">
            <!-- 지도 상단 헤더 (카카오 스타일) -->
            <div style="position: absolute; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #FEE500 0%, #FFEB3B 100%); color: #3C1E1E; padding: 12px; z-index: 10; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-map-pin" style="margin-right: 8px;"></i>
                    <div>
                        <div style="font-size: 14px; font-weight: bold;">경매 물건 위치 - 카카오맵</div>
                        <div style="font-size: 11px; opacity: 0.8;">${address}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="copyAddress('${address}')" 
                            style="background: rgba(60,30,30,0.1); border: 1px solid rgba(60,30,30,0.2); color: #3C1E1E; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(60,30,30,0.2)'"
                            onmouseout="this.style.background='rgba(60,30,30,0.1)'">
                        <i class="fas fa-copy" style="margin-right: 4px;"></i>복사
                    </button>
                    <a href="https://map.kakao.com/?q=${encodedAddress}" 
                       target="_blank"
                       style="background: #3C1E1E; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11px; text-decoration: none; font-weight: bold; transition: all 0.2s;"
                       onmouseover="this.style.background='#2C1414'"
                       onmouseout="this.style.background='#3C1E1E'">
                        <i class="fas fa-external-link-alt" style="margin-right: 4px;"></i>새창
                    </a>
                </div>
            </div>
            
            <!-- 카카오맵 iframe -->
            <iframe 
                src="https://map.kakao.com/?q=${encodedAddress}"
                width="100%" 
                height="650px" 
                style="border: none; background: white;"
                allowfullscreen="true"
                loading="lazy"
                title="카카오 지도 - ${address}">
            </iframe>
            
            <!-- 하단 지도 선택 버튼들 (카카오 활성화) -->
            <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 20;">
                <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.95); padding: 8px 12px; border-radius: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(10px);">
                    <!-- 네이버맵 버튼 -->
                    <button onclick="switchToNaverMap('${address}')" 
                            style="display: flex; align-items: center; background: transparent; border: 1px solid #03C75A; color: #03C75A; padding: 6px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='#03C75A'; this.style.color='white'"
                            onmouseout="this.style.background='transparent'; this.style.color='#03C75A'"
                            title="네이버맵으로 전환">
                        <i class="fas fa-map-pin" style="margin-right: 4px;"></i>
                        네이버
                    </button>
                    
                    <!-- 구분선 -->
                    <div style="width: 1px; height: 20px; background: #dee2e6;"></div>
                    
                    <!-- 현재 카카오맵 표시 -->
                    <div style="display: flex; align-items: center; background: #FEE500; color: #3C1E1E; padding: 6px 10px; border-radius: 15px; font-size: 11px; font-weight: bold;">
                        <i class="fas fa-map" style="margin-right: 4px;"></i>
                        카카오
                    </div>
                    
                    <!-- 구글맵 버튼 -->
                    <button onclick="switchToGoogleMap('${address}')" 
                            style="display: flex; align-items: center; background: transparent; border: 1px solid #4285F4; color: #4285F4; padding: 6px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='#4285F4'; this.style.color='white'"
                            onmouseout="this.style.background='transparent'; this.style.color='#4285F4'"
                            title="구글맵으로 전환">
                        <i class="fab fa-google" style="margin-right: 4px;"></i>
                        구글
                    </button>
                    
                    <!-- 구분선 -->
                    <div style="width: 1px; height: 20px; background: #dee2e6;"></div>
                    
                    <!-- 정보 아이콘 -->
                    <div style="color: #6c757d; font-size: 11px; display: flex; align-items: center;">
                        <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                        다른 지도로 전환 가능
                    </div>
                </div>
            </div>
        </div>
    `;
    
    mapContainer.innerHTML = kakaoMapView;
    console.log('✅ 카카오맵으로 전환 완료:', address);
}

// 구글맵으로 전환
function switchToGoogleMap(address) {
    const mapContainer = document.getElementById('map');
    const encodedAddress = encodeURIComponent(address);
    
    const googleMapView = `
        <div style="width:100%; height:650px; position:relative; background: #f8f9fa;">
            <!-- 지도 상단 헤더 (구글 스타일) -->
            <div style="position: absolute; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #4285F4 0%, #34A853 100%); color: white; padding: 12px; z-index: 10; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center;">
                    <i class="fab fa-google" style="margin-right: 8px;"></i>
                    <div>
                        <div style="font-size: 14px; font-weight: bold;">경매 물건 위치 - 구글맵</div>
                        <div style="font-size: 11px; opacity: 0.8;">${address}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="copyAddress('${address}')" 
                            style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        <i class="fas fa-copy" style="margin-right: 4px;"></i>복사
                    </button>
                    <a href="https://maps.google.com/?q=${encodedAddress}" 
                       target="_blank"
                       style="background: rgba(255,255,255,0.9); color: #4285F4; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11px; text-decoration: none; font-weight: bold; transition: all 0.2s;"
                       onmouseover="this.style.background='white'"
                       onmouseout="this.style.background='rgba(255,255,255,0.9)'">
                        <i class="fas fa-external-link-alt" style="margin-right: 4px;"></i>새창
                    </a>
                </div>
            </div>
            
            <!-- 구글맵 iframe -->
            <iframe 
                src="https://maps.google.com/maps?q=${encodedAddress}&output=embed"
                width="100%" 
                height="650px" 
                style="border: none; background: white;"
                allowfullscreen="true"
                loading="lazy"
                title="구글 지도 - ${address}">
            </iframe>
            
            <!-- 하단 지도 선택 버튼들 (구글 활성화) -->
            <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 20;">
                <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.95); padding: 8px 12px; border-radius: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(10px);">
                    <!-- 네이버맵 버튼 -->
                    <button onclick="switchToNaverMap('${address}')" 
                            style="display: flex; align-items: center; background: transparent; border: 1px solid #03C75A; color: #03C75A; padding: 6px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='#03C75A'; this.style.color='white'"
                            onmouseout="this.style.background='transparent'; this.style.color='#03C75A'"
                            title="네이버맵으로 전환">
                        <i class="fas fa-map-pin" style="margin-right: 4px;"></i>
                        네이버
                    </button>
                    
                    <!-- 카카오맵 버튼 -->
                    <button onclick="switchToKakaoMap('${address}')" 
                            style="display: flex; align-items: center; background: transparent; border: 1px solid #FEE500; color: #3C1E1E; padding: 6px 10px; border-radius: 15px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='#FEE500'; this.style.color='#3C1E1E'"
                            onmouseout="this.style.background='transparent'; this.style.color='#3C1E1E'"
                            title="카카오맵으로 전환">
                        <i class="fas fa-map" style="margin-right: 4px;"></i>
                        카카오
                    </button>
                    
                    <!-- 구분선 -->
                    <div style="width: 1px; height: 20px; background: #dee2e6;"></div>
                    
                    <!-- 현재 구글맵 표시 -->
                    <div style="display: flex; align-items: center; background: #4285F4; color: white; padding: 6px 10px; border-radius: 15px; font-size: 11px; font-weight: bold;">
                        <i class="fab fa-google" style="margin-right: 4px;"></i>
                        구글
                    </div>
                    
                    <!-- 구분선 -->
                    <div style="width: 1px; height: 20px; background: #dee2e6;"></div>
                    
                    <!-- 정보 아이콘 -->
                    <div style="color: #6c757d; font-size: 11px; display: flex; align-items: center;">
                        <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                        다른 지도로 전환 가능
                    </div>
                </div>
            </div>
        </div>
    `;
    
    mapContainer.innerHTML = googleMapView;
    console.log('✅ 구글맵으로 전환 완료:', address);
}

// 네이버맵으로 전환 (다시 돌아가기)
function switchToNaverMap(address) {
    showNaverMapIframe(address);
    console.log('✅ 네이버맵으로 전환 완료:', address);
}

// 네이버맵 메인 지도 표시 (폴백)
async function showMapFallback(address) {
    const mapContainer = document.getElementById('map');
    const fallbackContainer = document.getElementById('mapFallback');
    
    const encodedAddress = encodeURIComponent(address);
    
    // 먼저 직접 네이버맵 표시 시도
    const directMapSuccess = await showNaverMapDirect(address);
    
    if (directMapSuccess) {
        return; // 직접 표시 성공 시 종료
    }
    
    // API 없이도 네이버맵 iframe으로 직접 표시 시도
    const iframeMapSuccess = showNaverMapIframe(address);
    
    if (iframeMapSuccess) {
        return; // iframe 표시 성공 시 종료
    }
    
    // 직접 표시 실패 시 폴백 UI 표시
    const modernMapView = `
        <div class="bg-gradient-to-br from-blue-50 to-indigo-100 h-full flex items-center justify-center p-8">
            <div class="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-w-2xl w-full">
                <!-- 헤더 -->
                <div class="bg-gradient-to-r from-green-500 to-green-600 text-white p-6">
                    <div class="flex items-center mb-3">
                        <div class="bg-white bg-opacity-20 rounded-full p-2 mr-3">
                            <i class="fas fa-map-pin text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold">물건 위치</h3>
                            <p class="text-green-100 text-sm">API 키 설정 후 지도를 직접 확인할 수 있습니다</p>
                        </div>
                    </div>
                    <div class="bg-white bg-opacity-10 rounded-lg p-3">
                        <p class="text-sm font-medium">${address}</p>
                    </div>
                </div>

                <!-- 네이버맵 메인 버튼 -->
                <div class="p-6">
                    <a href="https://map.naver.com/v5/search/${encodedAddress}" 
                       target="_blank"
                       class="block w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl p-6 mb-4 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
                        <div class="flex items-center justify-center">
                            <div class="bg-white bg-opacity-20 rounded-full p-3 mr-4">
                                <i class="fas fa-map text-2xl"></i>
                            </div>
                            <div class="text-left">
                                <h4 class="text-xl font-bold mb-1">네이버맵에서 보기</h4>
                                <p class="text-green-100">한국 최고의 지도 서비스 ✨</p>
                            </div>
                            <i class="fas fa-arrow-right text-xl ml-auto"></i>
                        </div>
                    </a>

                    <!-- 서브 지도 옵션들 -->
                    <div class="grid grid-cols-2 gap-3">
                        <a href="https://map.kakao.com/?q=${encodedAddress}" 
                           target="_blank"
                           class="flex items-center justify-center bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md group">
                            <div class="text-center">
                                <div class="bg-yellow-500 text-white rounded-full p-2 mx-auto mb-2 group-hover:scale-110 transition-transform">
                                    <i class="fas fa-map-marker-alt"></i>
                                </div>
                                <span class="text-sm font-medium text-yellow-700">카카오맵</span>
                            </div>
                        </a>
                        
                        <a href="https://maps.google.com/?q=${encodedAddress}" 
                           target="_blank"
                           class="flex items-center justify-center bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md group">
                            <div class="text-center">
                                <div class="bg-blue-500 text-white rounded-full p-2 mx-auto mb-2 group-hover:scale-110 transition-transform">
                                    <i class="fab fa-google"></i>
                                </div>
                                <span class="text-sm font-medium text-blue-700">구글맵</span>
                            </div>
                        </a>
                    </div>

                    <!-- API 키 안내 -->
                    <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex items-center text-blue-800 text-xs">
                            <i class="fas fa-info-circle mr-2"></i>
                            <span>네이버 지도 API 키를 설정하면 팝업에서 직접 지도를 볼 수 있습니다</span>
                        </div>
                    </div>

                    <!-- 추가 기능 버튼들 -->
                    <div class="flex items-center justify-center space-x-4 mt-6 pt-4 border-t border-gray-100">
                        <button onclick="copyAddress('${address}')" 
                                class="flex items-center text-gray-600 hover:text-gray-800 transition-colors">
                            <i class="fas fa-copy mr-2"></i>
                            <span class="text-sm">주소 복사</span>
                        </button>
                        <div class="w-px h-4 bg-gray-300"></div>
                        <button onclick="shareLocation('${address}')" 
                                class="flex items-center text-gray-600 hover:text-gray-800 transition-colors">
                            <i class="fas fa-share-alt mr-2"></i>
                            <span class="text-sm">위치 공유</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    mapContainer.innerHTML = modernMapView;
    mapContainer.style.display = 'block';
    fallbackContainer.classList.add('hidden');
    
    console.log(`✅ 네이버맵 폴백 표시: ${address}`);
}

// 지도 모달 닫기
function closeMapModal() {
    const modal = document.getElementById('mapModal');
    modal.classList.add('hidden');
    
    // 지도 정리
    if (currentMap) {
        currentMap = null;
    }
}

// 지도 모달 외부 클릭 시 닫기
document.getElementById('mapModal').addEventListener('click', (e) => {
    if (e.target.id === 'mapModal') {
        closeMapModal();
    }
});

// 주소 복사 기능
function copyAddress(address) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(address).then(() => {
            showToast('✅ 주소가 클립보드에 복사되었습니다', 'success');
        }).catch(() => {
            showToast('❌ 주소 복사에 실패했습니다', 'error');
        });
    } else {
        // 폴백: 텍스트 선택 방식
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('✅ 주소가 클립보드에 복사되었습니다', 'success');
        } catch (err) {
            showToast('❌ 주소 복사에 실패했습니다', 'error');
        }
        document.body.removeChild(textArea);
    }
}

// 위치 공유 기능
function shareLocation(address) {
    const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(address)}`;
    
    if (navigator.share) {
        // 모바일 네이티브 공유
        navigator.share({
            title: '경매 물건 위치',
            text: `📍 ${address}`,
            url: naverUrl
        }).then(() => {
            showToast('✅ 위치가 공유되었습니다', 'success');
        }).catch(() => {
            copyToClipboard(naverUrl);
        });
    } else {
        // 데스크톱: URL 복사
        copyToClipboard(naverUrl);
    }
}

// URL 클립보드 복사
function copyToClipboard(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            showToast('🔗 지도 링크가 복사되었습니다', 'success');
        });
    }
}

// 토스트 알림 표시
function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-notification fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
    
    // 타입별 스타일
    const styles = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white'
    };
    
    toast.className += ` ${styles[type] || styles.info}`;
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="text-sm font-medium">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // 애니메이션
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 100);
    
    // 자동 제거
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
}