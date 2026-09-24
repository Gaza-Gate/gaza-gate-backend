const { query, body } = require("express-validator");
const { MAP_SORT, MAP_SORT_VALUES, MAP_RADIUS, MAP_LIST_LIMIT } = require("../../constants/map/mapSort.constant.js");
const { isInsideGaza } = require("../../utils/map/geo.util.js");

const DISTANCE_SORTS = [MAP_SORT.NEAREST, MAP_SORT.RATING_NEAR_ME];

const hasCoord = (value) => value !== undefined && value !== null && value !== "";

const getMapStoresValidator = [
  query("lat")
    .optional({ values: "falsy" })
    .isFloat({ min: -90, max: 90 })
    .withMessage("lat must be a valid latitude")
    .toFloat(),

  query("lng")
    .optional({ values: "falsy" })
    .isFloat({ min: -180, max: 180 })
    .withMessage("lng must be a valid longitude")
    .toFloat(),

  query("sort")
    .optional({ values: "falsy" })
    .isIn(MAP_SORT_VALUES)
    .withMessage(`sort must be one of: ${MAP_SORT_VALUES.join(", ")}`),

  query("categoryId")
    .optional({ values: "falsy" })
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  query("q")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("q must be between 2 and 100 characters"),

  query("radiusKm")
    .optional({ values: "falsy" })
    .isFloat({ min: MAP_RADIUS.MIN_KM, max: MAP_RADIUS.MAX_KM })
    .withMessage(`radiusKm must be between ${MAP_RADIUS.MIN_KM} and ${MAP_RADIUS.MAX_KM}`)
    .toFloat(),

  query("page")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer")
    .toInt(),

  query("limit")
    .optional({ values: "falsy" })
    .isInt({ min: 1, max: MAP_LIST_LIMIT.MAX })
    .withMessage(`limit must be between 1 and ${MAP_LIST_LIMIT.MAX}`)
    .toInt(),

  query().custom((_, { req }) => {
    const { lat, lng, sort } = req.query;
    const latPresent = hasCoord(lat);
    const lngPresent = hasCoord(lng);

    if (latPresent !== lngPresent) {
      throw new Error("lat and lng are both required");
    }

    if (DISTANCE_SORTS.includes(sort) && (!latPresent || !lngPresent)) {
      throw new Error("lat and lng are required when sort is nearest or ratingNearMe");
    }

    return true;
  }),
];

const upsertSellerLocationValidator = [
  body("latitude")
    .exists({ values: "null" })
    .withMessage("latitude is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be a valid number")
    .toFloat(),

  body("longitude")
    .exists({ values: "null" })
    .withMessage("longitude is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be a valid number")
    .toFloat(),

  body().custom((_, { req }) => {
    if (!isInsideGaza(req.body.latitude, req.body.longitude)) {
      throw new Error("Location must be inside Gaza");
    }
    return true;
  }),
];

module.exports = {
  getMapStoresValidator,
  upsertSellerLocationValidator,
};
