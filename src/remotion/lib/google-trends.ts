import googleTrends from "google-trends-api";

export interface TrendResult {
  keyword: string;
  relativeInterest: number;
  risingQueries: string[];
}

/** 키워드의 검색 관심도 조회 (최근 30일) */
export async function getInterestOverTime(
  keyword: string,
  geo: string = "KR"
): Promise<number> {
  const results = await googleTrends.interestOverTime({
    keyword,
    geo,
    startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  });

  const parsed = JSON.parse(results);
  const timelineData = parsed.default?.timelineData ?? [];

  if (timelineData.length === 0) return 0;

  const values = timelineData.map(
    (d: { value: number[] }) => d.value[0]
  );
  return Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
}

/** 관련 검색어 조회 */
export async function getRelatedQueries(
  keyword: string,
  geo: string = "KR"
): Promise<string[]> {
  const results = await googleTrends.relatedQueries({
    keyword,
    geo,
  });

  const parsed = JSON.parse(results);
  const rising = parsed.default?.rankedList?.[1]?.rankedKeyword ?? [];

  return rising.map((item: { query: string }) => item.query).slice(0, 10);
}

/** 일간 인기 검색어 조회 */
export async function getDailyTrends(
  geo: string = "KR"
): Promise<string[]> {
  const results = await googleTrends.dailyTrends({ geo });
  const parsed = JSON.parse(results);

  return (
    parsed.default?.trendingSearchesDays?.[0]?.trendingSearches?.map(
      (t: { title: { query: string } }) => t.title.query
    ) ?? []
  );
}
