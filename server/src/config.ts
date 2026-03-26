import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  ADMIN_EMAIL: z.string().email().default('admin@pulse.local'),
  ADMIN_PASSWORD: z.string().min(1).default('changeme'),
  SESSION_SECRET: z.string().min(16).default('change-me-to-a-random-secret'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const config = envSchema.parse(process.env);
