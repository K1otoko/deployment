import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/env.js';

describe('loadConfig', () => {
  it('provides development defaults', () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 4100,
      databaseUrl:
        'postgresql://postgres:postgres@127.0.0.1:5432/deployment',
      trustProxy: false,
      appVersion: '0.1.0',
      buildSha: 'development',
    });
  });

  it('requires a database URL in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL is required in production',
    );
  });

  it('parses a numeric trust proxy value', () => {
    const config = loadConfig({ TRUST_PROXY: '2' });

    expect(config.trustProxy).toBe(2);
  });
});
