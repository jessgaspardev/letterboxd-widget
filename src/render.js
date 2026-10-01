const PAD_X = 12;
const TOP_WITH_HEADER = 12;
const TOP_WITHOUT_HEADER = 4;
const BOTTOM = 4;
const HEADER_H = 18;
const ROW_PAD = 8;
const POSTER_W = 34;
const POSTER_H = 51;
const POSTER_ROW_H = POSTER_H + 2 * ROW_PAD; // 67 (lol)
const TEXT_ROW_H = 30; // rows when posters are hidden
const TEXT_GAP = 12;
const TITLE_SIZE = 12.5;
const TITLE_LINE = 15;
const YEAR_SIZE = 11;
const DATE_SIZE = 10.5;
const META_GAP = 4;   // between title and stars
const META_H = 11;    // star row height
const STAR_STEP = 11; // distance between stars

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- public ----------

export function widgetHeight(rowCount, opts) {
  const header = !opts.hide.has("header");
  const rowH = opts.hide.has("posters") ? TEXT_ROW_H : POSTER_ROW_H;
  return (header ? TOP_WITH_HEADER + HEADER_H : TOP_WITHOUT_HEADER) + rowCount * rowH + BOTTOM;
}

export function renderWidget(username, films, opts) {
  const { width: W, colors: c, hide } = opts;
  const H = widgetHeight(films.length, opts);
  const compact = hide.has("posters");
  const rowH = compact ? TEXT_ROW_H : POSTER_ROW_H;
  const parts = [];
  let y;

  if (!hide.has("header")) {
    parts.push(renderHeader(opts.header, username, W, TOP_WITH_HEADER, c));
    y = TOP_WITH_HEADER + HEADER_H;
  } else {
    y = TOP_WITHOUT_HEADER;
  }

  films.forEach((film, i) => {
    parts.push(compact ? renderTextRow(film, W, y, c, hide) : renderPosterRow(film, W, y, c, hide));
    if (i < films.length - 1) parts.push(rule(W, y + rowH - 0.5, c.border));
    y += rowH;
  });

  return wrapSvg(W, H, opts, `Recently watched on Letterboxd by ${username}`, parts.join(""));
}

// same look and width as the widget, with a one-line message instead of films.
export function renderErrorCard(message, opts) {
  const { width: W, colors: c, hide } = opts;
  let body = "";
  let y = TOP_WITHOUT_HEADER;
  if (!hide.has("header")) {
    body += renderHeader(opts.header, "", W, TOP_WITH_HEADER, c);
    y = TOP_WITH_HEADER + HEADER_H;
  }
  const text = ellipsize(message, 12, W - 2 * PAD_X);
  body += `<text x="${PAD_X}" y="${y + 19}" font-size="12" fill="${c.muted}">${esc(text)}</text>`;
  return wrapSvg(W, y + TEXT_ROW_H + BOTTOM, opts, message, body);
}

// ---------- pieces ----------

function wrapSvg(W, H, opts, title, body) {
  const { colors: c, radius } = opts;
  const bg = c.bg === "none" ? "" : `<rect width="${W}" height="${H}" fill="${c.bg}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">` +
    `<title>${esc(title)}</title>` +
    `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="${radius}"/></clipPath></defs>` +
    `<g clip-path="url(#card)" font-family="${FONT}">${bg}${body}</g>` +
    `</svg>`
  );
}

// uppercase, letter-spaced grey label with a thin rule underneath
function renderHeader(headerText, username, W, y, c) {
  const baseline = y + 10;
  const avail = W - 2 * PAD_X;
  const label = headerText.toUpperCase();
  const userW = username ? measure(username, 11) : 0;
  const showUser = username && measureSpaced(label, 11) + 16 + userW <= avail;
  const fitted = ellipsizeSpaced(label, 11, showUser ? avail - userW - 16 : avail);
  let out = `<text x="${PAD_X}" y="${baseline}" font-size="11" letter-spacing="1" fill="${c.muted}">${esc(fitted)}</text>`;
  if (showUser) {
    out += `<text x="${W - PAD_X}" y="${baseline}" font-size="11" text-anchor="end" fill="${c.muted}">${esc(username)}</text>`;
  }
  return out + rule(W, y + HEADER_H - 0.5, c.border);
}

function rule(W, y, color) {
  return `<rect x="${PAD_X}" y="${y - 0.5}" width="${W - 2 * PAD_X}" height="1" fill="${color}"/>`;
}

function renderPosterRow(film, W, y, c, hide) {
  const px = PAD_X;
  const py = y + ROW_PAD;
  let out = `<rect x="${px}" y="${py}" width="${POSTER_W}" height="${POSTER_H}" rx="3" fill="${c.border}"/>`;
  if (film.posterData) {
    out +=
      `<clipPath id="p${py}"><rect x="${px}" y="${py}" width="${POSTER_W}" height="${POSTER_H}" rx="3"/></clipPath>` +
      `<image x="${px}" y="${py}" width="${POSTER_W}" height="${POSTER_H}" preserveAspectRatio="xMidYMid slice" ` +
      `clip-path="url(#p${py})" href="${film.posterData}"/>`;
  }
  // thin light outline around the poster like on letterboxd
  out += `<rect x="${px + 0.5}" y="${py + 0.5}" width="${POSTER_W - 1}" height="${POSTER_H - 1}" rx="2.5" fill="none" stroke="${c.frame}"/>`;

  const textX = PAD_X + POSTER_W + TEXT_GAP;
  const avail = W - textX - PAD_X;
  const date = !hide.has("date") && film.watchedDate ? formatDate(film.watchedDate) : "";
  const dateW = date ? measure(date, DATE_SIZE) + 8 : 0;
  const year = !hide.has("year") && film.year ? String(film.year) : "";

  // the first line shares space with the date; the second gets the full width
  const widths = [avail - dateW, avail];
  const lines = fitTitle(film.title, year, widths);

  const meta = metaInfo(film, hide);
  const blockH = lines.length * TITLE_LINE + (meta.width ? META_GAP + META_H : 0);
  const top = y + (POSTER_ROW_H - blockH) / 2;

  lines.forEach((line, n) => {
    const yearSpan = n === lines.length - 1 && year
      ? `<tspan dx="5" font-size="${YEAR_SIZE}" font-weight="400" fill="${c.muted}">${year}</tspan>`
      : "";
    out += `<text x="${textX}" y="${round(top + 11.5 + n * TITLE_LINE)}" font-size="${TITLE_SIZE}" font-weight="700" fill="${c.text}">${esc(line)}${yearSpan}</text>`;
  });
  if (date) {
    out += `<text x="${W - PAD_X}" y="${round(top + 11.5)}" font-size="${DATE_SIZE}" text-anchor="end" fill="${c.muted}">${esc(date)}</text>`;
  }
  if (meta.width) {
    out += renderMeta(meta, textX, top + lines.length * TITLE_LINE + META_GAP, c);
  }
  return out;
}

// bold title and year on the left, stars and heart on the right
function renderTextRow(film, W, y, c, hide) {
  const meta = metaInfo(film, hide);
  const year = !hide.has("year") && film.year ? String(film.year) : "";
  const avail = W - 2 * PAD_X - (meta.width ? meta.width + 10 : 0);
  const [line] = fitTitle(film.title, year, [avail]);
  const baseline = y + 19;
  const yearSpan = year
    ? `<tspan dx="5" font-size="${YEAR_SIZE}" font-weight="400" fill="${c.muted}">${year}</tspan>`
    : "";
  let out = `<text x="${PAD_X}" y="${baseline}" font-size="${TITLE_SIZE}" font-weight="700" fill="${c.text}">${esc(line)}${yearSpan}</text>`;
  if (meta.width) out += renderMeta(meta, W - PAD_X - meta.width, y + 10, c);
  return out;
}

// ---------- stars and hearts ----------
// drawn as shapes so they look the same in every font and can be positioned exactly

const STAR_POINTS = Array.from({ length: 10 }, (_, k) => {
  const angle = (-90 + k * 36) * (Math.PI / 180);
  const r = k % 2 === 0 ? 5 : 2.1;
  return `${round(5 + r * Math.cos(angle))},${round(5.3 + r * Math.sin(angle))}`;
}).join(" ");

const HEART_PATH =
  "M5 9C5 9 0.4 6 0.4 3.2C0.4 1.6 1.5 0.5 2.9 0.5C3.9 0.5 4.6 1.1 5 1.9" +
  "C5.4 1.1 6.1 0.5 7.1 0.5C8.5 0.5 9.6 1.6 9.6 3.2C9.6 6 5 9 5 9Z";

function metaInfo(film, hide) {
  const showRating = !hide.has("ratings") && film.rating;
  const full = showRating ? (film.rating.match(/★/g) || []).length : 0;
  const half = showRating && film.rating.includes("½");
  const liked = !hide.has("likes") && film.liked;
  let width = full * STAR_STEP + (half ? 8 : 0);
  if (liked) width += (width ? 4 : 0) + 10;
  return { full, half, liked, width };
}

function renderMeta({ full, half, liked }, x, top, c) {
  let out = "";
  for (let i = 0; i < full; i++) {
    out += `<polygon transform="translate(${round(x + i * STAR_STEP)} ${round(top)})" points="${STAR_POINTS}" fill="${c.accent}"/>`;
  }
  let cursor = x + full * STAR_STEP;
  if (half) {
    out += `<text x="${round(cursor)}" y="${round(top + 9.5)}" font-size="11" font-weight="700" fill="${c.accent}">½</text>`;
    cursor += 8;
  }
  if (liked) {
    if (full || half) cursor += 4;
    out += `<path transform="translate(${round(cursor)} ${round(top + 1)})" d="${HEART_PATH}" fill="${c.heart}"/>`;
  }
  return out;
}

// ---------- text fitting ----------

function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x1f000) return 1.15; // emoji
  if ((cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xff00 && cp <= 0xff60)) return 1.0; // CJK, Hangul, fullwidth
  if (ch === " ") return 0.28;
  if ("il.,:;'|!I".includes(ch)) return 0.28;
  if ("frtj()[]-".includes(ch)) return 0.36;
  if ("mwMW@".includes(ch)) return 0.86;
  if (/[0-9]/.test(ch)) return 0.56;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[a-z]/.test(ch)) return 0.53;
  return 0.6;
}

function measure(text, size, bold = false) {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * size * 1.08 * (bold ? 1.08 : 1);
}

// for the letter-spaced header label (1px extra per character).
function measureSpaced(text, size) {
  return measure(text, size) + Array.from(text).length;
}

function ellipsize(text, size, maxW, bold = false) {
  if (measure(text, size, bold) <= maxW) return text;
  const chars = Array.from(text);
  while (chars.length && measure(chars.join("") + "…", size, bold) > maxW) chars.pop();
  return chars.join("").trimEnd() + "…";
}

function ellipsizeSpaced(text, size, maxW) {
  if (measureSpaced(text, size) <= maxW) return text;
  const chars = Array.from(text);
  while (chars.length && measureSpaced(chars.join("") + "…", size) > maxW) chars.pop();
  return chars.join("").trimEnd() + "…";
}

// wraps a bold title into widths.length lines leaving room for the year at the end of the last line
function fitTitle(title, year, widths) {
  const lines = wrapText(title, TITLE_SIZE, widths, true);
  if (year) {
    const last = lines.length - 1;
    const room = widths[last] - (measure(year, YEAR_SIZE) + 5);
    if (measure(lines[last], TITLE_SIZE, true) > room) {
      lines[last] = ellipsize(lines[last].replace(/…$/, ""), TITLE_SIZE, room, true);
    }
  }
  return lines;
}

// word wrap. widths[n] is the space available on line n; the last line gets an ellipsis if text is left over. words too long for a whole line (or titles with no spaces, like many Japanese titles) are split by character
function wrapText(text, size, widths, bold) {
  const maxLines = widths.length;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const maxW = widths[lines.length];
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (measure(candidate, size, bold) <= maxW) {
      line = candidate;
      continue;
    }
    if (lines.length === maxLines - 1) {
      const rest = [candidate, ...words.slice(i + 1)].join(" ");
      return [...lines, ellipsize(rest, size, maxW, bold)];
    }
    if (line) {
      lines.push(line);
      line = "";
      i--; // retry this word on the new line
      continue;
    }
    const chars = Array.from(words[i]);
    let head = "";
    while (chars.length && measure(head + chars[0], size, bold) <= maxW) head += chars.shift();
    if (!head) head = chars.shift(); // always make progress
    lines.push(head);
    words[i] = chars.join("");
    if (words[i]) i--;
  }
  if (line || lines.length === 0) lines.push(line);
  return lines.slice(0, maxLines);
}

// "2026-09-28" → "Sep 28" this year, "Dec 3, 2025" in other years.
function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const label = `${MONTHS[m - 1]} ${d}`;
  return y === new Date().getUTCFullYear() ? label : `${label}, ${y}`;
}

// ---------- safety ----------

// escapes text for XML and removes control characters XML doesn't allow. every piece of third-party text passes through here before being drawn
function esc(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round(n) {
  return Math.round(n * 10) / 10;
}