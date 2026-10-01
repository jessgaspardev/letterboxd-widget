// router: matches the v1 URL contract, validates input, and turns results or errors into HTTP responses

import { getFilms, FeedError } from "./letterboxd.js";
import { parseParams } from "./params.js";
import { embedPosters } from "./posters.js";
import { renderWidget, renderErrorCard } from "./render.js";

const ROUTE = /^\/v1\/letterboxd\/([^/]+)\.(svg|json)$/;
const USERNAME = /^[A-Za-z0-9_]{1,30}$/;

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    const match = url.pathname.match(ROUTE);
    if (!match) return json({ error: "Not found" }, 404);

    const [, rawUsername, format] = match;
    return format === "svg"
      ? handleSvg(rawUsername, url.searchParams)
      : handleJson(rawUsername);
  },
};

// ---------- .json ----------

async function handleJson(rawUsername) {
  if (!USERNAME.test(rawUsername)) return json({ error: "Invalid username" }, 400);
  const username = rawUsername.toLowerCase();
  try {
    const films = await getFilms(username);
    return json({
      username,
      profileUrl: `https://letterboxd.com/${username}/`,
      fetchedAt: new Date().toISOString(),
      films,
    });
  } catch (err) {
    if (err instanceof FeedError && err.kind === "not_found") {
      return json({ error: "Letterboxd user not found" }, 404);
    }
    console.error(err);
    return json({ error: "Couldn't reach Letterboxd" }, 502);
  }
}

// ---------- .svg ----------

// always answers with a real image and status 200, so an embed never turns into a broken-image icon.

async function handleSvg(rawUsername, searchParams) {
  const opts = parseParams(searchParams);
  if (!USERNAME.test(rawUsername)) return svg(renderErrorCard("Invalid username", opts), 300);
  const username = rawUsername.toLowerCase();

  let films;
  try {
    films = (await getFilms(username)).slice(0, opts.limit);
  } catch (err) {
    if (err instanceof FeedError && err.kind === "not_found") {
      return svg(renderErrorCard("Letterboxd user not found", opts), 300);
    }
    console.error(err);
    return svg(renderErrorCard("Couldn't reach Letterboxd", opts), 60);
  }
  if (films.length === 0) return svg(renderErrorCard("No films logged yet", opts), 300);

  if (!opts.hide.has("posters")) films = await embedPosters(films);
  return svg(renderWidget(username, films, opts), 3600);
}

// ---------- responses ----------

function svg(body, maxAge) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}`,
      // if someone opens the SVG directly in a tab, it can't run scripts or load anything external, even if something slipped past escaping
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}