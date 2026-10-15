import { randomUUID } from 'node:crypto';

import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';

import type { AppConfig } from './config/env.js';

export interface AppDependencies {
  config: AppConfig;
  checkDatabase: () => Promise<void>;
}

function getRequestId(candidate: string | undefined): string {
  if (
    candidate !== undefined &&
    candidate.length > 0 &&
    candidate.length <= 128
  ) {
    return candidate;
  }

  return randomUUID();
}

export function createApp({
  config,
  checkDatabase,
}: AppDependencies): Express {
  const app = express();
  const api = express.Router();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use((request, response, next) => {
    response.setHeader('X-Request-Id', getRequestId(request.get('x-request-id')));
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  api.get('/', (_request, response) => {
    response.json({
      name: 'deployment-server',
      version: config.appVersion,
    });
  });

  api.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'deployment-server',
    });
  });

  api.get('/health/ready', async (_request, response) => {
    try {
      await checkDatabase();
      response.json({
        status: 'ready',
        service: 'deployment-server',
      });
    } catch (error) {
      console.error('readiness check failed', error);
      response.status(503).json({
        status: 'unavailable',
        service: 'deployment-server',
      });
    }
  });

  api.get('/version', (_request, response) => {
    response.json({
      version: config.appVersion,
      buildSha: config.buildSha,
    });
  });

  app.use('/api', api);

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    console.error('unhandled request error', error);

    if (response.headersSent) {
      return;
    }

    const status = (error as { status?: unknown }).status;
    const expose = (error as { expose?: unknown }).expose === true;

    if (
      expose &&
      typeof status === 'number' &&
      status >= 400 &&
      status < 500
    ) {
      response.status(status).json({
        error: 'invalid_request',
        message: '请求格式不正确',
      });
      return;
    }

    response.status(500).json({ error: 'internal_server_error' });
  };

  app.use(errorHandler);

  return app;
}
