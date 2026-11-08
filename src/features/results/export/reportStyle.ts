// Inline styles for the standalone HTML report. Colours match the app's slate tokens and switch
// with the viewer's system theme, as the embedded charts do.

export const REPORT_CSS = `
:root {
  --surface: #ffffff; --page: #f8fafc; --text: #0f172a; --muted: #475569; --border: #e2e8f0;
  --banner: #fef3c7; --banner-text: #78350f; --ok: #ccfbf1; --ok-text: #134e4a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #0f172a; --page: #020617; --text: #e2e8f0; --muted: #94a3b8; --border: #1e293b;
    --banner: #451a03; --banner-text: #fde68a; --ok: #042f2e; --ok-text: #99f6e4;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 1.6rem; margin: 0 0 4px; }
h2 { font-size: 1.2rem; margin: 0 0 8px; }
h3 { font-size: 1rem; margin: 16px 0 4px; }
section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px; margin-top: 16px; }
.muted { color: var(--muted); }
.warning, .banner { background: var(--banner); color: var(--banner-text); padding: 8px 12px; border-radius: 6px; }
.banner.ok { background: var(--ok); color: var(--ok-text); }
.verdict { font-weight: 600; }
.table-wrap { overflow-x: auto; margin: 8px 0; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; font-size: 0.9rem; }
caption { text-align: left; color: var(--muted); padding-bottom: 4px; }
th, td { padding: 4px 8px; border-top: 1px solid var(--border); text-align: left; vertical-align: top; }
thead th { font-weight: 500; color: var(--muted); border-top: 0; }
tbody th { font-weight: 500; }
.num { text-align: right; }
.ci { display: block; font-size: 0.75rem; color: var(--muted); font-weight: 400; }
.strategies li { margin-bottom: 6px; }
.rankings { display: grid; gap: 8px 24px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.ranking ol { margin: 4px 0; padding-left: 20px; }
.charts { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); }
.card, .panel { margin: 0; border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
figcaption span { display: block; font-size: 0.8rem; }
.chart { width: 100%; height: 320px; }
.panels { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); }
.panel-chart { height: 300px; }
.panel-empty { padding: 24px 0; }
details { margin: 8px 0; }
summary { cursor: pointer; font-weight: 500; }
footer { margin-top: 24px; font-size: 0.85rem; }
`;
