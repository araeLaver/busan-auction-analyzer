const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthService = require('../services/AuthService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const authService = new AuthService();

// 로그인 시도 제한 (15분에 10회)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '너무 많은 로그인 시도가 감지되었습니다. 잠시 후 다시 시도해주세요.' }
});

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    const user = await authService.register(email, password, nickname);
    
    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('회원가입 오류:', error);
      res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
    }
  }
});

// 로그인
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    res.json({
      message: '로그인 성공',
      ...result
    });
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('로그인 오류:', error);
      res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
    }
  }
});

// 내 정보 조회 (인증 테스트)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
