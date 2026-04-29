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
