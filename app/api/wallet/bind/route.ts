import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { bindWallet } from "@/lib/repositories/users";
import { bindWalletSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = bindWalletSchema.parse(await request.json());
    await bindWallet(session.userId, body.walletAddress);
    return ok({ ok: true, walletAddress: body.walletAddress });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Wallet bind failed.";
    return fail(message);
  }
}
