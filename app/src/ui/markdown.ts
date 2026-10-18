// Tiny Markdown to HTML converter. It covers only what renderAdr emits: headings, bold,
// italics, lists, tables, paragraphs and links. No library.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(src: string): string {
  const links: string[] = [];
  // Pull links out first so their URLs are not touched by the emphasis rules.
  let s = src.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text: string, url: string) => {
    links.push(`<a href="${esc(url)}" rel="noopener noreferrer">${esc(text)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)] ?? '');
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '\\' && body[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (c === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function table(lines: string[]): string {
  const [head, , ...rows] = lines;
  const th = splitRow(head ?? '')
    .map((c) => `<th scope="col">${inline(c)}</th>`)
    .join('');
  const trs = rows.map((r) => `<tr>${splitRow(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function markdownToHtml(md: string): string {
  const out: string[] = [];
  for (const block of md.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;
    const first = lines[0]!;
    const h = /^(#{1,6})\s+(.*)$/.exec(first);
    if (h && lines.length === 1) {
      const n = h[1]!.length;
      out.push(`<h${n}>${inline(h[2]!)}</h${n}>`);
    } else if (lines.every((l) => /^[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`);
    } else if (first.startsWith('|') && lines.length >= 2) {
      out.push(table(lines));
    } else {
      out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
    }
  }
  return out.join('\n');
}
