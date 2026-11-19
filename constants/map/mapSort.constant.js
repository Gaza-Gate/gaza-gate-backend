const MAP_SORT = Object.freeze({
  NEAREST: "nearest",
  RATING: "rating",
  RATING_NEAR_ME: "ratingNearMe",
});

const MAP_SORT_VALUES = Object.freeze([
  MAP_SORT.NEAREST,
  MAP_SORT.RATING,
  MAP_SORT.RATING_NEAR_ME,
]);

const MAP_RADIUS = Object.freeze({
  DEFAULT_KM: 15,
  MAX_KM: 50,
  MIN_KM: 1,
});

const KM_PER_DEGREE = 111;

const MAP_LIST_LIMIT = Object.freeze({
  DEFAULT: 10,
  MAX: 20,
});

module.exports = {
  MAP_SORT,
  MAP_SORT_VALUES,
  MAP_RADIUS,
  KM_PER_DEGREE,
  MAP_LIST_LIMIT,
};
