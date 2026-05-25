import { env } from "@/lib/env";

const ADMIN_CHAT_ID = "8285342979";

export async function POST(request: Request) {
  const body = await request.json();
  const message = body?.message;
  if (!message?.text) return new Response("ok");

  const fromUser = message.from?.username ?? message.from?.first_name ?? "Unknown";
  const fromId = message.from?.id;
  const text = message.text;

  // /start 명령어
  if (text === "/start") {
    await sendMessage(fromId, "Hello! Please type your inquiry and we'll get back to you as soon as possible.");
    return new Response("ok");
  }

  // 유저 메시지 → 관리자에게 포워딩
  const fromLink = message.from?.username
    ? `@${fromUser}`
    : `tg://user?id=${fromId}`;

  await sendMessage(
    ADMIN_CHAT_ID,
    `📩 문의 from ${fromLink} (id: ${fromId})\n\n${text}`
  );

  // 유저에게 접수 확인
  await sendMessage(fromId, "Your inquiry has been received. We'll get back to you soon! 😊");

  return new Response("ok");
}

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
