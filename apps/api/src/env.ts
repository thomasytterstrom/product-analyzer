import { z } from "zod";

const EnvSchema = z.object({
  // Connection string for Postgres (optional, falls back to SQLite)
  DATABASE_URL: z.string().optional(),

  // Optional separate connection string used only by the sync route.
  SYNC_DATABASE_URL: z.string().optional(),

  // JWT Secret for Supabase Auth (optional, if provided auth is enforced)
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Path to existing snapshot DB (read-only, used if DATABASE_URL is missing)
  SOURCE_DB_PATH: z.string().optional(),

  // Path to app-owned sidecar DB (read-write, used if DATABASE_URL is missing)
  METADATA_DB_PATH: z.string().optional(),

  // Optional API port
  PORT: z.coerce.number().int().positive().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(env: NodeJS.ProcessEnv): Env {
  return EnvSchema.parse(env);
}
