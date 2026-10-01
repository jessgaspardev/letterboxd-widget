// Fetching and parsing a Letterboxd member's public RSS feed.

export const MAX_FILMS = 4;

// Thrown when the feed can't be used. `kind` lets the router decide which error to show without parsing error messages.
//   "not_found"   the Letterboxd user doesn't exist
//   "unavailable" network problem, Letterboxd down, or blocked request
export class FeedError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

export async function getFilms(username) {
  const xml = await fetchFeed(username);
  return parseFeed(xml).slice(0, MAX_FILMS);
}

async function fetchFeed(username) {
  let res;
  try {
    res = await fetch(`https://letterboxd.com/${username}/rss/`, {
      headers: {
        "User-Agent": "letterboxd-widget (+https://github.com/jessgaspardev/letterboxd-widget)",
      },
    });
  } catch (err) {
    throw new FeedError("unavailable", `Network error: ${err.message}`);
  }
  if (res.status === 404) throw new FeedError("not_found", "Letterboxd user not found");
  if (!res.ok) throw new FeedError("unavailable", `Letterboxd responded ${res.status}`);
  return res.text();
}

export function parseFeed(xml) {
  return extractItems(xml).map(parseItem).filter(Boolean);
}

// Returns one film, or null for entries that aren't films 
function parseItem(item) {
  const url = getTag(item, "link");
  const description = getTag(item, "description");
  const posterMatch = description.match(/<img[^>]+src="([^"]+)"/);
  const poster = posterMatch ? decodeEntities(posterMatch[1]) : "";

  // Letterboxd's own structured tags.
  const filmTitle = getTag(item, "letterboxd:filmTitle");
  if (filmTitle) {
    return {
      title: filmTitle,
      year: toYear(getTag(item, "letterboxd:filmYear")),
      rating: starsFromNumber(getTag(item, "letterboxd:memberRating")),
      url,
      poster,
    };
  }

  // Fallback: parse the display title, e.g. "Dune: Part Two, 2024 - ★★★★½". Anything without a ", YEAR" isn't a film entry, so it's skipped.
  const m = getTag(item, "title").match(/^(.*),\s*(\d{4})(?:\s+-\s+(.+))?$/);
  if (!m) return null;
  return { title: m[1].trim(), year: toYear(m[2]), rating: (m[3] || "").trim(), url, poster };
}

function extractItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

// Reads the text inside <tag>…</tag>, unwrapping CDATA when present and decoding XML entities (&amp; etc.) when not.
function getTag(itemXml, tag) {
  const m = itemXml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  const content = m[1].trim();
  const cdata = content.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1].trim() : decodeEntities(content);
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" becomes "&lt;", not "<"
}

function toYear(s) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// 4.5 → "★★★★½", 3 → "★★★", missing → ""
function starsFromNumber(s) {
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return "";
  const full = Math.floor(n);
  return "★".repeat(full) + (n - full >= 0.5 ? "½" : "");
}