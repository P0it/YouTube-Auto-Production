import "server-only";
import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const TOKEN_DIR = path.join(REPO_ROOT, "data");
const TOKEN_PATH = path.join(TOKEN_DIR, "youtube-token.json");

export const YOUTUBE_UPLOAD_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export interface StoredToken {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string;
  id_token?: string | null;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Add it to .env (Google Cloud Console → OAuth 2.0 Client ID).`
    );
  }
  return v;
}

export function defaultRedirectUri(): string {
  return process.env.YOUTUBE_OAUTH_REDIRECT ?? "http://localhost:3000/api/youtube/oauth/callback";
}

export function createOAuthClient(): OAuth2Client {
  const clientId = requireEnv("YOUTUBE_OAUTH_CLIENT_ID");
  const clientSecret = requireEnv("YOUTUBE_OAUTH_CLIENT_SECRET");
  return new google.auth.OAuth2(clientId, clientSecret, defaultRedirectUri());
}

export function saveToken(token: StoredToken): void {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), "utf-8");
}

export function readToken(): StoredToken | null {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")) as StoredToken;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
}

/** Returns an authenticated client if a refresh-token is on disk. Throws otherwise. */
export async function authorizedClient(): Promise<OAuth2Client> {
  const token = readToken();
  if (!token || !token.refresh_token) {
    throw new Error(
      "No YouTube OAuth token on disk. Start auth at /api/youtube/oauth/url first."
    );
  }
  const client = createOAuthClient();
  client.setCredentials(token);

  client.on("tokens", (refreshed) => {
    const merged: StoredToken = { ...token, ...refreshed };
    if (!merged.refresh_token && token.refresh_token) {
      merged.refresh_token = token.refresh_token;
    }
    saveToken(merged);
  });

  return client;
}

export function hasStoredToken(): boolean {
  const t = readToken();
  return !!t?.refresh_token;
}
