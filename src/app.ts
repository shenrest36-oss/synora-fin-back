import './types/express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRoutes from './routes/index';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(requestLogger);

// Trust proxy for correct IP extraction
app.set('trust proxy', 1);

// API routes
app.use('/api/v1', apiRoutes);

// 404 handler (must be after routes)
app.use(notFoundHandler);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
