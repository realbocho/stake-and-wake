export function formatTon(value: number) {
  return `${value.toFixed(2)} TON`;
}

export function englishTime(from: string, to: string) {
  return `${from} - ${to}`;
}

export function toTier(streak: number) {
  if (streak >= 90) return "Diamond";
  if (streak >= 30) return "Gold";
  if (streak >= 14) return "Silver";
  return "Bronze";
}

export function nowIso() {
  return new Date().toISOString();
}
