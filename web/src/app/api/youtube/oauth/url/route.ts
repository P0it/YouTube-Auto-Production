import { NextResponse } from "next/server";
import { createOAuthClient, YOUTUBE_UPLOAD_SCOPES } from "@/lib/youtube-auth";

export async function GET() {
  try {
    const client = createOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: YOUTUBE_UPLOAD_SCOPES,
    });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
