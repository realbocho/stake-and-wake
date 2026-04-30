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

// ─── TON 온체인 트랜잭션 검증 ────────────────────────────────────────────────
// BOC를 그대로 신뢰하는 대신, TONCenter API로 실제 입금 여부를 확인합니다.

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
    msg_data?: { text?: string };
  };
};

type TonGetTransactionsResponse = {
  ok: boolean;
  result: TonTransaction[];
};

/**
 * 지갑 → vault로 기대 금액 이상의 트랜잭션이 실제 발생했는지 확인합니다.
 * @returns 검증된 트랜잭션 해시, 없으면 null
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
    throw new Error("TON 네트워크에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
  }

  if (!data.ok) {
    throw new Error("TON API 응답 오류: 트랜잭션을 확인할 수 없습니다.");
  }

  const expectedComment = `stakewake:${input.challengeId}:${input.telegramId}:${input.wakeTime}`;

  for (const tx of data.result) {
    const msg = tx.in_msg;
    if (!msg) continue;

    const senderMatch = msg.source?.toLowerCase() === fromWallet.toLowerCase();
    const destMatch = msg.destination?.toLowerCase() === toVault.toLowerCase();
    const valueMatch = BigInt(msg.value ?? "0") >= expectedNano;
    const commentMatch = msg.msg_data?.text === expectedComment;

    if (senderMatch && destMatch && valueMatch && commentMatch) {
      return tx.transaction_id.hash;
    }
  }

  return null;
}
