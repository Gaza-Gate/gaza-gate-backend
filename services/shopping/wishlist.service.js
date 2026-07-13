const { Op } = require("sequelize");
const Wishlist = require("../../models/wishlist.model.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const Seller = require("../../models/seller.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const resolveCustomerIdFromRequest = require("../../utils/security/resolveCustomerIdFromRequest.util.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");

const getWishlist = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const { count, rows } = await Wishlist.findAndCountAll({
    where: { customerId },
    include: [
      {
        model: Product,
        as: "product",
        attributes: [
          "id",
          "name",
          "price",
          "stockType",
          "quantity",
          "averageRating",
          "reviewsCount",
          "created_at",
        ],
        include: [
          {
            model: Seller,
            as: "seller",
            attributes: ["id", "storeName"],
          },
          {
            model: ProductImage,
            as: "images",
            where: { isPrimary: true },
            required: false,
            attributes: ["imageUrl"],
          },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);

  const items = rows.map((w) => {
    const product = w.product;
    const primaryImage = product?.images?.[0];

    return {
      id: w.id,
      createdAt: w.created_at,
      product: product
        ? {
            id: product.id,
            name: product.name,
            price: product.price,
            stockType: product.stockType,
            quantity: product.quantity,
            averageRating: product.averageRating,
            reviewsCount: product.reviewsCount,
            seller: product.seller
              ? { id: product.seller.id, storeName: product.seller.storeName }
              : null,
            imageUrl: primaryImage?.imageUrl ?? null,
          }
        : null,
    };
  });

  return {
    items,
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

const addToWishlist = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const { productId } = req.body;
  if (!productId) throw AppError.fail("productId is required.", 400);

  // Use findOrCreate to avoid unique constraint errors
  const [item, created] = await Wishlist.findOrCreate({
    where: { customerId, productId },
    defaults: { customerId, productId },
  });

  if (!created) throw AppError.fail("Product already in wishlist.", 400);

  return item;
};

const removeFromWishlist = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const productId = req.params.productId;
  if (!productId) throw AppError.fail("productId is required.", 400);

  const deleted = await Wishlist.destroy({ where: { customerId, productId } });
  if (!deleted) throw AppError.fail("Wishlist item not found.", 404);

  return { message: "Wishlist item removed." };
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
