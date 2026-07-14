const { sequelize } = require("../../config/db.config.js");
const Review = require("../../models/review.model.js");
const Seller = require("../../models/seller.model.js");
const Customer = require("../../models/customer.model.js");
const User = require("../../models/user.model.js");
const Product = require("../../models/product.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const NOTIFICATION_TYPES = require("../../constants/notification/notificationTypes.constant.js");
const notificationService = require("../notification/notification.service.js");

const REVIEW_WAIT_DAYS = 5;

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

const isAtLeastDaysOld = (date, days = REVIEW_WAIT_DAYS) => {
  if (!date) return false;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(date).getTime() >= thresholdMs;
};

const assertOrderEligibleForReview = (order) => {
  if (order.status === ORDER_STATUSES.CANCELLED) {
    throw AppError.fail("Cannot review a cancelled order.", 400);
  }

  if (
    order.status === ORDER_STATUSES.REJECTED ||
    order.status === ORDER_STATUSES.COMPLETED
  ) {
    return;
  }

  const statusEnteredAtByStatus = {
    [ORDER_STATUSES.PENDING_REVIEW]: order.created_at,
    [ORDER_STATUSES.ACCEPTED]: order.acceptedAt,
    [ORDER_STATUSES.IN_PRODUCTION]: order.inProductionAt,
    [ORDER_STATUSES.READY]: order.readyAt,
  };

  const statusEnteredAt = statusEnteredAtByStatus[order.status];
  if (!statusEnteredAt || !isAtLeastDaysOld(statusEnteredAt)) {
    console.log("DEBUG statusEnteredAt:", statusEnteredAt);
    console.log("DEBUG isAtLeastDaysOld:", isAtLeastDaysOld(statusEnteredAt));

    throw AppError.fail(
      `This order is not eligible for review yet. It must remain in its current status for at least ${REVIEW_WAIT_DAYS} days.`,
      400,
    );
  }
};

const createReview = async (req) => {
  if (req.user?.role !== "customer") {
    throw AppError.fail("Access denied.", 403);
  }

  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    throw AppError.fail("User authentication data is missing.", 401);
  }

  const { productId, orderId, rating, comment } = req.body || {};
  const parsedRating = Number(rating);

  if (!productId) {
    throw AppError.fail("productId is required.", 400);
  }
  if (!orderId) {
    throw AppError.fail("orderId is required.", 400);
  }
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw AppError.fail("rating must be an integer between 1 and 5.", 400);
  }

  const customer = await Customer.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  const existingReview = await Review.findOne({
    where: {
      customerId: customer.id,
      productId,
      isDeleted: false,
    },
    attributes: ["id"],
  });
  if (existingReview) {
    throw AppError.fail("You have already reviewed this product.", 409);
  }

  let review;
  let productName;
  let sellerUserId;

  const transaction = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: {
        id: orderId,
        customerId: customer.id,
        isDeleted: false,
      },
      attributes: [
        "id",
        "sellerId",
        "status",
        "reviewedAt",
        "created_at",
        "acceptedAt",
        "inProductionAt",
        "readyAt",
      ],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: ["productId"],
          where: { productId },
          required: true,
        },
      ],
      transaction,
    });

    if (!order) {
      throw AppError.fail("Order containing this product was not found.", 404);
    }

    assertOrderEligibleForReview(order);

    const product = await Product.findOne({
      where: { id: productId, isDeleted: false },
      attributes: ["id", "name", "sellerId", "averageRating", "reviewsCount"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product) {
      throw AppError.fail("Product not found.", 404);
    }

    if (product.sellerId !== order.sellerId) {
      throw AppError.fail("Product does not belong to this order.", 400);
    }

    const seller = await Seller.findOne({
      where: { id: product.sellerId },
      attributes: ["id", "userId", "rating", "ratingCount"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!seller) {
      throw AppError.fail("Seller not found.", 404);
    }

    review = await Review.create(
      {
        customerId: customer.id,
        sellerId: seller.id,
        productId: product.id,
        orderId: order.id,
        rating: parsedRating,
        comment: comment?.trim() || null,
      },
      { transaction },
    );

    const productRating = recalculateAverage(
      product.averageRating,
      product.reviewsCount,
      parsedRating,
    );
    await product.update(
      {
        averageRating: productRating.average,
        reviewsCount: productRating.count,
      },
      { transaction },
    );

    const sellerRating = recalculateAverage(
      seller.rating,
      seller.ratingCount,
      parsedRating,
    );
    await seller.update(
      {
        rating: sellerRating.average,
        ratingCount: sellerRating.count,
      },
      { transaction },
    );

    if (!order.reviewedAt) {
      await order.update({ reviewedAt: new Date() }, { transaction });
    }

    productName = product.name;
    sellerUserId = seller.userId;

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeUniqueConstraintError") {
      throw AppError.fail("You have already reviewed this product.", 409);
    }
    throw error;
  }

  if (sellerUserId) {
    const stars = "★".repeat(parsedRating) + "☆".repeat(5 - parsedRating);
    await notificationService.notifySafely({
      recipientUserIds: [sellerUserId],
      senderId: userId,
      type: NOTIFICATION_TYPES.REVIEW,
      title: "تقييم جديد",
      content: `حصلت على تقييم ${stars} (${parsedRating}/5) على المنتج "${productName}"`,
      actionUrl: `/seller/reviews`,
    });
  }

  return {
    id: review.id,
    productId: review.productId,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
};

const getSellerRatingStats = async (sellerId) => {
  const rows = await Review.findAll({
    where: { sellerId },
    attributes: [
      "rating",
      [sequelize.fn("COUNT", sequelize.col("rating")), "count"],
    ],
    group: ["rating"],
    raw: true,
  });

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  rows.forEach((item) => {
    distribution[item.rating] = parseInt(item.count);
  });

  return distribution;
};

const getSellerReviews = async (userId, query) => {
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);
  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id", "rating", "ratingCount"],
  });

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = { sellerId: seller.id };
  const rating = query.rating;
  const parsedRating = parseInt(rating);

  if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
    where.rating = parsedRating;
  }

  const { count, rows } = await Review.findAndCountAll({
    where: where,
    attributes: ["rating", "comment", ["created_at", "createdAt"]],
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["firstName", "lastName", "avatar"],
          },
        ],
      },
      {
        model: Product,
        as: "product",
        attributes: ["name"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit: limit,
    offset: offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);

  const distribution = await getSellerRatingStats(seller.id);

  return {
    averageRating: seller.rating,
    totalReviews: seller.ratingCount,
    distribution,
    reviews: rows,
    pagination: {
      totalItems: count,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

module.exports = { createReview, getSellerReviews };
