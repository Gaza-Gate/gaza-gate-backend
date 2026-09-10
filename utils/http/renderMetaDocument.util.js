const AppError = require("./AppError.util.js");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const assetUrl = (value, baseUrl) => {
  if (!value) return null;
  let url;
  try {
    url = new URL(value, baseUrl);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw AppError.error("Meta page asset URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw AppError.error("Meta page assets must use http(s) URLs.");
  }
  return escapeHtml(url.href);
};

const renderMetaDocument = (metadata) => {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const image = escapeHtml(metadata.image);
  const url = escapeHtml(metadata.url);
  const script = assetUrl(process.env.SCRIPT_URL, metadata.url);
  const style = assetUrl(process.env.STYLE_URL, metadata.url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ""}
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="${escapeHtml(metadata.type)}" />
  <meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ""}
  ${style ? `<link rel="stylesheet" href="${style}" />` : ""}
</head>
<body>
  <div id="root"></div>
  <a href="${url}">View ${title}</a>
  ${script ? `<script src="${script}" defer></script>` : ""}
</body>
</html>`;
};

module.exports = renderMetaDocument;
