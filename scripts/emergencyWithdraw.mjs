/**
 * 비상 출금 스크립트
 * 컨트랙트의 WithdrawFees 메시지를 사용해 오너 지갑으로 TON을 출금합니다.
 *
 * 사용법:
 *   OWNER_MNEMONIC="단어1 단어2 ..." \
 *   STAKE_VAULT_ADDRESS="EQ...컨트랙트주소" \
 *   TO_ADDRESS="EQ...받을지갑주소" \
 *   AMOUNT_TON="1.5" \
 *   node scripts/emergencyWithdraw.mjs
 */

import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const MNEMONIC = process.env.OWNER_MNEMONIC?.split(" ");
const CONTRACT = process.env.STAKE_VAULT_ADDRESS;
const TO = process.env.TO_ADDRESS;
const AMOUNT = process.env.AMOUNT_TON;

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
if (!AMOUNT || isNaN(parseFloat(AMOUNT))) {
  console.error("❌ AMOUNT_TON 환경변수가 없거나 숫자가 아닙니다.");
  process.exit(1);
}

async function main() {
  console.log("🔑 지갑 키 생성 중...");
  const keyPair = await mnemonicToPrivateKey(MNEMONIC);

  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });

  const client = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
  });

  const contract = client.open(wallet);
  const seqno = await contract.getSeqno();

  console.log(`📬 오너 지갑: ${wallet.address.toString()}`);
  console.log(`📦 컨트랙트: ${CONTRACT}`);
  console.log(`💸 출금 금액: ${AMOUNT} TON → ${TO}`);

  const withdrawFeesBody = beginCell()
    .storeUint(0x7a8b89c1, 32)
    .storeUint(0, 64)
    .storeCoins(toNano(AMOUNT))
    .storeAddress(Address.parse(TO))
    .endCell();

  await contract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: Address.parse(CONTRACT),
        value: toNano("0.05"),
        bounce: true,
        body: withdrawFeesBody,
      }),
    ],
  });

  console.log("✅ 트랜잭션 전송 완료!");
  console.log("   TONScan에서 확인: https://tonscan.org/address/" + wallet.address.toString());
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
