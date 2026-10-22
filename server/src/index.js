import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { initDatabase } from './config/db.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/member.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Veuillez patienter quelques minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requêtes atteinte. Veuillez réessayer dans un instant.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Point de terminaison API introuvable.' });
});

const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[MONERA API ERROR]', err);
  res.status(500).json({
    error: 'Une erreur interne sécurisée est survenue. Opération annulée sans impact sur vos fonds.',
  });
});

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[MONERA BANK CORE] Listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[MONERA DB FATAL]', err);
    process.exit(1);
  });
