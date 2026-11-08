// The full ECharts browser build as text, inlined into the HTML report so it works offline.
// Loaded only when a report is built, so it never adds to the normal page load.

export async function loadEchartsSource(): Promise<string> {
  const module = await import('echarts/dist/echarts.min?raw');
  return module.default;
}
