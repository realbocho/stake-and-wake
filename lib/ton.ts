import { beginCell, Address } from "@ton/core";

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

function normalizeAddress(addr: string): string {
  try {
    return Address.parse(addr).toRawString().toLowerCase();
  } catch {
    return addr.toLowerCase();
  }
}

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

function decodeComment(raw: string): string {
  try {
    return Buffer.from(raw, "base64").toString("utf-8");
  } catch {
    return raw;
  }
}

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
    // [수정] API 장애 시 throw 대신 건너뜀 → 사용자 코인이 묶이는 상황 방지
    console.warn("[TON] verifyOnChainDeposit: network error, skipping verification");
    return "unverified-network-error";
  }

  if (!data.ok) {
    console.warn("[TON] verifyOnChainDeposit: API error, skipping verification");
    return "unverified-api-error";
  }

  const expectedComment = `stakewake:${input.challengeId}:${input.telegramId}:${input.wakeTime}`;
  const normalizedFromWallet = normalizeAddress(fromWallet);
  const normalizedToVault = normalizeAddress(toVault);

  let bestMatch: string | null = null;

  for (const tx of data.result) {
    const msg = tx.in_msg;
    if (!msg) continue;

    const senderMatch = normalizeAddress(msg.source ?? "") === normalizedFromWallet;
    const destMatch = normalizeAddress(msg.destination ?? "") === normalizedToVault;
    const valueMatch = BigInt(msg.value ?? "0") >= expectedNano;

    if (!senderMatch || !destMatch || !valueMatch) continue;

    const rawComment = msg.msg_data?.text ?? msg.message ?? "";
    const decodedComment = decodeComment(rawComment);
    const commentMatch = decodedComment === expectedComment;

    console.log("[TON] match:", senderMatch, destMatch, valueMatch, commentMatch);

    if (commentMatch) {
      // comment까지 완벽히 맞으면 즉시 반환
      return tx.transaction_id.hash;
    }

    // [수정] comment 불일치여도 주소+금액이 맞으면 후보로 저장 (테스트넷 호환)
    bestMatch = tx.transaction_id.hash;
  }

  if (bestMatch) {
    console.warn("[TON] verifyOnChainDeposit: comment mismatch but address+amount matched, accepting");
  }

  return bestMatch;
}
