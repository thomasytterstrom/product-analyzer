import { z } from "zod";

const EnvSchema = z.object({
  // Path to existing snapshot DB (read-only)
  SOURCE_DB_PATH: z.string().min(1),

  // Path to app-owned sidecar DB (read-write)
  METADATA_DB_PATH: z.string().min(1),

  // Optional API port
  PORT: z.coerce.number().int().positive().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(env: NodeJS.ProcessEnv): Env {
  return EnvSchema.parse(env);
}
