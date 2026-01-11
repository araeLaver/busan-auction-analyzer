// 인증 관련 유틸리티

const API_BASE = '/api/auth';

// 로그인 처리
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('message');

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 토큰 및 사용자 정보 저장
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            messageEl.textContent = '로그인 성공! 이동 중...';
            messageEl.className = 'mt-4 text-center text-sm text-green-600';
            messageEl.classList.remove('hidden');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            throw new Error(data.error || '로그인 실패');
        }
    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        messageEl.classList.remove('hidden');
    }
}

// 회원가입 처리
async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const nickname = document.getElementById('regNickname').value;
    const messageEl = document.getElementById('message');

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, nickname })
        });

        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = '가입 완료! 로그인해주세요.';
            messageEl.className = 'mt-4 text-center text-sm text-green-600';
            messageEl.classList.remove('hidden');
            
            // 폼 초기화 및 로그인 탭으로 전환
            document.getElementById('registerForm').reset();
            setTimeout(() => switchTab('login'), 1500);
        } else {
            throw new Error(data.error || '회원가입 실패');
        }
    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.className = 'mt-4 text-center text-sm text-red-600';
        messageEl.classList.remove('hidden');
    }
}

// 로그아웃
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// 토큰 가져오기 (API 호출 시 사용)
function getToken() {
    return localStorage.getItem('token');
}

// 로그인 상태 확인
function isLoggedIn() {
    return !!localStorage.getItem('token');
}

// 현재 사용자 정보 가져오기
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// UI 업데이트 (헤더의 로그인/로그아웃 버튼 등)
function updateAuthUI() {
    const authContainer = document.getElementById('authContainer'); // index.html에 추가해야 함
    if (!authContainer) return;

    if (isLoggedIn()) {
        const user = getCurrentUser();
        authContainer.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-sm text-white opacity-90">반가워요, <strong>${user.nickname}</strong>님</span>
                <button onclick="logout()" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-lg text-sm transition-all">
                    로그아웃
                </button>
            </div>
        `;
    } else {
        authContainer.innerHTML = `
            <a href="/login.html" class="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md">
                로그인 / 가입
            </a>
        `;
    }
}
