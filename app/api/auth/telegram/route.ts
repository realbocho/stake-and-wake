import { ok, fail } from "@/lib/api";
import { createSession } from "@/lib/session";
import { verifyTelegramInitData } from "@/lib/telegram";
import { telegramAuthSchema } from "@/lib/validators";
import { upsertTelegramUser } from "@/lib/repositories/users";
import { sha256Hex } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    const body = telegramAuthSchema.parse(await request.json());
    const telegram = verifyTelegramInitData(body.initData);
    const displayName = telegram.username
      ? `@${telegram.username}`
      : [telegram.firstName, telegram.lastName].filter(Boolean).join(" ");
    const user = await upsertTelegramUser({
      telegramId: telegram.telegramId,
      displayName,
      avatarUrl: telegram.photoUrl,
      deviceIdHash: sha256Hex(body.deviceId),
      inviteCode: body.inviteCode
    });
    await createSession({
      userId: user.id,
      telegramId: user.telegramId
    });
    return ok({ ok: true, user });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Telegram authentication failed.";
    return fail(message, 401);
  }
}
