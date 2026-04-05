import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  channelTitle: string;
  url: string;
}

/** 키워드로 인기 영상 검색 */
export async function searchPopularVideos(
  query: string,
  maxResults: number = 10
): Promise<YouTubeVideoResult[]> {
  const searchResponse = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["video"],
    maxResults,
    order: "viewCount",
    relevanceLanguage: "ko",
    regionCode: "KR",
  });

  const videoIds =
    searchResponse.data.items
      ?.map((item) => item.id?.videoId)
      .filter(Boolean)
      .join(",") ?? "";

  if (!videoIds) return [];

  const statsResponse = await youtube.videos.list({
    part: ["statistics", "snippet"],
    id: [videoIds],
  });

  return (
    statsResponse.data.items?.map((video) => ({
      videoId: video.id ?? "",
      title: video.snippet?.title ?? "",
      viewCount: parseInt(video.statistics?.viewCount ?? "0"),
      likeCount: parseInt(video.statistics?.likeCount ?? "0"),
      publishedAt: video.snippet?.publishedAt ?? "",
      channelTitle: video.snippet?.channelTitle ?? "",
      url: `https://www.youtube.com/watch?v=${video.id}`,
    })) ?? []
  );
}

/** 특정 키워드의 최근 인기 영상 트렌드 분석 */
export async function analyzeKeywordTrend(
  keyword: string
): Promise<{ totalVideos: number; avgViews: number; topVideo: YouTubeVideoResult | null }> {
  const videos = await searchPopularVideos(keyword, 25);

  if (videos.length === 0) {
    return { totalVideos: 0, avgViews: 0, topVideo: null };
  }

  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  return {
    totalVideos: videos.length,
    avgViews: Math.round(totalViews / videos.length),
    topVideo: videos[0],
  };
}
