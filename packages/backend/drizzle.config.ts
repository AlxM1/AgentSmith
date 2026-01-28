// Drizzle Configuration

import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'agentsmith',
    user: process.env.DB_USERNAME || 'agentsmith',
    password: process.env.DB_PASSWORD || 'password',
  },
} satisfies Config;
