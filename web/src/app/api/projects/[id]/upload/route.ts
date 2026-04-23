import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import { authorizedClient } from "@/lib/youtube-auth";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

type Privacy = "private" | "unlisted" | "public";

interface UploadPayload {
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: Privacy;
  madeForKids?: boolean;
  thumbnailDataUrl?: string;
}

interface UploadState {
  status: "idle" | "starting" | "uploading" | "thumbnail" | "done" | "error";
  videoId?: string;
  error?: string;
  uploadedAt?: string;
  url?: string;
  bytesSent?: number;
  bytesTotal?: number;
}

function uploadStatePath(id: string) {
  return path.join(PROJECTS_DIR, id, "output", "youtube-upload.json");
}

function writeState(id: string, state: UploadState) {
  const p = uploadStatePath(id);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
}

function readState(id: string): UploadState {
  const p = uploadStatePath(id);
  if (!fs.existsSync(p)) return { status: "idle" };
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as UploadState;
  } catch {
    return { status: "idle" };
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(readState(id));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as UploadPayload;

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const videoPath = path.join(PROJECTS_DIR, id, "output", "video", "longform.mp4");
  if (!fs.existsSync(videoPath)) {
    return NextResponse.json(
      { error: `longform.mp4 not found at ${videoPath}` },
      { status: 404 }
    );
  }

  // Kick the upload off in the background; report progress through the state file.
  writeState(id, { status: "starting" });
  runUpload(id, videoPath, body).catch((err) => {
    writeState(id, { status: "error", error: (err as Error).message });
  });

  return NextResponse.json({ ok: true });
}

async function runUpload(id: string, videoPath: string, payload: UploadPayload) {
  const client = await authorizedClient();
  const youtube = google.youtube({ version: "v3", auth: client });

  const stats = fs.statSync(videoPath);
  writeState(id, {
    status: "uploading",
    bytesSent: 0,
    bytesTotal: stats.size,
  });

  const videoStream = fs.createReadStream(videoPath);
  let bytesSent = 0;
  videoStream.on("data", (chunk) => {
    bytesSent += (chunk as Buffer).length;
    const prev = readState(id);
    writeState(id, { ...prev, bytesSent });
  });

  const insertResponse = await youtube.videos.insert({
    part: ["snippet", "status"],
    notifySubscribers: true,
    requestBody: {
      snippet: {
        title: payload.title,
        description: payload.description ?? "",
        tags: payload.tags ?? [],
        categoryId: payload.categoryId ?? "27", // 27 = Education
        defaultLanguage: "ko",
        defaultAudioLanguage: "ko",
      },
      status: {
        privacyStatus: payload.privacyStatus ?? "private",
        selfDeclaredMadeForKids: payload.madeForKids ?? false,
        embeddable: true,
        publicStatsViewable: true,
      },
    },
    media: {
      mimeType: "video/mp4",
      body: videoStream,
    },
  });

  const videoId = insertResponse.data.id;
  if (!videoId) {
    throw new Error("YouTube returned no video id after upload.");
  }

  // Optional thumbnail upload (data URL from the form).
  if (payload.thumbnailDataUrl) {
    try {
      writeState(id, {
        status: "thumbnail",
        videoId,
        bytesSent,
        bytesTotal: stats.size,
      });
      const match = payload.thumbnailDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        const { Readable } = await import("stream");
        await youtube.thumbnails.set({
          videoId,
          media: { mimeType, body: Readable.from(buffer) },
        });
      }
    } catch (err) {
      // Thumbnail failures shouldn't fail the upload.
      const prev = readState(id);
      writeState(id, { ...prev, error: `thumbnail failed: ${(err as Error).message}` });
    }
  }

  writeState(id, {
    status: "done",
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    uploadedAt: new Date().toISOString(),
    bytesSent,
    bytesTotal: stats.size,
  });
}
