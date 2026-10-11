const SMALL_SIZE = "-0-70-0-105-crop";
const MAX_BYTES = 500_000;
const KV_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function embedPosters(films, env, ctx) {
  return Promise.all(
    films.map(async (film) => ({ ...film, posterData: await posterData(film.poster, env, ctx) }))
  );
}

async function posterData(url, env, ctx) {
  if (!url) return "";
  const key = `poster:${url}`.slice(0, 512); // KV keys max out at 512 bytes

  if (env.WIDGET_KV) {
    try {
      const cached = await env.WIDGET_KV.get(key);
      if (cached) return cached;
    } catch {
      // fall through to downloading
    }
  }

  const data = await toDataUri(url);
  if (data && env.WIDGET_KV) {
    ctx.waitUntil(
      env.WIDGET_KV.put(key, data, { expirationTtl: KV_TTL_SECONDS }).catch((err) =>
        console.warn(`Couldn't cache poster: ${err.message}`)
      )
    );
  }
  return data;
}

async function toDataUri(url) {
  // Letterboxd's poster URLs encode their size, e.g. "...-0-600-0-900-crop.jpg".
  // Asking for a small version keeps each SVG light. If that size doesn't exist, fall back to the original URL.
  const small = url.replace(/-0-\d+-0-\d+-crop/, SMALL_SIZE);
  return (small !== url && (await download(small))) || (await download(url)) || "";
}

async function download(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const type = (res.headers.get("Content-Type") || "").split(";")[0].trim();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return "";
    return `data:${type};base64,${toBase64(bytes)}`;
  } catch {
    return "";
  }
}

// btoa() needs a binary string; build it in chunks to avoid "argument list too long" errors on larger images
function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}