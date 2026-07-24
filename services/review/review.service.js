const { sequelize } = require("../../config/db.config.js");
const Review = require("../../models/review.model.js");
const Seller = require("../../models/seller.model.js");
const Customer = require("../../models/customer.model.js");
const User = require("../../models/user.model.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const NOTIFICATION_TYPES = require("../../constants/notification/notificationTypes.constant.js");
const notificationService = require("../notification/notification.service.js");
const cloudinaryService = require("../integrations/cloudinary.service.js");
const {
  REVIEW_WAIT_DAYS,
  REVIEW_EDIT_WINDOW_DAYS,
  recalculateAverage,
  replaceRating,
  removeRating,
  isAtLeastDaysOld,
  isWithinEditWindow,
  buildPagination,
} = require("./review.helpers.js");
const { mapSellerSummary } = require("../../utils/navigation/sellerStoreLink.util.js");

const assertWithinEditWindow = (createdAt) => {
  if (!isWithinEditWindow(createdAt)) {
    throw AppError.fail(
      `Reviews can only be edited or deleted within ${REVIEW_EDIT_WINDOW_DAYS} days of creation.`,
      400,
    );
  }
};

/** Ensures createdAt/updatedAt are available via review.get("createdAt") */
const REVIEW_WRITE_ATTRIBUTES = [
  "id",
  "customerId",
  "sellerId",
  "productId",
  "orderId",
  "rating",
  "comment",
  "imageUrl",
  "publicId",
  "isDeleted",
  ["created_at", "createdAt"],
  ["updated_at", "updatedAt"],
];

const resolveCustomerFromRequest = async (req) => {
  if (req.user?.role !== "customer") {
    throw AppError.fail("Access denied.", 403);
  }

  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    throw AppError.fail("User authentication data is missing.", 401);
  }

  const customer = await Customer.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  return { userId, customer };
};

const primaryImageInclude = {
  model: ProductImage,
  as: "images",
  attributes: ["imageUrl"],
  where: { isPrimary: true },
  required: false,
  separate: true,
};

const getRatingDistribution = async (where) => {
  const rows = await Review.findAll({
    where: { ...where, isDeleted: false },
    attributes: [
      "rating",
      [sequelize.fn("COUNT", sequelize.col("rating")), "count"],
    ],
    group: ["rating"],
    raw: true,
  });

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((item) => {
    distribution[item.rating] = parseInt(item.count, 10);
  });
  return distribution;
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
  let uploadedPublicId = null;
  let oldPublicIdToDelete = null;

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

    if (seller.userId === userId) {
      throw AppError.fail("You cannot review your own product.", 400);
    }

    let imageUrl = null;
    if (req.file) {
      const uploaded = await cloudinaryService.uploadImage(
        req.file.buffer,
        "reviews",
      );
      imageUrl = uploaded.url;
      uploadedPublicId = uploaded.publicId;
    }

    const now = new Date();
    const softDeletedReview = await Review.findOne({
      where: {
        customerId: customer.id,
        productId: product.id,
        isDeleted: true,
      },
      attributes: REVIEW_WRITE_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (softDeletedReview) {
      oldPublicIdToDelete = softDeletedReview.publicId || null;
      await Review.update(
        {
          sellerId: seller.id,
          orderId: order.id,
          rating: parsedRating,
          comment: comment?.trim() || null,
          imageUrl,
          publicId: uploadedPublicId,
          isDeleted: false,
          created_at: now,
          updated_at: now,
        },
        { where: { id: softDeletedReview.id }, transaction },
      );
      review = await Review.findByPk(softDeletedReview.id, {
        attributes: REVIEW_WRITE_ATTRIBUTES,
        transaction,
      });
    } else {
      review = await Review.create(
        {
          customerId: customer.id,
          sellerId: seller.id,
          productId: product.id,
          orderId: order.id,
          rating: parsedRating,
          comment: comment?.trim() || null,
          imageUrl,
          publicId: uploadedPublicId,
        },
        { transaction },
      );
    }

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
    if (uploadedPublicId) {
      await cloudinaryService
        .deleteImage(uploadedPublicId)
        .catch((err) =>
          console.error(
            `Failed to delete orphaned review image: ${uploadedPublicId}`,
            err,
          ),
        );
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      throw AppError.fail("You have already reviewed this product.", 409);
    }
    throw error;
  }

  if (oldPublicIdToDelete && oldPublicIdToDelete !== uploadedPublicId) {
    await cloudinaryService
      .deleteImage(oldPublicIdToDelete)
      .catch((err) =>
        console.error(
          `Failed to delete old review image: ${oldPublicIdToDelete}`,
          err,
        ),
      );
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

  await review.reload({ attributes: REVIEW_WRITE_ATTRIBUTES });

  return {
    id: review.id,
    productId: review.productId,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    imageUrl: review.imageUrl,
    createdAt: review.get("createdAt"),
  };
};

const getSellerRatingStats = async (sellerId) => {
  return getRatingDistribution({ sellerId });
};

const getSellerProductReviewsBySellerId = async (sellerId, query = {}) => {
  const seller = await Seller.findOne({
    where: { id: sellerId },
    attributes: ["id", "rating", "ratingCount"],
  });
  if (!seller) {
    throw AppError.fail("Seller not found.", 404);
  }

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = { sellerId: seller.id, isDeleted: false };
  const parsedRating = parseInt(query.rating, 10);
  if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
    where.rating = parsedRating;
  }

  const [{ count, rows }, distribution] = await Promise.all([
    Review.findAndCountAll({
      where,
      attributes: [
        "id",
        "rating",
        "comment",
        "imageUrl",
        ["created_at", "createdAt"],
      ],
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
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),
    getSellerRatingStats(seller.id),
  ]);

  const reviews = rows.map((review) => {
    const user = review.customer?.user;
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      imageUrl: review.imageUrl ?? null,
      createdAt: review.get("createdAt"),
      customer: user
        ? {
            id: review.customer.id,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
          }
        : null,
      product: review.product
        ? { id: review.product.id, name: review.product.name }
        : null,
    };
  });

  return {
    averageRating: seller.rating,
    totalReviews: seller.ratingCount,
    distribution,
    reviews,
    pagination: buildPagination(count, page, limit),
  };
};

const getSellerReviews = async (userId, query) => {
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);
  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) {
    throw AppError.fail("Seller not found.", 404);
  }

  return getSellerProductReviewsBySellerId(seller.id, query);
};

const getProductReviews = async (productId, query = {}) => {
  const product = await Product.findOne({
    where: { id: productId, isDeleted: false },
    attributes: ["id", "averageRating", "reviewsCount"],
  });
  if (!product) {
    throw AppError.fail("Product not found.", 404);
  }

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = { productId: product.id, isDeleted: false };
  const parsedRating = parseInt(query.rating, 10);
  if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
    where.rating = parsedRating;
  }

  const [{ count, rows }, distribution] = await Promise.all([
    Review.findAndCountAll({
      where,
      attributes: [
        "id",
        "rating",
        "comment",
        "imageUrl",
        ["created_at", "createdAt"],
      ],
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
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),
    getRatingDistribution({ productId: product.id }),
  ]);

  const reviews = rows.map((review) => {
    const user = review.customer?.user;
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      imageUrl: review.imageUrl ?? null,
      createdAt: review.get("createdAt"),
      customer: user
        ? {
            id: review.customer.id,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
          }
        : null,
    };
  });

  return {
    averageRating: product.averageRating,
    totalReviews: product.reviewsCount,
    distribution,
    reviews,
    pagination: buildPagination(count, page, limit),
  };
};

const getMyReviews = async (req) => {
  const { customer } = await resolveCustomerFromRequest(req);
  const query = req.query || {};

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const { count, rows } = await Review.findAndCountAll({
    where: { customerId: customer.id, isDeleted: false },
    attributes: [
      "id",
      "rating",
      "comment",
      "imageUrl",
      "sellerReply",
      "sellerRepliedAt",
      ["created_at", "createdAt"],
    ],
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name"],
        include: [primaryImageInclude],
      },
      {
        model: Seller,
        as: "seller",
        attributes: ["id", "storeName"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["avatar"],
          },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const reviews = rows.map((review) => {
    const product = review.product;
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      imageUrl: review.imageUrl ?? null,
      createdAt: review.get("createdAt"),
      product: product
        ? {
            id: product.id,
            name: product.name,
            image: product.images?.[0]?.imageUrl ?? null,
          }
        : null,
      seller: mapSellerSummary(review.seller, review.seller?.user),
    };
  });

  return {
    reviews,
    pagination: buildPagination(count, page, limit),
  };
};

const updateReview = async (req) => {
  const { customer } = await resolveCustomerFromRequest(req);
  const reviewId = req.params.id;
  const { rating, comment } = req.body || {};

  let uploadedPublicId = null;
  let oldPublicIdToDelete = null;

  const transaction = await sequelize.transaction();
  try {
    const review = await Review.findOne({
      where: {
        id: reviewId,
        customerId: customer.id,
        isDeleted: false,
      },
      attributes: REVIEW_WRITE_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!review) {
      throw AppError.fail("Review not found.", 404);
    }

    assertWithinEditWindow(review.get("createdAt"));

    const hasRating = rating !== undefined && rating !== null && rating !== "";
    const parsedRating = hasRating ? Number(rating) : null;
    if (
      hasRating &&
      (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5)
    ) {
      throw AppError.fail("rating must be an integer between 1 and 5.", 400);
    }

    const oldRating = review.rating;
    const nextRating = hasRating ? parsedRating : oldRating;
    const ratingChanged = hasRating && nextRating !== oldRating;

    if (ratingChanged) {
      const product = await Product.findOne({
        where: { id: review.productId, isDeleted: false },
        attributes: ["id", "averageRating", "reviewsCount", "sellerId"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product) {
        throw AppError.fail("Product not found.", 404);
      }

      const seller = await Seller.findOne({
        where: { id: product.sellerId },
        attributes: ["id", "rating", "ratingCount"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!seller) {
        throw AppError.fail("Seller not found.", 404);
      }

      const productRating = replaceRating(
        product.averageRating,
        product.reviewsCount,
        oldRating,
        nextRating,
      );
      await product.update(
        {
          averageRating: productRating.average,
          reviewsCount: productRating.count,
        },
        { transaction },
      );

      const sellerRating = replaceRating(
        seller.rating,
        seller.ratingCount,
        oldRating,
        nextRating,
      );
      await seller.update(
        {
          rating: sellerRating.average,
          ratingCount: sellerRating.count,
        },
        { transaction },
      );
    }

    const updates = {};
    if (hasRating) updates.rating = nextRating;
    if (comment !== undefined) {
      updates.comment =
        comment === null || comment === "" ? null : String(comment).trim();
    }

    if (req.file) {
      const uploaded = await cloudinaryService.uploadImage(
        req.file.buffer,
        "reviews",
      );
      uploadedPublicId = uploaded.publicId;
      oldPublicIdToDelete = review.publicId;
      updates.imageUrl = uploaded.url;
      updates.publicId = uploaded.publicId;
    }

    if (Object.keys(updates).length === 0) {
      throw AppError.fail("No fields to update.", 400);
    }

    await review.update(updates, { transaction });
    await review.reload({
      attributes: REVIEW_WRITE_ATTRIBUTES,
      transaction,
    });
    await transaction.commit();

    if (oldPublicIdToDelete) {
      await cloudinaryService
        .deleteImage(oldPublicIdToDelete)
        .catch((err) =>
          console.error(
            `Failed to delete old review image: ${oldPublicIdToDelete}`,
            err,
          ),
        );
    }

    return {
      id: review.id,
      productId: review.productId,
      orderId: review.orderId,
      rating: review.rating,
      comment: review.comment,
      imageUrl: review.imageUrl,
      createdAt: review.get("createdAt"),
      updatedAt: review.get("updatedAt"),
    };
  } catch (error) {
    await transaction.rollback();
    if (uploadedPublicId) {
      await cloudinaryService
        .deleteImage(uploadedPublicId)
        .catch((err) =>
          console.error(
            `Failed to delete orphaned review image: ${uploadedPublicId}`,
            err,
          ),
        );
    }
    throw error;
  }
};

const deleteReview = async (req) => {
  const { customer } = await resolveCustomerFromRequest(req);
  const reviewId = req.params.id;

  const transaction = await sequelize.transaction();
  try {
    const review = await Review.findOne({
      where: {
        id: reviewId,
        customerId: customer.id,
        isDeleted: false,
      },
      attributes: REVIEW_WRITE_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!review) {
      throw AppError.fail("Review not found.", 404);
    }

    assertWithinEditWindow(review.get("createdAt"));

    const product = await Product.findOne({
      where: { id: review.productId, isDeleted: false },
      attributes: ["id", "averageRating", "reviewsCount", "sellerId"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      throw AppError.fail("Product not found.", 404);
    }

    const seller = await Seller.findOne({
      where: { id: product.sellerId },
      attributes: ["id", "rating", "ratingCount"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!seller) {
      throw AppError.fail("Seller not found.", 404);
    }

    const productRating = removeRating(
      product.averageRating,
      product.reviewsCount,
      review.rating,
    );
    await product.update(
      {
        averageRating: productRating.average,
        reviewsCount: productRating.count,
      },
      { transaction },
    );

    const sellerRating = removeRating(
      seller.rating,
      seller.ratingCount,
      review.rating,
    );
    await seller.update(
      {
        rating: sellerRating.average,
        ratingCount: sellerRating.count,
      },
      { transaction },
    );

    await review.update({ isDeleted: true }, { transaction });
    await transaction.commit();

    return { id: review.id, deleted: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const replyToReview = async (userId, reviewId, reply) => {
  if (!userId) {
    throw AppError.fail("Seller authentication data is missing.", 401);
  }

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id", "storeName"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);

  const review = await Review.findOne({
    where: {
      id: reviewId,
      sellerId: seller.id,
      isDeleted: false,
    },
    attributes: [
      "id",
      "sellerReply",
      "productId",
      "customerId",
    ],
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["name"],
      },
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "userId"],
      },
    ],
  });

  if (!review) throw AppError.fail("Review not found.", 404);

  const isFirstReply = !review.sellerReply;
  const trimmedReply = reply.trim();
  const repliedAt = new Date();

  await review.update({
    sellerReply: trimmedReply,
    sellerRepliedAt: repliedAt,
  });

  if (isFirstReply && review.customer?.userId) {
    const productName = review.product?.name ?? "your product";
    await notificationService.notifySafely({
      recipientUserIds: [review.customer.userId],
      senderId: userId,
      type: NOTIFICATION_TYPES.REVIEW,
      title: "رد على تقييمك",
      content: `رد ${seller.storeName} على تقييمك للمنتج "${productName}"`,
      actionUrl: `/api/product/public/${review.productId}`,
    });
  }

  return {
    reviewId: reviewId,
    productId: review.productId,
    sellerReply: trimmedReply,
    sellerRepliedAt: repliedAt,
  };
};


module.exports = {
  createReview,
  getSellerReviews,
  getSellerProductReviewsBySellerId,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  replyToReview,
};
