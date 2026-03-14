import { NextResponse } from "next/server";

export async function POST(req) {
  const { pin } = await req.json();
  const correct = process.env.EDIT_PIN;
  if (!correct) return NextResponse.json({ ok: true }); // no PIN set = open
  if (pin === correct) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false }, { status: 401 });
}
