import { loadBootstrap } from "@/lib/bootstrap";
import { ok } from "@/lib/api";

export async function GET() {
  return ok(await loadBootstrap());
}
