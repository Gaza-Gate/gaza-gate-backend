const {
  REVIEW_WAIT_DAYS,
  REVIEW_EDIT_WINDOW_DAYS,
  recalculateAverage,
  replaceRating,
  removeRating,
  isAtLeastDaysOld,
  isWithinEditWindow,
  buildPagination,
} = require("../../services/review/review.helpers.js");

describe("review.helpers", () => {
  describe("constants", () => {
    test("edit and wait windows are 5 days", () => {
      expect(REVIEW_WAIT_DAYS).toBe(5);
      expect(REVIEW_EDIT_WINDOW_DAYS).toBe(5);
    });
  });

  describe("recalculateAverage", () => {
    test("adds first rating", () => {
      expect(recalculateAverage(0, 0, 5)).toEqual({ average: 5, count: 1 });
    });

    test("adds rating to existing average", () => {
      expect(recalculateAverage(4, 2, 5)).toEqual({ average: 4.33, count: 3 });
    });
  });

  describe("replaceRating", () => {
    test("keeps count and swaps rating", () => {
      // (4*2 - 3 + 5) / 2 = 5/2 = 2.5 -> wait (8 - 3 + 5)/2 = 10/2 = 5
      expect(replaceRating(4, 2, 3, 5)).toEqual({ average: 5, count: 2 });
    });

    test("handles empty count by treating as first rating", () => {
      expect(replaceRating(0, 0, 1, 4)).toEqual({ average: 4, count: 1 });
    });
  });

  describe("removeRating", () => {
    test("resets when last review is removed", () => {
      expect(removeRating(5, 1, 5)).toEqual({ average: 0, count: 0 });
    });

    test("recomputes average after removal", () => {
      // (4.5 * 2 - 4) / 1 = 5
      expect(removeRating(4.5, 2, 4)).toEqual({ average: 5, count: 1 });
    });
  });

  describe("isAtLeastDaysOld", () => {
    test("returns false for missing date", () => {
      expect(isAtLeastDaysOld(null)).toBe(false);
    });

    test("returns false for recent date", () => {
      expect(isAtLeastDaysOld(new Date())).toBe(false);
    });

    test("returns true for date older than window", () => {
      const old = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      expect(isAtLeastDaysOld(old)).toBe(true);
    });
  });

  describe("isWithinEditWindow", () => {
    test("returns false for missing date", () => {
      expect(isWithinEditWindow(null)).toBe(false);
    });

    test("returns true for review created now", () => {
      expect(isWithinEditWindow(new Date())).toBe(true);
    });

    test("returns true for review created 4 days ago", () => {
      const recent = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      expect(isWithinEditWindow(recent)).toBe(true);
    });

    test("returns false for review created 6 days ago", () => {
      const old = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      expect(isWithinEditWindow(old)).toBe(false);
    });
  });

  describe("buildPagination", () => {
    test("builds pagination metadata", () => {
      expect(buildPagination(25, 2, 10)).toEqual({
        totalItems: 25,
        totalPages: 3,
        currentPage: 2,
        pageSize: 10,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    test("handles first page", () => {
      expect(buildPagination(5, 1, 10)).toMatchObject({
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
