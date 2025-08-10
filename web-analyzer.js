// URL 입력을 통한 개별 물건 분석 웹 인터페이스
const express = require('express');
const cors = require('cors');
const path = require('path');
const SinglePropertyScraper = require('./src/scraper/SinglePropertyScraper');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log('🔍 개별 물건 분석 웹 서비스 시작 중...');

// 분석 중인 작업들을 추적
const analysisJobs = new Map();

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: '개별 물건 분석 서비스',
    timestamp: new Date().toISOString() 
  });
});

// URL로 개별 물건 분석 요청
app.post('/api/analyze-url', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL이 필요합니다.' });
  }
  
  // URL 유효성 검사
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: '유효하지 않은 URL입니다.' });
  }
  
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔍 새 분석 요청 (${jobId}): ${url}`);
  
  // 비동기 분석 시작
  analysisJobs.set(jobId, {
    status: 'running',
    url: url,
    startTime: new Date(),
    progress: 0
  });
  
  // 백그라운드에서 분석 실행
  performAnalysis(jobId, url).catch(error => {
    console.error(`분석 실패 (${jobId}):`, error);
    analysisJobs.set(jobId, {
      ...analysisJobs.get(jobId),
      status: 'error',
      error: error.message,
      endTime: new Date()
    });
  });
  
  res.json({ 
    jobId: jobId,
    status: 'started',
    message: '분석이 시작되었습니다. 결과를 확인하려면 잠시 후 상태를 조회해주세요.'
  });
});

// 분석 상태 조회
app.get('/api/analysis-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: '분석 작업을 찾을 수 없습니다.' });
  }
  
  res.json(job);
});

// 분석 실행 함수
async function performAnalysis(jobId, url) {
  const scraper = new SinglePropertyScraper();
  
  try {
    // 진행상황 업데이트
    updateJobProgress(jobId, 10, '브라우저 초기화 중...');
    
    await scraper.initialize(true); // headless 모드
    
    updateJobProgress(jobId, 30, '페이지 로딩 중...');
    
    const result = await scraper.analyzePropertyFromUrl(url);
    
    updateJobProgress(jobId, 90, '분석 완료, 결과 정리 중...');
    
    // 결과 저장
    const filename = await scraper.saveAnalysisToJSON(result, `analysis_${jobId}.json`);
    
    // 작업 완료
    analysisJobs.set(jobId, {
      ...analysisJobs.get(jobId),
      status: 'completed',
      result: result,
      filename: filename,
      progress: 100,
      message: '분석이 완료되었습니다.',
      endTime: new Date()
    });
    
    console.log(`✅ 분석 완료 (${jobId})`);
    
  } catch (error) {
    console.error(`❌ 분석 오류 (${jobId}):`, error);
    
    analysisJobs.set(jobId, {
      ...analysisJobs.get(jobId),
      status: 'error',
      error: error.message,
      progress: 100,
      endTime: new Date()
    });
  } finally {
    await scraper.close();
  }
}

// 진행상황 업데이트 헬퍼 함수
function updateJobProgress(jobId, progress, message) {
  const job = analysisJobs.get(jobId);
  if (job) {
    analysisJobs.set(jobId, {
      ...job,
      progress: progress,
      message: message,
      lastUpdate: new Date()
    });
  }
}

// 분석 결과 다운로드
app.get('/api/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);
  
  if (!job || job.status !== 'completed') {
    return res.status(404).json({ error: '분석 결과를 찾을 수 없습니다.' });
  }
  
  if (!job.filename) {
    return res.status(500).json({ error: '결과 파일을 생성할 수 없습니다.' });
  }
  
  const fs = require('fs');
  const filePath = path.join(__dirname, job.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, `property-analysis-${jobId}.json`);
  } else {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// 활성 분석 목록
app.get('/api/analysis-list', (req, res) => {
  const jobList = Array.from(analysisJobs.entries()).map(([id, job]) => ({
    jobId: id,
    url: job.url,
    status: job.status,
    progress: job.progress,
    startTime: job.startTime,
    endTime: job.endTime,
    message: job.message
  }));
  
  res.json(jobList.slice(-10)); // 최근 10개만
});

// 웹 인터페이스용 HTML
app.get('/analyzer', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>개별 경매물건 분석기</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .progress-bar {
            transition: width 0.3s ease-in-out;
        }
    </style>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
            <!-- 헤더 -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">🔍 개별 경매물건 분석기</h1>
                <p class="text-gray-600">URL을 입력하면 해당 경매물건의 상세 분석을 제공합니다.</p>
            </div>

            <!-- URL 입력 폼 -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 class="text-xl font-semibold mb-4">📝 분석할 물건 URL 입력</h2>
                <div class="flex gap-2">
                    <input 
                        type="url" 
                        id="urlInput" 
                        placeholder="https://www.courtauction.go.kr/..." 
                        class="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <button 
                        onclick="startAnalysis()" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                    >
                        분석 시작
                    </button>
                </div>
                <p class="text-sm text-gray-500 mt-2">
                    💡 법원경매정보 사이트의 개별 물건 상세 페이지 URL을 입력해주세요.
                </p>
            </div>

            <!-- 진행상황 -->
            <div id="progressSection" class="bg-white rounded-lg shadow-md p-6 mb-6 hidden">
                <h2 class="text-xl font-semibold mb-4">📊 분석 진행상황</h2>
                <div class="mb-2">
                    <div class="flex justify-between text-sm">
                        <span id="progressText">분석 준비 중...</span>
                        <span id="progressPercent">0%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div id="progressBar" class="progress-bar bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
                    </div>
                </div>
                <p class="text-sm text-gray-600" id="progressMessage">잠시만 기다려주세요...</p>
            </div>

            <!-- 분석 결과 -->
            <div id="resultSection" class="bg-white rounded-lg shadow-md p-6 hidden">
                <h2 class="text-xl font-semibold mb-4">📋 분석 결과</h2>
                <div id="analysisResult">
                    <!-- 결과가 여기에 동적으로 삽입됩니다 -->
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentJobId = null;
        let pollInterval = null;

        async function startAnalysis() {
            const url = document.getElementById('urlInput').value.trim();
            
            if (!url) {
                alert('URL을 입력해주세요.');
                return;
            }

            try {
                const response = await fetch('/api/analyze-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: url })
                });

                const result = await response.json();

                if (response.ok) {
                    currentJobId = result.jobId;
                    showProgress();
                    startPolling();
                } else {
                    alert('오류: ' + result.error);
                }
            } catch (error) {
                alert('분석 요청 실패: ' + error.message);
            }
        }

        function showProgress() {
            document.getElementById('progressSection').classList.remove('hidden');
            document.getElementById('resultSection').classList.add('hidden');
        }

        function startPolling() {
            pollInterval = setInterval(checkStatus, 2000); // 2초마다 상태 확인
        }

        function stopPolling() {
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }

        async function checkStatus() {
            if (!currentJobId) return;

            try {
                const response = await fetch('/api/analysis-status/' + currentJobId);
                const status = await response.json();

                updateProgress(status);

                if (status.status === 'completed') {
                    stopPolling();
                    showResult(status.result);
                } else if (status.status === 'error') {
                    stopPolling();
                    showError(status.error);
                }
            } catch (error) {
                console.error('상태 확인 오류:', error);
            }
        }

        function updateProgress(status) {
            const progressBar = document.getElementById('progressBar');
            const progressPercent = document.getElementById('progressPercent');
            const progressText = document.getElementById('progressText');
            const progressMessage = document.getElementById('progressMessage');

            progressBar.style.width = status.progress + '%';
            progressPercent.textContent = status.progress + '%';
            progressText.textContent = status.message || '분석 중...';
            progressMessage.textContent = '작업 ID: ' + currentJobId;
        }

        function showResult(result) {
            document.getElementById('progressSection').classList.add('hidden');
            document.getElementById('resultSection').classList.remove('hidden');

            const analysisResult = document.getElementById('analysisResult');
            analysisResult.innerHTML = generateResultHTML(result);
        }

        function showError(error) {
            document.getElementById('progressSection').classList.add('hidden');
            document.getElementById('resultSection').classList.remove('hidden');

            const analysisResult = document.getElementById('analysisResult');
            analysisResult.innerHTML = \`
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 class="text-red-800 font-semibold">❌ 분석 실패</h3>
                    <p class="text-red-700 mt-2">\${error}</p>
                </div>
            \`;
        }

        function generateResultHTML(result) {
            const analysis = result.analysis || {};
            
            return \`
                <!-- 기본 정보 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-lg mb-3">📋 기본 정보</h3>
                        <div class="space-y-2 text-sm">
                            <div><span class="text-gray-600">사건번호:</span> <span class="font-medium">\${result.caseNumber || '정보없음'}</span></div>
                            <div><span class="text-gray-600">법원:</span> <span class="font-medium">\${result.court || '정보없음'}</span></div>
                            <div><span class="text-gray-600">물건유형:</span> <span class="font-medium">\${result.propertyType || '정보없음'}</span></div>
                            <div><span class="text-gray-600">주소:</span> <span class="font-medium">\${result.address || '정보없음'}</span></div>
                        </div>
                    </div>

                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-lg mb-3">💰 가격 정보</h3>
                        <div class="space-y-2 text-sm">
                            <div><span class="text-gray-600">감정가:</span> <span class="font-medium">\${result.appraisalValue || '정보없음'}</span></div>
                            <div><span class="text-gray-600">최저매각가:</span> <span class="font-medium">\${result.minimumSalePrice || '정보없음'}</span></div>
                            <div><span class="text-gray-600">입찰보증금:</span> <span class="font-medium">\${result.bidDeposit || '정보없음'}</span></div>
                        </div>
                    </div>
                </div>

                <!-- 투자 분석 -->
                \${analysis.investmentScore ? \`
                <div class="bg-blue-50 p-6 rounded-lg mb-6">
                    <h3 class="font-semibold text-lg mb-4">📈 투자 분석 결과</h3>
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div class="text-center">
                            <div class="text-3xl font-bold text-blue-600">\${analysis.investmentScore}</div>
                            <div class="text-sm text-gray-600">종합점수</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">\${analysis.discountRate}%</div>
                            <div class="text-sm text-gray-600">할인율</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-purple-600">\${analysis.successProbability}%</div>
                            <div class="text-sm text-gray-600">낙찰확률</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-bold text-orange-600">\${analysis.riskLevel.toUpperCase()}</div>
                            <div class="text-sm text-gray-600">위험도</div>
                        </div>
                    </div>
                    
                    <div class="text-center">
                        <div class="text-lg font-semibold text-gray-800">\${analysis.recommendation}</div>
                    </div>
                </div>
                \` : ''}

                <!-- 장단점 -->
                \${analysis.pros || analysis.cons ? \`
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    \${analysis.pros && analysis.pros.length > 0 ? \`
                    <div class="bg-green-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-green-800 mb-3">✅ 투자 장점</h3>
                        <ul class="space-y-1 text-sm text-green-700">
                            \${analysis.pros.map(pro => \`<li>• \${pro}</li>\`).join('')}
                        </ul>
                    </div>
                    \` : ''}

                    \${analysis.cons && analysis.cons.length > 0 ? \`
                    <div class="bg-red-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-red-800 mb-3">⚠️ 위험 요소</h3>
                        <ul class="space-y-1 text-sm text-red-700">
                            \${analysis.cons.map(con => \`<li>• \${con}</li>\`).join('')}
                        </ul>
                    </div>
                    \` : ''}
                </div>
                \` : ''}

                <!-- 다운로드 버튼 -->
                <div class="mt-6 text-center">
                    <button 
                        onclick="downloadResult()" 
                        class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
                    >
                        📁 상세 분석 결과 다운로드 (JSON)
                    </button>
                </div>
            \`;
        }

        function downloadResult() {
            if (currentJobId) {
                window.location.href = '/api/download/' + currentJobId;
            }
        }

        // 엔터 키로 분석 시작
        document.getElementById('urlInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                startAnalysis();
            }
        });
    </script>
</body>
</html>
  `);
});

// 메인 페이지
app.get('/', (req, res) => {
  res.redirect('/analyzer');
});

// 서버 시작
app.listen(PORT, () => {
  console.log('\n🎉 개별 물건 분석 웹 서비스 시작 완료!');
  console.log('=' .repeat(50));
  console.log(`🌐 웹 분석기: http://localhost:${PORT}/analyzer`);
  console.log(`🔍 API 상태: http://localhost:${PORT}/api/health`);
  console.log('=' .repeat(50));
  console.log('\n📚 사용 가능한 API:');
  console.log('  POST /api/analyze-url     - URL 분석 요청');
  console.log('  GET  /api/analysis-status - 분석 상태 확인');
  console.log('  GET  /api/download        - 결과 파일 다운로드');
  console.log('\n💡 브라우저에서 http://localhost:3001/analyzer 접속해주세요!');
});

module.exports = app;