const {
  STORE_SLUG_LIMITS,
  STORE_SLUG_PATTERN,
  STORE_SLUG_FALLBACK,
  RESERVED_STORE_SLUGS,
} = require("../../constants/seller/storeSlug.constant.js");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Arabic letters → common Palestinian/Levantine latin spelling.
const ARABIC_TO_LATIN = Object.freeze({
  "ا": "a", "أ": "a", "إ": "e", "آ": "a", "ء": "", "ؤ": "o", "ئ": "e",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "th", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
  "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh",
  "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a", "ﻻ": "la", "لا": "la",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
});

// Tashkeel (harakat), tatweel and other marks that have no latin equivalent.
const ARABIC_MARKS = /[ً-ٰٟـ]/g;

// Inside a word, و and ي are usually long vowels: "مخبوزات" → "mkhbozat", "المدينة" → "almdina".
// At the start of a word they stay consonants: "وردة" → "wrda", "يافا" → "yafa".
const MID_WORD_VOWELS = Object.freeze({ "و": "o", "ي": "i" });

const transliterateArabic = (text) =>
  Array.from(String(text ?? "").replace(ARABIC_MARKS, ""))
    .map((char, index, chars) => {
      const startsWord = index === 0 || !/[؀-ۿ]/.test(chars[index - 1]);
      if (!startsWord && char in MID_WORD_VOWELS) return MID_WORD_VOWELS[char];
      return char in ARABIC_TO_LATIN ? ARABIC_TO_LATIN[char] : char;
    })
    .join("");

const isUuid = (value) => UUID_PATTERN.test(String(value ?? ""));

const isReservedStoreSlug = (slug) => RESERVED_STORE_SLUGS.has(slug);

/**
 * Format check only (no DB): lowercase latin/digits/hyphens, 3-40 chars,
 * not reserved, and not shaped like a UUID (UUIDs are store ids in URLs).
 */
const isValidStoreSlug = (slug) =>
  typeof slug === "string" &&
  slug.length >= STORE_SLUG_LIMITS.MIN &&
  slug.length <= STORE_SLUG_LIMITS.MAX &&
  STORE_SLUG_PATTERN.test(slug) &&
  !isReservedStoreSlug(slug) &&
  !isUuid(slug);

/**
 * Normalizes free text (seller input or a store name) into slug characters.
 * Does not check length, reserved words or uniqueness.
 */
const normalizeStoreSlug = (text) =>
  transliterateArabic(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

/**
 * Base slug suggested from a store name, e.g. "مخبوزات المدينة" → "mkhbwzat-almdyna".
 * Always returns a valid-format slug (may still be taken in the DB).
 */
const suggestStoreSlug = (storeName) => {
  let slug = normalizeStoreSlug(storeName)
    .slice(0, STORE_SLUG_LIMITS.MAX)
    .replace(/-+$/g, "");

  if (slug.length < STORE_SLUG_LIMITS.MIN) {
    slug = slug ? `${STORE_SLUG_FALLBACK}-${slug}` : STORE_SLUG_FALLBACK;
  }
  if (isReservedStoreSlug(slug) || isUuid(slug)) {
    slug = `${slug}-shop`.slice(0, STORE_SLUG_LIMITS.MAX);
  }
  return slug;
};

/**
 * "hala-beauty" + 2 → "hala-beauty-2", trimming the base so it stays ≤ MAX.
 */
const withSlugSuffix = (base, n) => {
  if (n <= 1) return base;
  const suffix = `-${n}`;
  return `${base.slice(0, STORE_SLUG_LIMITS.MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
};

module.exports = {
  isUuid,
  isReservedStoreSlug,
  isValidStoreSlug,
  normalizeStoreSlug,
  suggestStoreSlug,
  transliterateArabic,
  withSlugSuffix,
};
