import { getData, setData, initDb } from "@/lib/db";
import { NextResponse } from "next/server";

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}

export async function GET(request, { params }) {
  try {
    await ensureInit();
    const value = await getData(params.key);
    if (value === null) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(value);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    await ensureInit();
    const body = await request.json();
    await setData(params.key, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
