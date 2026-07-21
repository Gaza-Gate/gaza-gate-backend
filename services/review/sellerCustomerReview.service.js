const { sequelize } = require("../../config/db.config.js");
const SellerCustomerReview = require("../../models/sellerCustomerReview.model.js");
const Seller = require("../../models/seller.model.js");
const Customer = require("../../models/customer.model.js");
const User = require("../../models/user.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const {
  REVIEW_EDIT_WINDOW_DAYS,
  isWithinEditWindow,
  buildPagination,
} = require("./review.helpers.js");
const { mapSellerSummary } = require("../../utils/navigation/sellerStoreLink.util.js");

const primaryImageInclude = {
  model: ProductImage,
  as: "images",
  attributes: ["imageUrl"],
  where: { isPrimary: true },
  required: false,
  separate: true,
};

const REVIEW_ATTRIBUTES = [
  "id",
  "sellerId",
  "customerId",
  "orderId",
  "rating",
  "comment",
  "isDeleted",
  ["created_at", "createdAt"],
  ["updated_at", "updatedAt"],
];

const assertWithinEditWindow = (createdAt) => {
  if (!isWithinEditWindow(createdAt)) {
    throw AppError.fail(
      `Reviews can only be edited or deleted within ${REVIEW_EDIT_WINDOW_DAYS} days of creation.`,
      400,
    );
  }
};

const resolveSellerFromRequest = async (req) => {
  if (req.user?.role !== "seller") {
    throw AppError.fail("Access denied.", 403);
  }

  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    throw AppError.fail("User authentication data is missing.", 401);
  }

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id", "userId", "storeName"],
  });
  if (!seller) {
    throw AppError.fail("Seller not found.", 404);
  }

  return { userId, seller };
};

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

const mapSellerCustomerReview = (review) => {
  const seller = review.seller;
  const sellerUser = seller?.user;
  const item = review.order?.items?.[0];

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.get("createdAt"),
    seller: mapSellerSummary(seller, sellerUser),
    order: review.order
      ? {
          id: review.order.id,
          orderNumber: review.order.orderNumber,
        }
      : null,
    product: item
      ? {
          id: item.productId,
          name: item.productName,
          image: item.productImage ?? item.product?.images?.[0]?.imageUrl ?? null,
        }
      : null,
  };
};

const mapMySellerCustomerReview = (review) => {
  const customer = review.customer;
  const customerUser = customer?.user;
  const item = review.order?.items?.[0];

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.get("createdAt"),
    customer: customer
      ? {
          id: customer.id,
          firstName: customerUser?.firstName ?? null,
          lastName: customerUser?.lastName ?? null,
          avatar: customerUser?.avatar ?? null,
        }
      : null,
    order: review.order
      ? {
          id: review.order.id,
          orderNumber: review.order.orderNumber,
        }
      : null,
    product: item
      ? {
          id: item.productId,
          name: item.productName,
          image: item.productImage ?? item.product?.images?.[0]?.imageUrl ?? null,
        }
      : null,
  };
};

const createSellerCustomerReview = async (req) => {
  const { seller } = await resolveSellerFromRequest(req);
  const { orderId, rating, comment } = req.body || {};
  const parsedRating = Number(rating);

  if (!orderId) {
    throw AppError.fail("orderId is required.", 400);
  }
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw AppError.fail("rating must be an integer between 1 and 5.", 400);
  }

  const activeReview = await SellerCustomerReview.findOne({
    where: { sellerId: seller.id, orderId, isDeleted: false },
    attributes: ["id"],
  });
  if (activeReview) {
    throw AppError.fail("You have already reviewed this order.", 409);
  }

  const transaction = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: {
        id: orderId,
        sellerId: seller.id,
        isDeleted: false,
      },
      attributes: ["id", "customerId", "status", "orderNumber"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw AppError.fail("Order not found.", 404);
    }

    if (order.status !== ORDER_STATUSES.COMPLETED) {
      throw AppError.fail("Only completed orders can be reviewed.", 400);
    }

    const now = new Date();
    const reviewPayload = {
      sellerId: seller.id,
      customerId: order.customerId,
      orderId: order.id,
      rating: parsedRating,
      comment: comment?.trim() || null,
      isDeleted: false,
    };

    const softDeletedReview = await SellerCustomerReview.findOne({
      where: {
        sellerId: seller.id,
        orderId: order.id,
        isDeleted: true,
      },
      attributes: REVIEW_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let review;
    if (softDeletedReview) {
      await SellerCustomerReview.update(
        {
          ...reviewPayload,
          created_at: now,
          updated_at: now,
        },
        { where: { id: softDeletedReview.id }, transaction },
      );
      review = await SellerCustomerReview.findByPk(softDeletedReview.id, {
        attributes: REVIEW_ATTRIBUTES,
        transaction,
      });
    } else {
      review = await SellerCustomerReview.create(reviewPayload, {
        transaction,
      });
      await review.reload({ attributes: REVIEW_ATTRIBUTES, transaction });
    }

    await transaction.commit();

    return {
      id: review.id,
      orderId: review.orderId,
      customerId: review.customerId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.get("createdAt"),
    };
  } catch (error) {
    await transaction.rollback();
    if (error.name === "SequelizeUniqueConstraintError") {
      throw AppError.fail("You have already reviewed this order.", 409);
    }
    throw error;
  }
};

const updateSellerCustomerReview = async (req) => {
  const { seller } = await resolveSellerFromRequest(req);
  const reviewId = req.params.id;
  const { rating, comment } = req.body || {};

  const transaction = await sequelize.transaction();
  try {
    const review = await SellerCustomerReview.findOne({
      where: {
        id: reviewId,
        sellerId: seller.id,
        isDeleted: false,
      },
      attributes: REVIEW_ATTRIBUTES,
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

    const updates = {};
    if (hasRating) updates.rating = parsedRating;
    if (comment !== undefined) {
      updates.comment =
        comment === null || comment === "" ? null : String(comment).trim();
    }

    if (Object.keys(updates).length === 0) {
      throw AppError.fail("No fields to update.", 400);
    }

    await review.update(updates, { transaction });
    await review.reload({ attributes: REVIEW_ATTRIBUTES, transaction });
    await transaction.commit();

    return {
      id: review.id,
      orderId: review.orderId,
      customerId: review.customerId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.get("createdAt"),
      updatedAt: review.get("updatedAt"),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteSellerCustomerReview = async (req) => {
  const { seller } = await resolveSellerFromRequest(req);
  const reviewId = req.params.id;

  const transaction = await sequelize.transaction();
  try {
    const review = await SellerCustomerReview.findOne({
      where: {
        id: reviewId,
        sellerId: seller.id,
        isDeleted: false,
      },
      attributes: REVIEW_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!review) {
      throw AppError.fail("Review not found.", 404);
    }

    assertWithinEditWindow(review.get("createdAt"));
    await review.update({ isDeleted: true }, { transaction });
    await transaction.commit();

    return { id: review.id, deleted: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getCustomerSellerReviews = async (customerId, query = {}) => {
  const customer = await Customer.findOne({
    where: { id: customerId },
    attributes: ["id"],
  });
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const [{ count, rows }, averageResult] = await Promise.all([
    SellerCustomerReview.findAndCountAll({
      where: { customerId: customer.id, isDeleted: false },
      attributes: [
        "id",
        "rating",
        "comment",
        ["created_at", "createdAt"],
      ],
      include: [
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
        {
          model: Order,
          as: "order",
          attributes: ["id", "orderNumber"],
          include: [
            {
              model: OrderItem,
              as: "items",
              attributes: ["productId", "productName", "productImage"],
              limit: 1,
              separate: true,
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id"],
                  required: false,
                  include: [primaryImageInclude],
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),
    SellerCustomerReview.findOne({
      where: { customerId: customer.id, isDeleted: false },
      attributes: [[sequelize.fn("AVG", sequelize.col("rating")), "average"]],
      raw: true,
    }),
  ]);

  const averageRaw = averageResult?.average;
  const averageRating =
    averageRaw == null ? 0 : Number(Number(averageRaw).toFixed(2));

  return {
    averageRating,
    totalReviews: count,
    reviews: rows.map(mapSellerCustomerReview),
    pagination: buildPagination(count, page, limit),
  };
};

const getSellerCustomerReviewsBySellerId = async (sellerId, query = {}) => {
  const seller = await Seller.findOne({
    where: { id: sellerId },
    attributes: ["id"],
  });
  if (!seller) {
    throw AppError.fail("Seller not found.", 404);
  }

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const [{ count, rows }, averageResult] = await Promise.all([
    SellerCustomerReview.findAndCountAll({
      where: { sellerId: seller.id, isDeleted: false },
      attributes: [
        "id",
        "rating",
        "comment",
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
          model: Order,
          as: "order",
          attributes: ["id", "orderNumber"],
          include: [
            {
              model: OrderItem,
              as: "items",
              attributes: ["productId", "productName", "productImage"],
              limit: 1,
              separate: true,
              include: [
                {
                  model: Product,
                  as: "product",
                  attributes: ["id"],
                  required: false,
                  include: [primaryImageInclude],
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),
    SellerCustomerReview.findOne({
      where: { sellerId: seller.id, isDeleted: false },
      attributes: [[sequelize.fn("AVG", sequelize.col("rating")), "average"]],
      raw: true,
    }),
  ]);

  const averageRaw = averageResult?.average;
  const averageRating =
    averageRaw == null ? 0 : Number(Number(averageRaw).toFixed(2));

  return {
    averageRating,
    totalReviews: count,
    reviews: rows.map(mapMySellerCustomerReview),
    pagination: buildPagination(count, page, limit),
  };
};

const getMySellerCustomerReviews = async (req) => {
  const { seller } = await resolveSellerFromRequest(req);
  return getSellerCustomerReviewsBySellerId(seller.id, req.query || {});
};

const getMyReceivedSellerReviews = async (req) => {
  const { customer } = await resolveCustomerFromRequest(req);
  return getCustomerSellerReviews(customer.id, req.query || {});
};

module.exports = {
  createSellerCustomerReview,
  updateSellerCustomerReview,
  deleteSellerCustomerReview,
  getCustomerSellerReviews,
  getSellerCustomerReviewsBySellerId,
  getMySellerCustomerReviews,
  getMyReceivedSellerReviews,
};
