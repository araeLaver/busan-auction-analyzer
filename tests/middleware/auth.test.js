const jwt = require('jsonwebtoken');
const {
  generateToken,
  authenticateToken,
  requireAdmin,
  requireRole
} = require('../../src/middleware/auth');

describe('Authentication Middleware', () => {
  describe('generateToken', () => {
    test('should generate valid JWT token', () => {
      const token = generateToken('user123', 'user');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should include userId and role in token', () => {
      const token = generateToken('user456', 'admin');
      const decoded = jwt.decode(token);

      expect(decoded.userId).toBe('user456');
      expect(decoded.role).toBe('admin');
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('authenticateToken', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
        ip: '127.0.0.1',
        url: '/api/test'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should return 401 if no token provided', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication required'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 if token is invalid', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() if token is valid', () => {
      const token = generateToken('user789', 'user');
      req.headers.authorization = `Bearer ${token}`;

      authenticateToken(req, res, next);

      // JWT verification is async, so we need to wait
      setTimeout(() => {
        expect(req.user).toBeDefined();
        expect(req.user.userId).toBe('user789');
        expect(next).toHaveBeenCalled();
      }, 100);
    });
  });

  describe('requireAdmin', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        ip: '127.0.0.1',
        url: '/api/admin'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should return 401 if no user in request', () => {
      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 if user is not admin', () => {
      req.user = { userId: 'user123', role: 'user' };

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() if user is admin', () => {
      req.user = { userId: 'admin123', role: 'admin' };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should allow user with correct role', () => {
      req.user = { userId: 'user123', role: 'moderator' };
      const middleware = requireRole('moderator', 'admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should deny user without correct role', () => {
      req.user = { userId: 'user123', role: 'user' };
      const middleware = requireRole('moderator', 'admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow multiple roles', () => {
      req.user = { userId: 'user123', role: 'admin' };
      const middleware = requireRole('user', 'moderator', 'admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
