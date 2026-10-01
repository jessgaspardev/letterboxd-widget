// downloads poster images and turns them into data: URIs, because an SVG shown through an <img> tag is not allowed to load external files

const SMALL_SIZE = "-0-70-0-105-crop";
const MAX_BYTES = 500_000;

export async function embedPosters(films) {
  return Promise.all(
    films.map(async (film) => ({ ...film, posterData: await toDataUri(film.poster) }))
  );
}

async function toDataUri(url) {
  if (!url) return "";
  // asking for a small version keeps each SVG light. if that size doesn't exist, fall back to the original URL
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