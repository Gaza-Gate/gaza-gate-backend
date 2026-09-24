const GAZA_BOUNDS = require("../../constants/map/gazaBounds.constant.js");
const { KM_PER_DEGREE } = require("../../constants/map/mapSort.constant.js");

const EARTH_RADIUS_KM = 6371;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isInsideGaza = (lat, lng) => {
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  if (latitude == null || longitude == null) return false;

  return (
    latitude >= GAZA_BOUNDS.MIN_LAT &&
    latitude <= GAZA_BOUNDS.MAX_LAT &&
    longitude >= GAZA_BOUNDS.MIN_LNG &&
    longitude <= GAZA_BOUNDS.MAX_LNG
  );
};

const buildBoundingBox = (lat, lng, radiusKm) => {
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  const radius = toNumber(radiusKm);
  if (latitude == null || longitude == null || radius == null || radius <= 0) {
    return null;
  }

  const delta = radius / KM_PER_DEGREE;
  return {
    minLat: latitude - delta,
    maxLat: latitude + delta,
    minLng: longitude - delta,
    maxLng: longitude + delta,
  };
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const aLat = toNumber(lat1);
  const aLng = toNumber(lng1);
  const bLat = toNumber(lat2);
  const bLng = toNumber(lng2);
  if ([aLat, aLng, bLat, bLng].some((v) => v == null)) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

const ratingNearMeScore = (rating, distanceKm) => {
  const r = toNumber(rating) ?? 0;
  const d = Math.max(toNumber(distanceKm) ?? 0, 0);
  return r / (1 + d);
};

const escapeLike = (q) => String(q).replace(/[\\%_]/g, "\\$&");

const ST_DISTANCE_KM_SQL = `ST_Distance_Sphere(
  POINT(s.longitude, s.latitude),
  POINT(:buyerLng, :buyerLat)
) / 1000`;

const HAVERSINE_KM_SQL = `(
  6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(s.latitude - :buyerLat) / 2), 2) +
    COS(RADIANS(:buyerLat)) * COS(RADIANS(s.latitude)) *
    POWER(SIN(RADIANS(s.longitude - :buyerLng) / 2), 2)
  ))
)`;

module.exports = {
  isInsideGaza,
  buildBoundingBox,
  haversineKm,
  ratingNearMeScore,
  escapeLike,
  ST_DISTANCE_KM_SQL,
  HAVERSINE_KM_SQL,
};
