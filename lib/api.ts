import { NextResponse } from "next/server";

export function ok<T>(payload: T) {
  return NextResponse.json(payload);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
