import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import chatRoutes from './routes/chat';
import homeworkRoutes from './routes/homework';
import billingRoutes from './routes/billing';
import transcriptRoutes from './routes/transcript';
import adminRoutes from './routes/admin';
import { attachVoiceSocketServer } from './lib/voiceSocketServer';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Please wait a minute and try again.' },
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'kidsko-backend',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/admin', adminRoutes);

const getLocalIp = (): string => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const httpServer = app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`✅ Kidsko backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Host Local:       http://localhost:${PORT}/health`);
  console.log(`   Detected LAN IP:  http://${localIp}:${PORT}/health`);
  console.log(`   Android Emulator: http://10.0.2.2:${PORT}/health`);
  console.log(`   Voice WebSocket:  ws://10.0.2.2:${PORT}/ws/voice (or ws://${localIp}:${PORT}/ws/voice)`);
});

attachVoiceSocketServer(httpServer);