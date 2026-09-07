const AppError = require("../http/AppError.util.js");
const { buildSellerStoreActionUrl } = require("./sellerStoreLink.util.js");

const getFrontendBaseUrl = () => {
  const raw = process.env.FRONTEND_BASE_URL?.trim();
  let parsed;

  try {
    parsed = raw ? new URL(raw) : null;
  } catch {
    parsed = null;
  }

  if (
    !parsed ||
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
  ) {
    throw AppError.error(
      "FRONTEND_BASE_URL is missing or invalid. It must be an absolute http(s) URL.",
    );
  }

  return parsed;
};

const joinFrontendUrl = (path) => {
  const base = getFrontendBaseUrl();
  let prefix = `${base.origin}${base.pathname}`;
  if (prefix.endsWith("/")) {
    prefix = prefix.slice(0, -1);
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${suffix}`;
};

const buildProductActionUrl = (productId) => {
  if (!productId) return null;
  return `/product/${productId}`;
};

const buildProductShareUrl = (productId) => {
  const path = buildProductActionUrl(productId);
  if (!path) {
    throw AppError.error("Cannot build a product share URL without a product id.");
  }
  return joinFrontendUrl(path);
};

const buildStoreShareUrl = (sellerId) => {
  const path = buildSellerStoreActionUrl(sellerId);
  if (!path) {
    throw AppError.error("Cannot build a store share URL without a seller id.");
  }
  return joinFrontendUrl(path);
};

const buildSharePayload = (url, text) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedWhatsappText = encodeURIComponent(`${text} ${url}`);

  return {
    url,
    shareText: text,
    targets: {
      whatsapp: `https://wa.me/?text=${encodedWhatsappText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    },
  };
};

module.exports = {
  buildProductActionUrl,
  buildProductShareUrl,
  buildStoreShareUrl,
  buildSharePayload,
};
