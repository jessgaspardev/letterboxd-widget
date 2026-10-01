// router matches the v1 URL contract, validates input, and turns results or errors into HTTP responses.

import { getFilms, FeedError } from "./letterboxd.js";

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
    if (!USERNAME.test(rawUsername)) return json({ error: "Invalid username" }, 400);
    const username = rawUsername.toLowerCase();

    if (format === "svg") {
      // Placeholder until Phase 2.
      return new Response("SVG rendering arrives in Phase 2.", {
        status: 501,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

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
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}