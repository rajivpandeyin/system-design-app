import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/auth', authRoutes);

app.get('/metrics', requireAuth, (req, res) => {
  res.json({ requestsPerMin: 120, healthyHosts: 3 });
});

app.get('/', (req, res) => res.json({ ok: true }));

export default app;
