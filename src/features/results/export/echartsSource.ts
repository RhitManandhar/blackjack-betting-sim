import echartsUrl from 'echarts/dist/echarts.min?url';

// The full ECharts browser build, inlined into the HTML report so it works offline. It is a
// static file fetched from this site only when a report is built: it never adds to the normal
// page load, and it is not a code chunk, so it stays out of the bundle-size budget.

export const ECHARTS_SOURCE_URL = echartsUrl;

export async function loadEchartsSource(fetchText = defaultFetchText): Promise<string> {
  return fetchText(ECHARTS_SOURCE_URL);
}

async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Could not load the chart library (${String(response.status)})`);
  return response.text();
}
