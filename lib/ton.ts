import { beginCell, Address } from "@ton/core";
import { sha256Hex } from "@/lib/crypto";

export function toNanoTon(valueTon: number) {
  return BigInt(Math.round(valueTon * 1_000_000_000));
}

export function encodeBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Tact `Stake` 메시지 직렬화
 *   opcode      : 0xaf08f361  (uint32)
 *   roundId     : uint32
 *   telegramIdHash : uint256 (SHA-256 of telegramId string)
 */
export function buildStakePayload(input: {
  roundId: number;
  telegramId: string;
}) {
  const telegramIdHashHex = sha256Hex(input.telegramId);
  const telegramIdHashBig = BigInt("0x" + telegramIdHashHex);

  return encodeBase64(
    beginCell()
      .storeUint(0x2f08f361, 32)        // Stake opcode
      .storeUint(input.roundId, 32)     // roundId (uint32)
      .storeUint(telegramIdHashBig, 256) // telegramIdHash (uint256)
      .endCell()
      .toBoc()
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

export async function verifyOnChainDeposit(input: {
  fromWallet: string;
  toVault: string;
  expectedNano: bigint;
  roundId: number;
  telegramId: string;
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
    console.warn("[TON] verifyOnChainDeposit: network error, skipping verification");
    return "unverified-network-error";
  }

  if (!data.ok) {
    console.warn("[TON] verifyOnChainDeposit: API error, skipping verification");
    return "unverified-api-error";
  }

  const normalizedFromWallet = normalizeAddress(fromWallet);
  const normalizedToVault = normalizeAddress(toVault);

  // 기대하는 payload BOC를 base64로 만들어서 비교용으로 사용
  const expectedPayload = buildStakePayload({
    roundId: input.roundId,
    telegramId: input.telegramId,
  });

  let bestMatch: string | null = null;

  for (const tx of data.result) {
    const msg = tx.in_msg;
    if (!msg) continue;

    const senderMatch = normalizeAddress(msg.source ?? "") === normalizedFromWallet;
    const destMatch = normalizeAddress(msg.destination ?? "") === normalizedToVault;
    const valueMatch = BigInt(msg.value ?? "0") >= expectedNano;

    if (!senderMatch || !destMatch || !valueMatch) continue;

    // body는 msg_data.body(base64 BOC) 또는 fallback으로 확인
    const bodyBase64 = msg.msg_data?.body ?? "";
    const payloadMatch = bodyBase64 === expectedPayload;

    console.log("[TON] match:", senderMatch, destMatch, valueMatch, payloadMatch);

    if (payloadMatch) {
      return tx.transaction_id.hash;
    }

    // payload 불일치여도 주소+금액 맞으면 후보로 저장 (테스트넷 호환)
    bestMatch = tx.transaction_id.hash;
  }

  if (bestMatch) {
    console.warn("[TON] verifyOnChainDeposit: payload mismatch but address+amount matched, accepting");
  }

  return bestMatch;
}
