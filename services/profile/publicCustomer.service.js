const { sequelize } = require("../../config/db.config.js");
const Customer = require("../../models/customer.model.js");
const User = require("../../models/user.model.js");
const Review = require("../../models/review.model.js");
const Seller = require("../../models/seller.model.js");
const SellerCustomerReview = require("../../models/sellerCustomerReview.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const { mapSellerSummary } = require("../../utils/navigation/sellerStoreLink.util.js");
const {
  buildCustomerProfileActionUrl,
  computeIsTrustedBuyer,
} = require("../../utils/navigation/customerProfileLink.util.js");
const {
  getSellersOrderTrustStats,
} = require("../../utils/navigation/sellerTrustStats.util.js");

const RECENT_SELLER_REVIEWS_LIMIT = 3;
const TOP_CATEGORIES_LIMIT = 3;

const primaryImageInclude = {
  model: ProductImage,
  as: "images",
  attributes: ["imageUrl"],
  where: { isPrimary: true },
  required: false,
  separate: true,
};

const reviewProductInclude = {
  model: Product,
  as: "product",
  attributes: ["id", "name"],
  include: [primaryImageInclude],
};

const reviewSellerInclude = {
  model: Seller,
  as: "seller",
  attributes: ["id", "storeName", "rating", "ratingCount"],
  include: [
    {
      model: User,
      as: "user",
      attributes: ["avatar"],
    },
  ],
};

const findPublicCustomer = async (customerId) => {
  const customer = await Customer.findOne({
    where: { id: customerId },
    attributes: ["id"],
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "firstName",
          "lastName",
          "avatar",
          ["created_at", "createdAt"],
        ],
      },
    ],
  });

  if (!customer || !customer.user) {
    throw AppError.fail("Customer not found.", 404);
  }

  return customer;
};

const mapCustomerReview = (review, orderTrust = null) => {
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
    seller: mapSellerSummary(
      review.seller,
      review.seller?.user,
      orderTrust,
    ),
  };
};

const mapProductFromOrder = (order) => {
  const item = order?.items?.[0];
  if (!item) return null;

  return {
    id: item.productId,
    name: item.productName,
    image: item.productImage ?? item.product?.images?.[0]?.imageUrl ?? null,
  };
};

const mapSellerReviewPreview = (review, orderTrust = null) => {
  const seller = review.seller;
  const sellerUser = seller?.user;

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.get("createdAt"),
    seller: mapSellerSummary(seller, sellerUser, orderTrust),
    product: mapProductFromOrder(review.order),
  };
};

const getSellerReviewStats = async (customerId) => {
  const [totalReviews, averageResult] = await Promise.all([
    SellerCustomerReview.count({
      where: { customerId, isDeleted: false },
    }),
    SellerCustomerReview.findOne({
      where: { customerId, isDeleted: false },
      attributes: [[sequelize.fn("AVG", sequelize.col("rating")), "average"]],
      raw: true,
    }),
  ]);

  const averageRaw = averageResult?.average;
  const averageRating =
    averageRaw == null ? 0 : Number(Number(averageRaw).toFixed(2));

  return { totalReviews, averageRating };
};

const getOrderStats = async (customerId) => {
  const [totalOrders, completedOrders, lastOrder] = await Promise.all([
    Order.count({
      where: { customerId, isDeleted: false },
    }),
    Order.count({
      where: {
        customerId,
        status: ORDER_STATUSES.COMPLETED,
        isDeleted: false,
      },
    }),
    Order.findOne({
      where: { customerId, isDeleted: false },
      attributes: [["created_at", "createdAt"]],
      order: [["created_at", "DESC"]],
    }),
  ]);

  const completionRate =
    totalOrders === 0
      ? 0
      : Math.round((completedOrders / totalOrders) * 100);

  return {
    totalOrders,
    completedOrders,
    completionRate,
    lastOrderAt: lastOrder ? lastOrder.get("createdAt") : null,
  };
};

const getTopCategories = async (customerId) => {
  const [rows] = await sequelize.query(
    `
    SELECT
      c.id AS id,
      c.name AS name,
      COUNT(oi.id) AS purchaseCount
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN product p ON p.id = oi.product_id
    INNER JOIN category c ON c.id = p.category_id
    WHERE o.customer_id = :customerId
      AND o.status = :completedStatus
      AND o.is_deleted = 0
    GROUP BY c.id, c.name
    ORDER BY purchaseCount DESC
    LIMIT :limit
    `,
    {
      replacements: {
        customerId,
        completedStatus: ORDER_STATUSES.COMPLETED,
        limit: TOP_CATEGORIES_LIMIT,
      },
    },
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }));
};

const getSellerReviewsPreview = async (customerId) => {
  const rows = await SellerCustomerReview.findAll({
    where: { customerId, isDeleted: false },
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
        attributes: ["id", "storeName", "rating", "ratingCount"],
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
    limit: RECENT_SELLER_REVIEWS_LIMIT,
  });

  const trustBySellerId = await getSellersOrderTrustStats(
    rows.map((review) => review.seller?.id).filter(Boolean),
  );

  return rows.map((review) =>
    mapSellerReviewPreview(review, trustBySellerId.get(review.seller?.id)),
  );
};

const getPublicCustomerProfile = async (customerId) => {
  const customer = await findPublicCustomer(customerId);
  const user = customer.user;

  const [sellerReviewStats, orderStats, topCategories, sellerReviewsPreview] =
    await Promise.all([
      getSellerReviewStats(customer.id),
      getOrderStats(customer.id),
      getTopCategories(customer.id),
      getSellerReviewsPreview(customer.id),
    ]);

  const isTrustedBuyer = computeIsTrustedBuyer(orderStats);

  return {
    customer: {
      id: customer.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      memberSince: user.get("createdAt"),
      isTrustedBuyer,
      actionUrl: buildCustomerProfileActionUrl(customer.id),
    },
    stats: {
      completedOrders: orderStats.completedOrders,
      totalReviews: sellerReviewStats.totalReviews,
      averageRating: sellerReviewStats.averageRating,
      completionRate: orderStats.completionRate,
    },
    shopping: {
      topCategories,
      lastOrderAt: orderStats.lastOrderAt,
    },
    sellerReviews: {
      averageRating: sellerReviewStats.averageRating,
      totalReviews: sellerReviewStats.totalReviews,
      preview: sellerReviewsPreview,
    },
  };
};

const getPublicCustomerReviews = async (customerId, query = {}) => {
  const customer = await findPublicCustomer(customerId);

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
      ["created_at", "createdAt"],
    ],
    include: [reviewProductInclude, reviewSellerInclude],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);

  const trustBySellerId = await getSellersOrderTrustStats(
    rows.map((review) => review.seller?.id).filter(Boolean),
  );

  return {
    reviews: rows.map((review) =>
      mapCustomerReview(review, trustBySellerId.get(review.seller?.id)),
    ),
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

module.exports = {
  getPublicCustomerProfile,
  getPublicCustomerReviews,
};
