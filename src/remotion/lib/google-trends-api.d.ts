declare module "google-trends-api" {
  const googleTrends: {
    interestOverTime(options: any): Promise<string>;
    relatedQueries(options: any): Promise<string>;
    dailyTrends(options: any): Promise<string>;
  };
  export default googleTrends;
}
