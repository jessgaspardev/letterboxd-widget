import { getFilms, FeedError } from "./letterboxd.js";

const MEMORY_TTL_MS = 5 * 60 * 1000;
const memory = new Map(); // username → { films, at }

// Returns { films, stale }. `stale` is true when Letterboxd was unreachable and the films came from the last known good copy.
export async function getFilmsCached(username, env, ctx) {
  const hit = memory.get(username);
  if (hit && Date.now() - hit.at < MEMORY_TTL_MS) return { films: hit.films, stale: false };

  try {
    const films = await getFilms(username);
    memory.set(username, { films, at: Date.now() });
    if (memory.size > 500) memory.delete(memory.keys().next().value); // keep memory bounded
    ctx.waitUntil(saveLastKnownGood(username, films, env));
    return { films, stale: false };
  } catch (err) {
    if (err instanceof FeedError && err.kind === "not_found") throw err;
    const saved = await loadLastKnownGood(username, env);
    if (saved) {
      console.warn(`Serving last known good films for ${username}: ${err.message}`);
      return { films: saved, stale: true };
    }
    throw err;
  }
}

async function loadLastKnownGood(username, env) {
  if (!env.WIDGET_KV) return null;
  try {
    const raw = await env.WIDGET_KV.get(`feed:${username}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveLastKnownGood(username, films, env) {
  if (!env.WIDGET_KV || films.length === 0) return;
  try {
    const value = JSON.stringify(films);
    if ((await env.WIDGET_KV.get(`feed:${username}`)) === value) return; // unchanged
    await env.WIDGET_KV.put(`feed:${username}`, value);
  } catch (err) {
    console.warn(`Couldn't save last known good for ${username}: ${err.message}`);
  }
}