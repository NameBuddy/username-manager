import { defineConfig } from "prisma/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env");
if (!process.env.DATABASE_URL && existsSync(envPath)) {
  const match = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (match?.[1]) {
    process.env.DATABASE_URL = match[1].trim().replace(/^"|"$/g, "");
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://namedb:namedb@localhost:5433/namedb?schema=public",
  },
});
