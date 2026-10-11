// Router: matches the v1 URL contract, validates input, and turns results or errors into HTTP responses.
// Caching happens in three places:
// - Workers Cache (wrangler.jsonc) stores finished responses in front of this Worker, following the Cache-Control headers set below. On a cache hit, none of this code runs.
// - src/cache.js keeps films in memory briefly and a last known good copy in KV.
// - src/posters.js keeps finished posters in KV.

import { FeedError } from "./letterboxd.js";
import { getFilmsCached } from "./cache.js";
import { parseParams } from "./params.js";
import { embedPosters } from "./posters.js";
import { renderWidget, renderErrorCard } from "./render.js";

const ROUTE = /^\/v1\/letterboxd\/([^/]+)\.(svg|json)$/;
const USERNAME = /^[A-Za-z0-9_]{1,30}$/;

// Seconds. Successful responses may also be served for up to a day past expiry while a fresh copy is fetched in the background.
const CACHE = {
  fresh: "public, max-age=3600, stale-while-revalidate=86400",
  stale: "public, max-age=300",       // Letterboxd down; showing last good
  notFound: "public, max-age=300",
  invalid: "public, max-age=300",
  unavailable: "public, max-age=60",
  limited: "public, max-age=10",
};

export default {
  async fetch(request, env = {}, ctx = { waitUntil() {} }) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, 405, "no-store");
    }

    const url = new URL(request.url);
    const match = url.pathname.match(ROUTE);
    if (!match) return json({ error: "Not found" }, 404, CACHE.invalid);

    const [, rawUsername, format] = match;
    const limited = await isRateLimited(request, env);
    return format === "svg"
      ? handleSvg(rawUsername, url.searchParams, limited, env, ctx)
      : handleJson(rawUsername, limited, env, ctx);
  },
};

// Only cache misses reach this code, so this limits how often one visitor
// can make the Worker do real work (fetching Letterboxd, drawing SVGs).
async function isRateLimited(request, env) {
  if (!env.RATE_LIMITER) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return !success;
  } catch {
    return false; // if the limiter itself fails, let the request through
  }
}

// ---------- .json ----------

async function handleJson(rawUsername, limited, env, ctx) {
  if (limited) return json({ error: "Too many requests" }, 429, CACHE.limited);
  if (!USERNAME.test(rawUsername)) return json({ error: "Invalid username" }, 400, CACHE.invalid);
  const username = rawUsername.toLowerCase();
  try {
    const { films, stale } = await getFilmsCached(username, env, ctx);
    return json(
      {
        username,
        profileUrl: `https://letterboxd.com/${username}/`,
        fetchedAt: new Date().toISOString(),
        stale,
        films,
      },
      200,
      stale ? CACHE.stale : CACHE.fresh
    );
  } catch (err) {
    if (err instanceof FeedError && err.kind === "not_found") {
      return json({ error: "Letterboxd user not found" }, 404, CACHE.notFound);
    }
    console.error(err);
    return json({ error: "Couldn't reach Letterboxd" }, 502, CACHE.unavailable);
  }
}

// ---------- .svg ----------
// Always answers with a real image and status 200 (see README), so an embed never turns into a broken-image icon.

async function handleSvg(rawUsername, searchParams, limited, env, ctx) {
  const opts = parseParams(searchParams);
  if (limited) return svg(renderErrorCard("Too many requests, try again in a minute", opts), CACHE.limited);
  if (!USERNAME.test(rawUsername)) return svg(renderErrorCard("Invalid username", opts), CACHE.invalid);
  const username = rawUsername.toLowerCase();

  let films, stale;
  try {
    ({ films, stale } = await getFilmsCached(username, env, ctx));
  } catch (err) {
    if (err instanceof FeedError && err.kind === "not_found") {
      return svg(renderErrorCard("Letterboxd user not found", opts), CACHE.notFound);
    }
    console.error(err);
    return svg(renderErrorCard("Couldn't reach Letterboxd", opts), CACHE.unavailable);
  }
  if (films.length === 0) return svg(renderErrorCard("No films logged yet", opts), CACHE.notFound);

  films = films.slice(0, opts.limit);
  if (!opts.hide.has("posters")) films = await embedPosters(films, env, ctx);
  return svg(renderWidget(username, films, opts), stale ? CACHE.stale : CACHE.fresh);
}

// ---------- responses ----------

function svg(body, cacheControl) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cacheControl,
      // If someone opens the SVG directly in a tab, it can't run scripts or load anything external, even if something slipped past escaping
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function json(body, status, cacheControl) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
    },
  });
}