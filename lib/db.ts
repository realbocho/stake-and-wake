import postgres from "postgres";
import { env } from "@/lib/env";

let sqlInstance: postgres.Sql | null = null;

export function getSql() {
  if (!sqlInstance) {
    sqlInstance = postgres(env.databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }

  return sqlInstance;
}
