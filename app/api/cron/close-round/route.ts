import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";
import { settleTodayChallenge } from "@/lib/repositories/challenges";

const CLOSE_ROUND_OPCODE      = 2771548579; // 0xa527f963
const MARK_PARTICIPANT_OPCODE = 2075659638; // 0x7bd44d76

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const adminKey = request.headers.get("x-admin-key");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = adminKey === env.adminApiKey;
  if (!isCron && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
  if (!mnemonic || mnemonic.length < 24)
    return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });

  try {
    const sql = getSql();

    // 전날 challenge 조회 (UTC 00:10에 실행 → 어제 날짜)
    const [challenge] = await sql<{
      id: string;
      on_chain_round_id: number;
      status: string;
      challenge_date: string;
    }[]>`
      select id, on_chain_round_id, status, challenge_date::text
      from challenge
      where challenge_date = current_date - interval '1 day'
      limit 1
    `;

    if (!challenge) return NextResponse.json({ error: "전날 challenge 없음" }, { status: 400 });
    if (challenge.status === "settled") return NextResponse.json({ ok: true, skipped: true, reason: "already settled", date: challenge.challenge_date });
    if (!challenge.on_chain_round_id) return NextResponse.json({ error: "roundId 없음 - open-round를 먼저 실행했는지 확인" }, { status: 400 });

    const roundId = challenge.on_chain_round_id;

    // 1. DB 정산
    const yesterday = challenge.challenge_date;
    const settlement = await settleTodayChallenge(yesterday);
    console.log("[cron/close-round] settlement:", settlement);

    // winner/loser 참여자 조회
    const participants = await sql<{
      wallet_address: string;
      status: string;
    }[]>`
      select u.wallet_address, p.status
      from challenge_participation p
      join app_user u on u.id = p.user_id
      where p.challenge_id = ${challenge.id}
        and p.status in ('settled', 'failed')
        and u.wallet_address is not null
    `;

    // 2. 온체인 전송
    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet"
        ? "https://toncenter.com/api/v2/jsonRPC"
        : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    const vaultAddr = Address.parse(env.stakeVaultAddress);

    // CloseRound
    let seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [internal({
        to: vaultAddr,
        value: toNano("0.05"),
        bounce: false,
        body: beginCell()
          .storeUint(CLOSE_ROUND_OPCODE, 32)
          .storeUint(0, 64)
          .storeUint(roundId, 32)
          .endCell(),
      })],
    });
    console.log(`[cron/close-round] CloseRound sent, seqno=${seqno}`);

    // MarkParticipant
    for (const p of participants) {
      await new Promise(r => setTimeout(r, 1500));
      seqno = await contract.getSeqno();
      const success = p.status === "settled";
      await contract.sendTransfer({
        secretKey: keyPair.secretKey,
        seqno,
        messages: [internal({
          to: vaultAddr,
          value: toNano("0.05"),
          bounce: false,
          body: beginCell()
            .storeUint(MARK_PARTICIPANT_OPCODE, 32)
            .storeUint(0, 64)
            .storeUint(roundId, 32)
            .storeAddress(Address.parse(p.wallet_address))
            .storeBit(success)
            .endCell(),
        })],
      });
      console.log(`[cron/close-round] MarkParticipant ${p.wallet_address} success=${success}`);
    }

    return NextResponse.json({ ok: true, date: yesterday, roundId, settlement, marked: participants.length });

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "close-round 실패";
    console.error("[cron/close-round] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
