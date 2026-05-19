/**
 * failedPool 비상 출금 스크립트
 *
 * 운영자가 입금했으나 아무도 Claim하지 않아 failedPool에 묶인 TON을
 * 오너 지갑으로 비상 출금합니다.
 *
 * ⚠️  이 스크립트를 사용하려면 컨트랙트가 EmergencyWithdraw 핸들러가
 *     포함된 버전으로 재배포되어 있어야 합니다.
 *
 * 사용법:
 *   OWNER_MNEMONIC="단어1 단어2 ..." \
 *   STAKE_VAULT_ADDRESS="EQ...컨트랙트주소" \
 *   TO_ADDRESS="EQ...받을지갑주소" \
 *   AMOUNT_TON="1.5" \
 *   node scripts/emergencyWithdrawFailedPool.mjs
 *
 * 환경변수:
 *   OWNER_MNEMONIC        - 오너 지갑 24단어 시드 (공백 구분)
 *   STAKE_VAULT_ADDRESS   - 스테이크 볼트 컨트랙트 주소
 *   TO_ADDRESS            - 출금 받을 지갑 주소
 *   AMOUNT_TON            - 출금할 TON 수량 (소수점 가능, 예: "1.5")
 *   TON_NETWORK           - "mainnet" 또는 "testnet" (기본값: testnet)
 */

import {
  TonClient,
  WalletContractV4,
  internal,
  toNano,
  Address,
  beginCell,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

// ─── 환경변수 파싱 ────────────────────────────────────────────────────────────

const MNEMONIC = process.env.OWNER_MNEMONIC?.split(" ");
const CONTRACT = process.env.STAKE_VAULT_ADDRESS;
const TO = process.env.TO_ADDRESS;
const AMOUNT = process.env.AMOUNT_TON;
const NETWORK = process.env.TON_NETWORK ?? "testnet";

// ─── 검증 ─────────────────────────────────────────────────────────────────────

if (!MNEMONIC || MNEMONIC.length < 24) {
  console.error("❌ OWNER_MNEMONIC 환경변수가 없거나 올바르지 않습니다. (24단어)");
  process.exit(1);
}
if (!CONTRACT) {
  console.error("❌ STAKE_VAULT_ADDRESS 환경변수가 없습니다.");
  process.exit(1);
}
if (!TO) {
  console.error("❌ TO_ADDRESS 환경변수가 없습니다.");
  process.exit(1);
}
if (!AMOUNT || isNaN(parseFloat(AMOUNT)) || parseFloat(AMOUNT) <= 0) {
  console.error("❌ AMOUNT_TON 환경변수가 없거나 올바른 양수가 아닙니다.");
  process.exit(1);
}

// ─── EmergencyWithdraw opcode ─────────────────────────────────────────────────
// contracts/StakeWakeVault.tact 컴파일 결과 (ABI header 값)
// npx tact --config tact.config.json 후 build/StakeWakeVault/*.abi 에서 확인
const EMERGENCY_WITHDRAW_OPCODE = 0xc45af24e;

// ─── 네트워크 설정 ─────────────────────────────────────────────────────────────

const ENDPOINT =
  NETWORK === "mainnet"
    ? "https://toncenter.com/api/v2/jsonRPC"
    : "https://testnet.toncenter.com/api/v2/jsonRPC";

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌐 네트워크: ${NETWORK}`);
  console.log("🔑 지갑 키 생성 중...");

  const keyPair = await mnemonicToPrivateKey(MNEMONIC);
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });

  const client = new TonClient({ endpoint: ENDPOINT });
  const contract = client.open(wallet);

  const seqno = await contract.getSeqno();
  const contractAddress = Address.parse(CONTRACT);
  const toAddress = Address.parse(TO);
  const amountNano = toNano(AMOUNT);

  console.log(`📬 오너 지갑:  ${wallet.address.toString()}`);
  console.log(`📦 컨트랙트:  ${CONTRACT}`);
  console.log(`💸 출금 금액: ${AMOUNT} TON → ${TO}`);
  console.log(`🔢 Seqno:     ${seqno}`);
  console.log(`🔢 Opcode:    0x${EMERGENCY_WITHDRAW_OPCODE.toString(16)}`);

  // ─── failedPool 잔액 조회 (선택적, 컨트랙트에 getFailedPool getter 필요) ──────
  try {
    const result = await client.runMethod(contractAddress, "getFailedPool", []);
    const failedPoolNano = result.stack.readBigNumber();
    const failedPoolTon = Number(failedPoolNano) / 1e9;
    console.log(`🏦 failedPool 잔액: ${failedPoolTon.toFixed(9)} TON`);

    if (amountNano > failedPoolNano) {
      console.error(
        `❌ 출금 요청 금액(${AMOUNT} TON)이 failedPool 잔액(${failedPoolTon.toFixed(9)} TON)을 초과합니다.`
      );
      process.exit(1);
    }
  } catch {
    console.warn("⚠️  failedPool 잔액 조회 실패 (getter 미지원 버전일 수 있음). 트랜잭션을 그냥 시도합니다.");
  }

  // ─── EmergencyWithdraw 메시지 빌드 ───────────────────────────────────────────
  // message EmergencyWithdraw {
  //   queryId: Int as uint64;   (8바이트)
  //   amount:  Int as coins;    (가변 길이 coins)
  //   to:      Address;
  // }
  const body = beginCell()
    .storeUint(EMERGENCY_WITHDRAW_OPCODE, 32) // opcode (4바이트)
    .storeUint(0, 64)                          // queryId = 0
    .storeCoins(amountNano)                    // amount in nanoton
    .storeAddress(toAddress)                   // to address
    .endCell();

  console.log("\n📤 트랜잭션 전송 중...");

  await contract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: contractAddress,
        value: toNano("0.05"), // 가스비
        bounce: true,
        body,
      }),
    ],
  });

  console.log("✅ 트랜잭션 전송 완료!");
  console.log(
    "   TONScan에서 확인: https://" +
      (NETWORK === "mainnet" ? "" : "testnet.") +
      "tonscan.org/address/" +
      wallet.address.toString()
  );
  console.log("\n⏳ 10~30초 후 반영됩니다.");
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
