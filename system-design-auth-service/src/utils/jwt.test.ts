import { signAccessToken, verifyAccessToken } from './jwt.js';

describe('JWT utils', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ sub: 123, email: 'test@example.com' }, '1h');
    const payload = verifyAccessToken(token);
    expect(payload).toMatchObject({ sub: 123, email: 'test@example.com' });
  });
});
