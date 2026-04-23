import { NextResponse } from "next/server";
import { hasStoredToken, readToken } from "@/lib/youtube-auth";

export async function GET() {
  const connected = hasStoredToken();
  const clientConfigured =
    !!process.env.YOUTUBE_OAUTH_CLIENT_ID && !!process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const scopes = connected ? (readToken()?.scope ?? "").split(/\s+/).filter(Boolean) : [];
  return NextResponse.json({ connected, clientConfigured, scopes });
}

export async function DELETE() {
  const { clearToken } = await import("@/lib/youtube-auth");
  clearToken();
  return NextResponse.json({ ok: true });
}
