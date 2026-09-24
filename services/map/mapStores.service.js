const { sequelize } = require("../../config/db.config.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const UserStatus = require("../../constants/user/userStatus.constant.js");
const {
  MAP_SORT,
  MAP_SORT_VALUES,
  MAP_RADIUS,
  MAP_LIST_LIMIT,
} = require("../../constants/map/mapSort.constant.js");
const {
  buildBoundingBox,
  escapeLike,
  ST_DISTANCE_KM_SQL,
} = require("../../utils/map/geo.util.js");
const {
  buildSellerStoreActionUrl,
} = require("../../utils/navigation/sellerStoreLink.util.js");

const ADDRESS_JOIN = `
LEFT JOIN (
  SELECT a.user_id, a.neighborhood, a.street
  FROM address a
  INNER JOIN (
    SELECT user_id, MAX(created_at) AS max_created
    FROM address
    GROUP BY user_id
  ) latest ON latest.user_id = a.user_id AND latest.max_created = a.created_at
) addr ON addr.user_id = s.user_id
`;

const hasGps = (lat, lng) => lat != null && lng != null && lat !== "" && lng !== "";

const roundDistanceKm = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
};

const parseMapStoresQuery = (query = {}) => {
  const lat = query.lat === undefined || query.lat === "" ? null : Number(query.lat);
  const lng = query.lng === undefined || query.lng === "" ? null : Number(query.lng);
  const gps = hasGps(lat, lng);

  const requestedSort = MAP_SORT_VALUES.includes(query.sort) ? query.sort : null;
  const sort = requestedSort || (gps ? MAP_SORT.NEAREST : MAP_SORT.RATING);

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = Math.min(
    Math.max(Number(query.limit) || MAP_LIST_LIMIT.DEFAULT, 1),
    MAP_LIST_LIMIT.MAX,
  );
  const radiusKm = gps
    ? Number(query.radiusKm) || MAP_RADIUS.DEFAULT_KM
    : null;
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const categoryId = query.categoryId || null;

  return {
    lat: gps ? lat : null,
    lng: gps ? lng : null,
    gps,
    sort,
    page,
    limit,
    offset: (page - 1) * limit,
    radiusKm,
    q,
    categoryId,
  };
};

const buildWhereSql = (parsed, replacements) => {
  const clauses = [
    "s.latitude IS NOT NULL",
    "s.longitude IS NOT NULL",
    "u.status = :userStatus",
  ];
  replacements.userStatus = UserStatus.ACTIVE;

  if (parsed.gps) {
    const box = buildBoundingBox(parsed.lat, parsed.lng, parsed.radiusKm);
    clauses.push("s.latitude BETWEEN :minLat AND :maxLat");
    clauses.push("s.longitude BETWEEN :minLng AND :maxLng");
    replacements.minLat = box.minLat;
    replacements.maxLat = box.maxLat;
    replacements.minLng = box.minLng;
    replacements.maxLng = box.maxLng;
    replacements.buyerLat = parsed.lat;
    replacements.buyerLng = parsed.lng;
    replacements.radiusKm = parsed.radiusKm;
  }

  if (parsed.q) {
    clauses.push("s.store_name LIKE :like ESCAPE '\\\\'");
    replacements.like = `%${escapeLike(parsed.q)}%`;
  }

  if (parsed.categoryId) {
    clauses.push(`EXISTS (
      SELECT 1 FROM product p
      WHERE p.seller_id = s.id
        AND p.category_id = :categoryId
        AND p.status = :productStatus
        AND p.is_deleted = 0
    )`);
    replacements.categoryId = parsed.categoryId;
    replacements.productStatus = PRODUCT_STATUS.ACTIVE;
  }

  return clauses.join("\n  AND ");
};

const buildOrderSql = (sort, gps) => {
  if (sort === MAP_SORT.NEAREST && gps) {
    return "distance_km ASC, s.rating DESC, s.rating_count DESC";
  }
  if (sort === MAP_SORT.RATING_NEAR_ME && gps) {
    return "(s.rating / (1 + distance_km)) DESC, distance_km ASC";
  }
  return "s.rating DESC, s.rating_count DESC";
};

const buildMapStoresSql = (query = {}) => {
  const parsed = parseMapStoresQuery(query);
  const replacements = {
    limit: parsed.limit,
    offset: parsed.offset,
  };
  const whereSql = buildWhereSql(parsed, replacements);
  const distanceSelect = parsed.gps
    ? `,\n  ${ST_DISTANCE_KM_SQL} AS distance_km`
    : "";
  const havingSql = parsed.gps ? "HAVING distance_km <= :radiusKm" : "";
  const orderSql = buildOrderSql(parsed.sort, parsed.gps);

  const fromSql = `
FROM seller s
INNER JOIN user u ON u.id = s.user_id
${ADDRESS_JOIN}
WHERE ${whereSql}
`.trim();

  const countSql = parsed.gps
    ? `
SELECT COUNT(*) AS total FROM (
  SELECT s.id
    ${distanceSelect}
  ${fromSql}
  ${havingSql}
) counted
`.trim()
    : `
SELECT COUNT(*) AS total
${fromSql}
`.trim();

  const selectSql = `
SELECT
  s.id,
  s.store_name AS storeName,
  s.rating,
  s.rating_count AS ratingCount,
  s.latitude,
  s.longitude,
  addr.neighborhood,
  addr.street,
  u.avatar
  ${distanceSelect}
${fromSql}
${havingSql}
ORDER BY ${orderSql}
LIMIT :limit OFFSET :offset
`.trim();

  return {
    ...parsed,
    countSql,
    selectSql,
    replacements,
    orderSql,
  };
};

const mapStoreRow = (row, gps) => ({
  id: row.id,
  storeName: row.storeName,
  avatar: row.avatar ?? null,
  rating: Number(row.rating),
  ratingCount: Number(row.ratingCount),
  distanceKm: gps ? roundDistanceKm(row.distance_km) : null,
  neighborhood: row.neighborhood ?? null,
  street: row.street ?? null,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  actionUrl: buildSellerStoreActionUrl(row.id),
});

const getMapStores = async (query = {}) => {
  const plan = buildMapStoresSql(query);

  const [countRows, storeRows] = await Promise.all([
    sequelize.query(plan.countSql, { replacements: plan.replacements }),
    sequelize.query(plan.selectSql, { replacements: plan.replacements }),
  ]);

  const totalItems = Number(countRows[0]?.[0]?.total ?? 0);
  const rows = storeRows[0] || [];
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / plan.limit);

  return {
    stores: rows.map((row) => mapStoreRow(row, plan.gps)),
    pagination: {
      currentPage: plan.page,
      totalPages,
      totalItems,
      pageSize: plan.limit,
      hasNextPage: plan.page < totalPages,
      hasPreviousPage: plan.page > 1,
    },
  };
};

module.exports = {
  getMapStores,
  buildMapStoresSql,
  parseMapStoresQuery,
};
