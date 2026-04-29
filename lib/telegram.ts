import crypto from "crypto";
import { env } from "@/lib/env";

export type TelegramAuthResult = {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
};

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  const hash = params.get("hash");

  if (!hash) {
    throw new Error("Telegram initData hash is missing.");
  }

  const dataCheckString = entries
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  return { params, hash, dataCheckString };
}

export function verifyTelegramInitData(initData: string): TelegramAuthResult {
  const { params, hash, dataCheckString } = parseInitData(initData);
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.telegramBotToken)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    throw new Error("Telegram initData verification failed.");
  }

  const userJson = params.get("user");
  if (!userJson) {
    throw new Error("Telegram user payload is missing.");
  }

  const user = JSON.parse(userJson) as {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };

  return {
    telegramId: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: user.photo_url
  };
}
