const REVIEW_WAIT_DAYS = 5;
const REVIEW_EDIT_WINDOW_DAYS = 5;

const recalculateAverage = (currentAverage, currentCount, newRating) => {
  const count = Number(currentCount) || 0;
  const average = Number(currentAverage) || 0;
  const nextCount = count + 1;
  const nextAverage = (average * count + Number(newRating)) / nextCount;
  return {
    average: Number(nextAverage.toFixed(2)),
    count: nextCount,
  };
};

const replaceRating = (currentAverage, currentCount, oldRating, newRating) => {
  const count = Number(currentCount) || 0;
  if (count <= 0) {
    return { average: Number(Number(newRating).toFixed(2)), count: 1 };
  }
  const average = Number(currentAverage) || 0;
  const nextAverage =
    (average * count - Number(oldRating) + Number(newRating)) / count;
  return {
    average: Number(nextAverage.toFixed(2)),
    count,
  };
};

const removeRating = (currentAverage, currentCount, oldRating) => {
  const count = Number(currentCount) || 0;
  if (count <= 1) {
    return { average: 0, count: 0 };
  }
  const average = Number(currentAverage) || 0;
  const nextCount = count - 1;
  const nextAverage = (average * count - Number(oldRating)) / nextCount;
  return {
    average: Number(nextAverage.toFixed(2)),
    count: nextCount,
  };
};

const isAtLeastDaysOld = (date, days = REVIEW_WAIT_DAYS) => {
  if (!date) return false;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(date).getTime() >= thresholdMs;
};

const isWithinEditWindow = (createdAt, days = REVIEW_EDIT_WINDOW_DAYS) => {
  if (!createdAt) return false;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(createdAt).getTime() <= thresholdMs;
};

const buildPagination = (count, page, limit) => {
  const totalPages = Math.ceil(count / limit);
  return {
    totalItems: count,
    totalPages,
    currentPage: page,
    pageSize: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

module.exports = {
  REVIEW_WAIT_DAYS,
  REVIEW_EDIT_WINDOW_DAYS,
  recalculateAverage,
  replaceRating,
  removeRating,
  isAtLeastDaysOld,
  isWithinEditWindow,
  buildPagination,
};
