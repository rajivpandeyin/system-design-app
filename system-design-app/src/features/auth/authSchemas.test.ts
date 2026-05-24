import { loginSchema, signupSchema } from './authSchemas';

describe('authSchemas', () => {
  describe('loginSchema', () => {
    it('accepts valid login input', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret1' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret1' });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: '123' });
      expect(result.success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('accepts valid signup input', () => {
      const result = signupSchema.safeParse({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = signupSchema.safeParse({
        name: 'J',
        email: 'jane@example.com',
        password: 'secret1',
      });
      expect(result.success).toBe(false);
    });
  });
});
