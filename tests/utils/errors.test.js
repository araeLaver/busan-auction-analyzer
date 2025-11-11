const {
  AppError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  DatabaseError
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('AppError', () => {
    test('should create error with correct properties', () => {
      const error = new AppError('Test error', 500);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
    });

    test('should have toJSON method', () => {
      const error = new AppError('Test error', 400);
      const json = error.toJSON();

      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('statusCode');
      expect(json).toHaveProperty('timestamp');
    });
  });

  describe('AuthenticationError', () => {
    test('should create with 401 status code', () => {
      const error = new AuthenticationError();

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication failed');
    });

    test('should accept custom message', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.message).toBe('Invalid credentials');
    });
  });

  describe('NotFoundError', () => {
    test('should create with resource and id', () => {
      const error = new NotFoundError('Property', 123);

      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Property');
      expect(error.message).toContain('123');
      expect(error.resource).toBe('Property');
      expect(error.resourceId).toBe(123);
    });

    test('should create without id', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.resourceId).toBeNull();
    });
  });

  describe('ValidationError', () => {
    test('should create with errors array', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' }
      ];
      const error = new ValidationError('Validation failed', errors);

      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(errors);
    });

    test('toJSON should include errors', () => {
      const errors = [{ field: 'name', message: 'Required' }];
      const error = new ValidationError('Validation failed', errors);
      const json = error.toJSON();

      expect(json.errors).toEqual(errors);
    });
  });

  describe('DatabaseError', () => {
    test('should create with original error', () => {
      const originalError = new Error('Connection timeout');
      const error = new DatabaseError('DB operation failed', originalError);

      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBe(originalError);
    });
  });
});
