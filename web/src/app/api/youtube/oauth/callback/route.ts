import { NextRequest } from "next/server";
import { createOAuthClient, saveToken } from "@/lib/youtube-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return htmlResponse(`<h1>YouTube 인증 실패</h1><p>${escape(error)}</p>`, 400);
  }
  if (!code) {
    return htmlResponse(`<h1>Missing code</h1>`, 400);
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    saveToken(tokens);

    return htmlResponse(
      `<h1>YouTube 인증 완료</h1>
       <p>토큰이 저장되었습니다. 이 창을 닫고 대시보드로 돌아가세요.</p>
       <script>window.setTimeout(() => window.close(), 1500);</script>`,
      200
    );
  } catch (err) {
    return htmlResponse(
      `<h1>토큰 교환 실패</h1><pre>${escape((err as Error).message)}</pre>`,
      500
    );
  }
}

function htmlResponse(body: string, status: number): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>YouTube Auth</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:600px;margin:4rem auto;padding:0 1rem;line-height:1.6}</style></head><body>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}
