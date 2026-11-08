// Small string helpers for the standalone HTML report. All text from the configuration or the
// results is escaped before it is placed in the page.

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replaceAll(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** JSON that is safe inside a <script> element: no "</script>", no HTML comment openers. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}

/** Library code inlined in a <script> element; "</script" can only occur inside its strings. */
export function scriptSafe(source: string): string {
  return source.replaceAll(/<\/script/gi, '<\\/script');
}

/** A cell is either plain text (escaped here) or HTML that was built safely. */
export type Cell = string | { readonly html: string };

const cellHtml = (cell: Cell): string => (typeof cell === 'string' ? escapeHtml(cell) : cell.html);

export function withInterval(value: string, interval: string | null): Cell {
  return {
    html:
      escapeHtml(value) +
      (interval === null ? '' : `<span class="ci">${escapeHtml(interval)}</span>`),
  };
}

export interface TableSpec {
  readonly caption: string;
  readonly headers: readonly string[];
  /** The first cell of each row is a row header. */
  readonly rows: readonly (readonly Cell[])[];
  /** Columns from this index on are numbers, right-aligned. */
  readonly numericFrom?: number;
}

export function table({ caption, headers, rows, numericFrom = 1 }: TableSpec): string {
  const align = (index: number) => (index >= numericFrom ? ' class="num"' : '');
  const head = headers
    .map((header, index) => `<th scope="col"${align(index)}>${escapeHtml(header)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) =>
            index === 0
              ? `<th scope="row">${cellHtml(cell)}</th>`
              : `<td${align(index)}>${cellHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('\n');
  return `<div class="table-wrap"><table><caption>${escapeHtml(caption)}</caption><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

export function section(id: string, title: string, body: string): string {
  return `<section id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title"><h2 id="${escapeHtml(id)}-title">${escapeHtml(title)}</h2>\n${body}\n</section>`;
}

export function paragraph(text: string, className?: string): string {
  return `<p${className === undefined ? '' : ` class="${className}"`}>${escapeHtml(text)}</p>`;
}
