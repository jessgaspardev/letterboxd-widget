// reads the query string into a complete, validated set of options

export const THEMES = {
  dark:        { bg: "#14181c", text: "#ffffff", muted: "#8899aa", accent: "#00c030", heart: "#ff8000", border: "#2c3440", frame: "rgba(221,238,255,0.22)" },
  light:       { bg: "#f8f9fa", text: "#1f262e", muted: "#6b7884", accent: "#00a02a", heart: "#e07000", border: "#dde2e7", frame: "rgba(20,24,28,0.15)" },
  transparent: { bg: "none",    text: "#8a8a8a", muted: "#8a8a8a", accent: "#00b02c", heart: "#f07800", border: "rgba(138,138,138,0.35)", frame: "rgba(138,138,138,0.45)" },
};

const DEFAULTS = {
  limit: 4,
  width: 300,
  theme: "dark",
  radius: 4,
  header: "Recently watched",
};

const COLOR_KEYS = ["bg", "text", "muted", "accent", "heart", "border"];
const HIDEABLE = ["header", "ratings", "posters", "year", "date", "likes"];
const HEADER_MAX = 40;

export function parseParams(searchParams) {
  const themeName = THEMES[searchParams.get("theme")] ? searchParams.get("theme") : DEFAULTS.theme;
  const colors = { ...THEMES[themeName] };
  for (const key of COLOR_KEYS) {
    const value = hexColor(searchParams.get(key));
    if (value) colors[key] = value;
  }

  const header = (searchParams.get("header") || "").trim();
  const hide = new Set(
    (searchParams.get("hide") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => HIDEABLE.includes(s))
  );

  return {
    limit: intInRange(searchParams.get("limit"), 1, 10, DEFAULTS.limit),
    width: intInRange(searchParams.get("width"), 200, 600, DEFAULTS.width),
    radius: intInRange(searchParams.get("radius"), 0, 20, DEFAULTS.radius),
    theme: themeName,
    colors,
    header: header ? Array.from(header).slice(0, HEADER_MAX).join("") : DEFAULTS.header,
    hide,
  };
}

// whole numbers only: "4" is fine, "4.5", "-1", "10px" and "" are not.
function intInRange(raw, min, max, fallback) {
  if (raw === null || !/^\d{1,4}$/.test(raw)) return fallback;
  const n = parseInt(raw, 10);
  return n >= min && n <= max ? n : fallback;
}

// accepts "e2a33d" or "fff". also tolerates a leading "#" in case someone encoded it as %23,anything else returns null, so nothing unexpected ever reaches the SVG
function hexColor(raw) {
  if (!raw) return null;
  const hex = raw.replace(/^#/, "");
  return /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}