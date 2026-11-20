const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

// The frontend's index.html is fetched once and reused for a few minutes.
const SHELL_TTL_MS = 5 * 60 * 1000;
const SHELL_TIMEOUT_MS = 5000;
let shellCache = { html: null, fetchedAt: 0 };

// Where to fetch the frontend's index.html from. Must NOT be a /store/* URL
// (those are routed to this backend). Defaults to FRONTEND_BASE_URL + "/".
const appShellUrl = () => {
  const explicit = process.env.FRONTEND_APP_SHELL_URL;
  if (explicit) return explicit;
  const base = (process.env.FRONTEND_BASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/` : null;
};

const fetchAppShell = async () => {
  const now = Date.now();
  if (shellCache.html && now - shellCache.fetchedAt < SHELL_TTL_MS) return shellCache.html;

  const url = appShellUrl();
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(SHELL_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const html = await response.text();
    if (!html.includes("</head>")) throw new Error("not an HTML page");
    shellCache = { html, fetchedAt: now };
    return html;
  } catch (error) {
    console.warn(`[storePage] could not fetch app shell from ${url}: ${error.message}`);
    return shellCache.html; // stale copy is better than nothing
  }
};

const metaTags = (metadata) => {
  const tags = [
    `<meta property="og:type" content="${escapeHtml(metadata.type || "website")}" />`,
    `<meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(metadata.url)}" />`,
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `<meta name="twitter:card" content="${metadata.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(metadata.url)}" />`,
  ];
  if (metadata.image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(metadata.image)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`,
    );
  }
  return tags.join("\n    ");
};

// Drop tags we are replacing so crawlers don't see two titles/descriptions.
const stripExistingMeta = (html) =>
  html
    .replace(/<meta\s+(?:property|name)="(?:og:[^"]+|twitter:[^"]+|description)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");

/**
 * Serves the real frontend page (index.html) for /store/<key>, with the
 * store's link-preview tags injected. Humans get the normal React app;
 * crawlers (WhatsApp, Facebook, Telegram) read the tags.
 *
 * @param {object|null} metadata - { title, description, image, url, type, siteName }
 * @returns {Promise<string>} HTML
 */
const renderAppShellWithMeta = async (metadata) => {
  const shell = await fetchAppShell();

  if (!shell) {
    // Frontend unreachable: minimal page that still gives crawlers a card.
    const title = escapeHtml(metadata?.title || "Gaza Gate");
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${metadata ? metaTags(metadata) : ""}
  </head>
  <body>
    <a href="/">${title}</a>
  </body>
</html>`;
  }

  if (!metadata) return shell;

  return stripExistingMeta(shell)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace("</head>", `    ${metaTags(metadata)}\n  </head>`);
};

// for tests
const resetAppShellCache = () => {
  shellCache = { html: null, fetchedAt: 0 };
};

module.exports = renderAppShellWithMeta;
module.exports.resetAppShellCache = resetAppShellCache;
