import request from 'supertest';
import app from '../app.js';
import * as userDao from '../dao/userDao.js';
import * as refreshTokenDao from '../dao/refreshTokenDao.js';
import bcrypt from 'bcrypt';

jest.mock('../dao/userDao', () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  updateUserById: jest.fn(),
}));

jest.mock('../dao/refreshTokenDao', () => ({
  storeRefreshToken: jest.fn(),
  lookupRefreshToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
}));

describe('Auth routes', () => {
  const mockedUserDao = userDao as {
    findUserByEmail: jest.Mock;
    findUserById: jest.Mock;
    createUser: jest.Mock;
    updateUserById: jest.Mock;
  };

  const mockedRefreshTokenDao = refreshTokenDao as {
    storeRefreshToken: jest.Mock;
    lookupRefreshToken: jest.Mock;
    deleteRefreshToken: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should signup successfully', async () => {
    mockedUserDao.findUserByEmail.mockResolvedValueOnce(null);
    mockedUserDao.createUser.mockResolvedValueOnce({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'hashed-secret',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .post('/auth/signup')
      .send({ name: 'Test User', email: 'test@example.com', password: 'secret12' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body.user.email).toBe('test@example.com');
    expect(mockedRefreshTokenDao.storeRefreshToken).toHaveBeenCalled();
  });

  it('should reject duplicate email on signup', async () => {
    mockedUserDao.findUserByEmail.mockResolvedValueOnce({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'hashed-secret',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .post('/auth/signup')
      .send({ name: 'Test User', email: 'test@example.com', password: 'secret12' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Email already in use');
  });

  it('should login successfully', async () => {
    const hashed = await bcrypt.hash('secret12', 1);
    mockedUserDao.findUserByEmail.mockResolvedValueOnce({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'secret12' });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('test@example.com');
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('refreshToken');
    expect(mockedRefreshTokenDao.storeRefreshToken).toHaveBeenCalled();
  });
});
