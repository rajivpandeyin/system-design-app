import express from 'express';
import { login, logout, refresh, signup, getProfile, updateProfile } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', requireAuth, getProfile);
router.put('/me', requireAuth, updateProfile);

export default router;
