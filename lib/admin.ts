import { env } from "@/lib/env";

export function assertAdmin(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.adminApiKey) {
    throw new Error("Forbidden");
  }
}
