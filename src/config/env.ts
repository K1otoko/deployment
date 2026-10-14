import { z } from 'zod';

const developmentDatabaseUrl =
  'postgresql://postgres:postgres@127.0.0.1:5432/deployment';

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
    DATABASE_URL: z.url().optional(),
    TRUST_PROXY: z.string().default('false'),
    APP_VERSION: z.string().min(1).default('0.1.0'),
    BUILD_SHA: z.string().min(1).default('development'),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.DATABASE_URL === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required in production',
      });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  trustProxy: boolean | number | string;
  appVersion: string;
  buildSha: string;
}

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }

  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : value;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = environmentSchema.parse(environment);

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL ?? developmentDatabaseUrl,
    trustProxy: parseTrustProxy(parsed.TRUST_PROXY),
    appVersion: parsed.APP_VERSION,
    buildSha: parsed.BUILD_SHA,
  };
}
