const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const { ValidationError, AuthenticationError } = require('../utils/errors');

class AuthService {
  constructor() {
    this.saltRounds = 10;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-it-in-production';
    this.jwtExpiresIn = '24h';
  }

  /**
   * 회원가입
   */
  async register(email, password, nickname) {
    if (!email || !password) {
      throw new ValidationError('이메일과 비밀번호는 필수입니다.');
    }

    const client = await pool.connect();
    try {
      // 이메일 중복 확인
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new ValidationError('이미 사용 중인 이메일입니다.');
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, this.saltRounds);

      // 사용자 생성
      const query = `
        INSERT INTO users (email, password_hash, nickname)
        VALUES ($1, $2, $3)
        RETURNING id, email, nickname, role, created_at
      `;
      
      const result = await client.query(query, [email, hashedPassword, nickname || email.split('@')[0]]);
      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * 로그인
   */
  async login(email, password) {
    const client = await pool.connect();
    try {
      // 사용자 조회
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        throw new AuthenticationError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }

      // 비밀번호 검증
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        throw new AuthenticationError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }

      // 로그인 시간 업데이트
      await client.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      // 토큰 생성
      const token = this.generateToken(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role
        },
        token
      };

    } finally {
      client.release();
    }
  }

  /**
   * JWT 토큰 생성
   */
  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
  }
}

module.exports = AuthService;
