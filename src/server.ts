import { z } from "zod";

import { buildApp } from "./app.js";

const environmentSchema = z.object({
  DATABASE_PATH: z.string().min(1).default("data/expenses.sqlite"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000)
});

const environment = environmentSchema.parse(process.env);
const app = buildApp({
  databasePath: environment.DATABASE_PATH,
  logger: true
});

await app.listen({
  host: environment.HOST,
  port: environment.PORT
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    process.exitCode = 0;
  });
}
