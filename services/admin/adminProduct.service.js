const { Op } = require("sequelize");
const { sequelize } = require("../../config/db.config.js");

const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const Category = require("../../models/category.model.js");
const Seller = require("../../models/seller.model.js");
const User = require("../../models/user.model.js");

const cloudinaryService = require("../../services/integrations/cloudinary.service.js");
const notificationService = require("../../services/notification/notification.service.js");
const AppError = require("../../utils/http/AppError.util.js");

const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const NOTIFICATION_TYPES = require("../../constants/notification/notificationTypes.constant.js");

const getAdminProducts = async (req) => {
  const { search, status, categoryId, minPrice, maxPrice, page } =
    req.query ?? {};

  const currentPage = Math.max(Number(page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (currentPage - 1) * limit;

  const where = {
    isDeleted: false,
  };

  if (search?.trim()) {
    where.name = { [Op.like]: `%${search.trim()}%` };
  }

  if (status && Object.values(PRODUCT_STATUS).includes(status)) {
    where.status = status;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price[Op.gte] = minPrice;
    if (maxPrice !== undefined) where.price[Op.lte] = maxPrice;
  }

  const { count, rows } = await Product.findAndCountAll({
    where,
    attributes: [
      "id",
      "name",
      "price",
      "stockType",
      "quantity",
      "status",
      "averageRating",
      "reviewsCount",
      "created_at",
    ],
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name"],
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
      {
        model: ProductImage,
        as: "images",
        where: { isPrimary: true },
        required: false,
        attributes: ["imageUrl", "publicId", "isPrimary"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  });

  const totalPages = Math.ceil(count / limit);

  const products = rows.map((row) => {
    const plain = row.toJSON ? row.toJSON() : row;
    const primary = Array.isArray(plain.images) ? plain.images[0] : null;

    return {
      id: plain.id,
      name: plain.name,
      price: plain.price ? Number(plain.price) : null,
      stockType: plain.stockType,
      quantity: plain.quantity,
      status: plain.status,
      averageRating: Number(plain.averageRating ?? 0),
      reviewsCount: Number(plain.reviewsCount ?? 0),
      category: plain.category
        ? { id: plain.category.id, name: plain.category.name }
        : null,
      seller: plain.seller
        ? {
            id: plain.seller.id,
            storeName: plain.seller.storeName,
            avatar: plain.seller.user?.avatar ?? null,
          }
        : null,
      primaryImage: primary
        ? { imageUrl: primary.imageUrl, publicId: primary.publicId }
        : null,
      createdAt: plain.created_at ?? plain.createdAt ?? null,
    };
  });

  return {
    products,
    pagination: {
      totalItems: count,
      totalPages,
      currentPage,
      pageSize: limit,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  };
};

const findProductForAction = async (id) => {
  const product = await Product.findOne({
    where: { id, isDeleted: false },
    attributes: ["id", "name", "status", "sellerId", "isDeleted"],
    include: [
      {
        model: ProductImage,
        as: "images",
        attributes: ["id", "publicId", "imageUrl"],
        required: false,
      },
      {
        model: Seller,
        as: "seller",
        attributes: ["id", "userId", "storeName"],
        required: true,
      },
    ],
  });

  if (!product) throw AppError.fail("Product not found.", 404);

  return product;
};

const parseReason = (reason) => {
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) {
    throw AppError.fail("Reason is required.", 400);
  }
  if (trimmed.length > 500) {
    throw AppError.fail("Reason must be at most 500 characters.", 400);
  }
  return trimmed;
};

const notifySellerAboutProductAction = async ({
  product,
  adminUserId,
  action,
  reason,
}) => {
  const sellerUserId = product.seller?.userId;
  if (!sellerUserId) return null;

  const productName = product.name;
  const actionUrl = `/seller/products/${product.id}`;

  const notificationsByAction = {
    hide: {
      title: "تم إخفاء منتجك",
      content: `تم إخفاء المنتج "${productName}" من قبل الإدارة.\nالسبب: ${reason}`,
    },
    delete: {
      title: "تم حذف منتجك",
      content: `تم حذف المنتج "${productName}" من قبل الإدارة.\nالسبب: ${reason}`,
    },
    activate: {
      title: "تم تفعيل منتجك",
      content: `تم إعادة تفعيل المنتج "${productName}" من قبل الإدارة.`,
    },
  };

  const payload = notificationsByAction[action];
  if (!payload) return null;

  return notificationService.notifySafely({
    recipientUserIds: [sellerUserId],
    senderId: adminUserId,
    type: NOTIFICATION_TYPES.PRODUCT,
    title: payload.title,
    content: payload.content,
    actionUrl,
  });
};

const updateProductStatus = async (req) => {
  const { productId } = req.params;
  const { status } = req.body ?? {};

  if (!Object.values(PRODUCT_STATUS).includes(status)) {
    throw AppError.fail("Invalid status. Use active or hidden.", 400);
  }

  const product = await findProductForAction(productId);

  if (product.status === status) {
    throw AppError.fail(`Product is already ${status}.`, 400);
  }

  const isHiding = status === PRODUCT_STATUS.HIDDEN;
  const reason = isHiding ? parseReason(req.body?.reason) : null;

  await product.update({ status });

  await notifySellerAboutProductAction({
    product,
    adminUserId: req.user?.id,
    action: isHiding ? "hide" : "activate",
    reason,
  });

  return {
    productId: product.id,
    status,
    ...(reason ? { reason } : {}),
    notifiedSeller: Boolean(product.seller?.userId),
  };
};

const deleteProduct = async (req) => {
  const { productId } = req.params;
  const reason = parseReason(req.body?.reason);

  const product = await findProductForAction(productId);
  const images = Array.isArray(product.images) ? product.images : [];

  await sequelize.transaction(async (transaction) => {
    await ProductImage.destroy({
      where: { productId: product.id },
      transaction,
    });
    await product.update({ isDeleted: true }, { transaction });
  });

  await Promise.all(
    images.map((img) =>
      img?.publicId
        ? cloudinaryService.deleteImage(img.publicId).catch(() => null)
        : null,
    ),
  );

  await notifySellerAboutProductAction({
    product,
    adminUserId: req.user?.id,
    action: "delete",
    reason,
  });

  return {
    productId: product.id,
    action: "delete",
    deleted: true,
    reason,
    notifiedSeller: Boolean(product.seller?.userId),
  };
};

module.exports = {
  getAdminProducts,
  updateProductStatus,
  deleteProduct,
};
