// Rules for public store URLs: gazagate.store/store/<slug>
const STORE_SLUG_LIMITS = Object.freeze({
  MIN: 3,
  MAX: 40,
  // A seller can change their slug once per this many days.
  CHANGE_COOLDOWN_DAYS: 30,
});

// lowercase latin letters, digits and single hyphens; no leading/trailing hyphen
const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Used when a store name has no characters we can turn into a slug.
const STORE_SLUG_FALLBACK = "store";

// Slugs that could be confused with site pages, the API, or the brand.
const RESERVED_STORE_SLUGS = Object.freeze(
  new Set([
    "admin", "administrator", "api", "app", "auth", "cart", "checkout",
    "customer", "customers", "dashboard", "favorites", "gaza-gate", "gazagate",
    "help", "home", "login", "logout", "map", "messages", "my-orders",
    "notifications", "onboarding", "order", "orders", "product", "products",
    "profile", "register", "root", "search", "seller", "sellers", "settings",
    "signup", "store", "stores", "support", "system", "verify-email", "welcome",
    "www",
  ]),
);

module.exports = {
  STORE_SLUG_LIMITS,
  STORE_SLUG_PATTERN,
  STORE_SLUG_FALLBACK,
  RESERVED_STORE_SLUGS,
};
