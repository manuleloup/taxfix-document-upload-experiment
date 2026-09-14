import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { password } = body;

  if (
    typeof password !== "string" ||
    !process.env.AUTH_PASSWORD ||
    password !== process.env.AUTH_PASSWORD
  ) {
    // Same response for wrong password and missing env var — no oracle.
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = process.env.SESSION_TOKEN;
  if (!token) {
    console.error("[auth] SESSION_TOKEN env var not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("taxfix_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
