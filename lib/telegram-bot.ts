import { env } from "@/lib/env";

export async function sendSuccessToGroup(input: {
  displayName: string;
  wakeTime: string;
  profitTon: number;
}) {
  if (!env.telegramGroupChatId || env.telegramBotToken === "replace_me") {
    return;
  }

  const text =
    `${input.displayName} cleared today’s wake mission at ${input.wakeTime}. ` +
    `Estimated reward is pending settlement. Current visible profit: +${input.profitTon.toFixed(2)} TON`;

  const response = await fetch(
    `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: env.telegramGroupChatId,
        text
      })
    }
  );

  if (!response.ok) {
    throw new Error("Failed to send Telegram group notification.");
  }
}
