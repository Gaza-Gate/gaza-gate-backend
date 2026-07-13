const ORDER_STATUSES = Object.freeze({
  PENDING_REVIEW: "pending_review",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  IN_PRODUCTION: "in_production",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

module.exports = ORDER_STATUSES;
