const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const metaService = require("../../services/shared/meta.service.js");
const renderAppShellWithMeta = require("../../utils/http/renderAppShellWithMeta.util.js");
const { isUuid } = require("../../utils/navigation/storeSlug.util.js");

// store id or slug-shaped key; anything else can't be a store
const STORE_KEY_PATTERN = /^[a-zA-Z0-9-]{1,40}$/;

const findStoreMeta = (storeKey) =>
  isUuid(storeKey) || STORE_KEY_PATTERN.test(storeKey)
    ? metaService.getStoreMeta(storeKey)
    : null;

// GET /store/:storeKey — the public store page on the site domain
// (gazagate.store/store/* is routed to this backend by the hosting proxy).
// Returns the frontend app with the store's link-preview tags.
const getStorePage = asyncWrapper(async (req, res) => {
  const metadata = await findStoreMeta(req.params.storeKey);
  const html = await renderAppShellWithMeta(metadata);
  res.set("Cache-Control", "public, max-age=300");
  return res.type("html").status(200).send(html);
});

module.exports = { getStorePage };
