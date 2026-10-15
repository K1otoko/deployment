import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/deployment_test',
  APP_VERSION: '0.1.0-test',
  BUILD_SHA: 'test-sha',
});

describe('deployment service', () => {
  it('returns service metadata', async () => {
    const app = createApp({
      config,
      checkDatabase: vi.fn().mockResolvedValue(undefined),
    });

    const response = await request(app).get('/api').expect(200);

    expect(response.body).toEqual({
      name: 'deployment-server',
      version: '0.1.0-test',
    });
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('reports liveness without checking the database', async () => {
    const checkDatabase = vi.fn().mockRejectedValue(new Error('unavailable'));
    const app = createApp({ config, checkDatabase });

    await request(app).get('/api/health').expect(200, {
      status: 'ok',
      service: 'deployment-server',
    });
    expect(checkDatabase).not.toHaveBeenCalled();
  });

  it('reports readiness when the database is available', async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ config, checkDatabase });

    await request(app).get('/api/health/ready').expect(200, {
      status: 'ready',
      service: 'deployment-server',
    });
    expect(checkDatabase).toHaveBeenCalledOnce();
  });

  it('reports an unavailable readiness state when the database fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({
      config,
      checkDatabase: vi.fn().mockRejectedValue(new Error('unavailable')),
    });

    await request(app).get('/api/health/ready').expect(503, {
      status: 'unavailable',
      service: 'deployment-server',
    });
    errorLog.mockRestore();
  });

  it('returns version metadata', async () => {
    const app = createApp({
      config,
      checkDatabase: vi.fn().mockResolvedValue(undefined),
    });

    await request(app).get('/api/version').expect(200, {
      version: '0.1.0-test',
      buildSha: 'test-sha',
    });
  });

  it('uses a consistent not-found response', async () => {
    const app = createApp({
      config,
      checkDatabase: vi.fn().mockResolvedValue(undefined),
    });

    await request(app).get('/api/missing').expect(404, {
      error: 'not_found',
    });
  });

  it('does not expose legacy unversioned routes', async () => {
    const app = createApp({
      config,
      checkDatabase: vi.fn().mockResolvedValue(undefined),
    });

    await request(app).get('/health').expect(404, {
      error: 'not_found',
    });
  });
});
