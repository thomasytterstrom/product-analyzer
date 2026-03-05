import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { buildServer } from "./server.js";
import { getEnv } from "./env.js";

const env = getEnv(process.env);

const databaseUrl = env.DATABASE_URL;
const jwtSecret = env.SUPABASE_JWT_SECRET;
const sourceDbPath = env.SOURCE_DB_PATH ? path.resolve(env.SOURCE_DB_PATH) : undefined;
const metadataDbPath = env.METADATA_DB_PATH ? path.resolve(env.METADATA_DB_PATH) : undefined;

// Ensure the sidecar DB directory exists if using SQLite.
if (metadataDbPath) {
	fs.mkdirSync(path.dirname(metadataDbPath), { recursive: true });
}

const app = buildServer({ databaseUrl, jwtSecret, sourceDbPath, metadataDbPath });

const port = env.PORT ?? 5174;
const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

async function main() {
	await app.listen({ port, host });
	const address = app.server.address();
	const printable = typeof address === "string" ? address : `http://${host}:${port}`;
	console.log(`@product-analyzer/api listening on ${printable}`);
}

function shutdown(signal: string) {
	console.log(`@product-analyzer/api shutting down (${signal})`);
	void app.close().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
	console.error("@product-analyzer/api failed to start", err);
	process.exit(1);
});
