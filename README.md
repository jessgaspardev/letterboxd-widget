# Letterboxd Widget

An embeddable image of your recently logged films on Letterboxd. 

**Customize it:** _(link to the builder page on your Neocities site, once it exists)_

---

## Quick start

```html
<a href="https://letterboxd.com/YOUR_USERNAME/">
  <img src="https://letterboxd-widget.jessgaspardev.workers.dev/v1/letterboxd/YOUR_USERNAME.svg"
       alt="Recently watched on Letterboxd">
</a>
```

Markdown:

```markdown
[![Recently watched on Letterboxd](https://letterboxd-widget.jessgaspardev.workers.dev/v1/letterboxd/YOUR_USERNAME.svg)](https://letterboxd.com/YOUR_USERNAME/)
```

---

## Endpoints

| Route | Returns | Purpose |
|---|---|---|
| `GET /v1/letterboxd/{username}.svg` | `image/svg+xml` | The widget image. |
| `GET /v1/letterboxd/{username}.json` | `application/json` | The same data as JSON. Used for debugging and by the customize page. |

### `{username}`

- Allowed characters: letters, numbers, underscores. Pattern: `^[A-Za-z0-9_]{1,30}$` 
- Case-insensitive. Normalized to lowercase internally
- Anything that fails the pattern is rejected **before** any request is made to Letterboxd.

---

## Parameters (`.svg` route)

All parameters are optional query-string values. **Invalid values silently fall back to the default** rather than producing an error, so a typo in an embed degrades gracefully instead of breaking the image. Unknown parameters are ignored.

| Parameter | Type | Allowed values | Default | Notes |
|---|---|---|---|---|
| `limit` | integer | `1`–`10` | `4` | Number of films shown. Height grows with this. |
| `width` | integer | `200`–`600` (px) | `300` | Height is calculated automatically from `limit` and what's shown. |
| `theme` | string | `dark`, `light`, `transparent` | `dark` | A named set of colors. Individual color parameters below override it. |
| `bg` | hex color | 3 or 6 hex digits, **no `#`** | from theme | Background. |
| `text` | hex color | 3 or 6 hex digits, no `#` | from theme | Film titles. |
| `muted` | hex color | 3 or 6 hex digits, no `#` | from theme | Header label, years, dates, username. |
| `accent` | hex color | 3 or 6 hex digits, no `#` | from theme | Star ratings. |
| `heart` | hex color | 3 or 6 hex digits, no `#` | from theme | The heart shown on liked films. |
| `border` | hex color | 3 or 6 hex digits, no `#` | from theme | Divider lines and empty poster slots. |
| `radius` | integer | `0`–`20` (px) | `4` | Corner radius of the card. |
| `header` | string | up to 40 characters | `Recently watched` | Header label, shown in uppercase. XML-escaped before drawing. |
| `hide` | comma-separated list | `header`, `ratings`, `posters`, `year`, `date`, `likes` | _(nothing hidden)_ | e.g. `hide=date,likes`. Unknown items are ignored. With `posters` hidden, rows become single compact lines and dates aren't shown. |

**Why no `#` in colors:** a raw `#` in a URL starts a fragment and never reaches the server, so `accent=#e2a33d` would silently do nothing. Taking bare hex digits (`accent=e2a33d`) avoids the `%23` encoding trap entirely.

**Why `hide` is a list:** new hideable parts can be added later (`hide=...,rewatches`) without inventing new parameters or breaking existing embeds.

### Image size

Height in px = 34 + 67 × n, where n is the number of films shown (the smaller of `limit` and how many films the member has logged). Subtract 26 if the header is hidden. With `hide=posters`, use 30 × n instead of 67 × n. The default (4 films) is 302 px tall. Error cards are 64 px tall, or 38 px with the header hidden. Width is always exactly `width`.

### Example

```
/v1/letterboxd/amandaseyfrieds.svg?limit=5&width=280&theme=light&accent=e2a33d&hide=date
```

---

## Responses

### Success

- `Content-Type: image/svg+xml; charset=utf-8`
- `Cache-Control: public, max-age=3600` (1 hour)
- The SVG contains a `<title>` element (`Recently watched on Letterboxd by {username}`) for screen readers.
- Poster images are embedded inside the SVG, since `<img>`-loaded SVGs can't load external files.

### Errors

The `.svg` route **always returns a valid image**, with HTTP status `200`, even on errors. A non-image error response would show as a broken-image icon, and some image proxies (like GitHub's) handle non-200 images poorly. Errors are drawn as a small card at the requested width:

| Situation | Card says | Cache time |
|---|---|---|
| Username fails the pattern | "Invalid username" | 5 min |
| Profile doesn't exist | "Letterboxd user not found" | 5 min |
| Profile has no logged films | "No films logged yet" | 5 min |
| Letterboxd unreachable, cached copy exists | _(renders the last good copy normally)_ | 5 min |
| Letterboxd unreachable, no cached copy | "Couldn't reach Letterboxd" | 1 min |

The `.json` route uses real status codes instead: `400` invalid username, `404` user not found, `502` Letterboxd unreachable.

### JSON shape

```json
{
  "username": "amandaseyfrieds",
  "profileUrl": "https://letterboxd.com/amandaseyfrieds/",
  "fetchedAt": "2026-10-01T12:00:00Z",
  "films": [
    {
      "title": "Sinners",
      "year": 2025,
      "rating": "★★★★★",
      "watchedDate": "2026-09-28",
      "liked": true,
      "rewatch": false,
      "url": "https://letterboxd.com/amandaseyfrieds/film/sinners/",
      "poster": "https://a.ltrbxd.com/resized/..."
    }
  ]
}
```

`rating` is an empty string when a film was logged without a rating. `year` is `null` when it can't be parsed. `poster` is an empty string when the feed has no poster. `watchedDate` is `null` when the entry has no diary date. `liked` and `rewatch` are `false` when the feed doesn't say otherwise.

---

## Freshness

Film data is cached for up to an hour, so a newly logged film can take that long to appear. 

---

## License

MIT