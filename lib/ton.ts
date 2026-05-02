import { beginCell } from "@ton/core";

export function toNanoTon(valueTon: number) {
  return BigInt(Math.round(valueTon * 1_000_000_000));
}

export function encodeBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export function buildStakePayload(input: {
  challengeId: string;
  telegramId: string;
  wakeTime: string;
}) {
  const comment = `stakewake:${input.challengeId}:${input.telegramId}:${input.wakeTime}`;
  return encodeBase64(
    beginCell().storeUint(0, 32).storeStringTail(comment).endCell().toBoc()
  );
}

// ─── On-chain transaction verification ───────────────────────────────────────
const TONCENTER_BASE =
  process.env.TON_NETWORK === "mainnet"
    ? "https://toncenter.com/api/v2"
    : "https://testnet.toncenter.com/api/v2";

type TonTransaction = {
  transaction_id: { hash: string };
  in_msg: {
    source: string;
    destination: string;
    value: string;
    msg_data?: {
      type?: string;
      text?: string;
      body?: string;
    };
    message?: string;
  };
};

type TonGetTransactionsResponse = {
  ok: boolean;
  result: TonTransaction[];
};

/**
 * Verifies that a transaction from wallet → vault for at least the expected amount has occurred.
 * @returns The verified transaction hash, or null if not found.
 */
export async function verifyOnChainDeposit(input: {
  fromWallet: string;
  toVault: string;
  expectedNano: bigint;
  challengeId: string;
  telegramId: string;
  wakeTime: string;
}): Promise<string | null> {
  const { fromWallet, toVault, expectedNano } = input;

  const apiKey = process.env.TONCENTER_API_KEY;
  const url = new URL(`${TONCENTER_BASE}/getTransactions`);
  url.searchParams.set("address", toVault);
  url.searchParams.set("limit", "20");
  if (apiKey) url.searchParams.set("api_key", apiKey);

  let data: TonGetTransactionsResponse;
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    data = (await res.json()) as TonGetTransactionsResponse;
  } catch {
    throw new Error("Unable to connect to the TON network. Please try again shortly.");
  }

  if (!data.ok) {
    throw new Error("TON API error: Unable to retrieve transactions.");
  }

  const expectedComment = `stakewake:${input.challengeId}:${input.telegramId}:${input.wakeTime}`;

  // ── Debug logs ──────────────────────────────────────────────────────────────
  console.log("[TON] TONCENTER_BASE:", TONCENTER_BASE);
  console.log("[TON] vault address:", toVault);
  console.log("[TON] from wallet:", fromWallet);
  console.log("[TON] expected nano:", expectedNano.toString());
  console.log("[TON] expected comment:", expectedComment);
  console.log("[TON] tx count:", data.result.length);
  for (const tx of data.result) {
    const msg = tx.in_msg;
    console.log("[TON] --- tx ---");
    console.log("[TON] tx source:", msg?.source);
    console.log("[TON] tx value:", msg?.value);
    console.log("[TON] tx msg_data:", JSON.stringify(msg?.msg_data));
    console.log("[TON] tx message:", msg?.message);
  }
  // ───────────────────────────────────────────────────────────────────────────

  for (const tx of data.result) {
    const msg = tx.in_msg;
    if (!msg) continue;

    const senderMatch = msg.source?.toLowerCase() === fromWallet.toLowerCase();
    const destMatch = msg.destination?.toLowerCase() === toVault.toLowerCase();
    const valueMatch = BigInt(msg.value ?? "0") >= expectedNano;

    // Try both msg_data.text and message field
    const comment = msg.msg_data?.text ?? msg.message ?? "";
    const commentMatch = comment === expectedComment;

    if (senderMatch && destMatch && valueMatch && commentMatch) {
      return tx.transaction_id.hash;
    }
  }

  return null;
}
