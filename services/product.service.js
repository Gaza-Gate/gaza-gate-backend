const { Op } = require("sequelize");
const uuidValidate = require("uuid-validate");
const { sequelize } = require("../config/db.config.js");
const Product = require("../models/product.model.js");
const ProductImage = require("../models/productImage.model.js");
const Category = require("../models/category.model.js");
const Seller = require("../models/seller.model");
const Customer = require("../models/customer.model.js");
const Wishlist = require("../models/wishlist.model.js");
const cloudinaryService = require("./cloudinary.service.js");
const AppError = require("../utils/AppError.util.js");
const token = require("../utils/token.util.js");
const USER_ROLES = require("../constants/userRoles.constant.js");
const PRODUCT_STOCK_TYPES = require("../constants/stockType.constants.js");
const PRODUCT_STATUS = require("../constants/productStatus.constants.js");
const PAGINATION = require("../constants/pagination.constant.js");

const PUBLIC_SORT_OPTIONS = {
  price_asc: [["price", "ASC"]],
  price_desc: [["price", "DESC"]],
  newest: [["created_at", "DESC"]],
  rating: [["average_rating", "DESC"]],
};

const resolveCustomerIdFromRequest = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const accessToken = authHeader.split(" ")[1];
    const decoded = token.verifyAccessToken(accessToken);

    if (decoded.role !== USER_ROLES.CUSTOMER) {
      return null;
    }

    const customer = await Customer.findOne({
      where: { userId: decoded.userId },
      attributes: ["id"],
    });

    return customer?.id ?? null;
  } catch (error) {
    return null;
  }
};

const getSellerIdFromRequest = (req) => {
  return req.user?.id || req.user?.userId || null;
};

const getSellerProducts = async (req) => {
  const userId = getSellerIdFromRequest(req);
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);

  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const { count, rows } = await Product.findAndCountAll({
    where: {
      sellerId,
      isDeleted: false,
      ...(search && {
        name: { [Op.like]: `%${search}%` },
      }),
    },
    include: [
      {
        model: ProductImage,
        as: "images",
        attributes: ["id", "imageUrl", "isPrimary", "position"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);
  return {
    products: rows,
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

const createProduct = async (req) => {
  const userId = getSellerIdFromRequest(req);
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);
  if (!req.file) throw AppError.fail("Product image is required.", 400);
  let uploadedImage = null;

  try {
    const seller = await Seller.findOne({
      where: { userId },
      attributes: ["id"],
    });
    if (!seller) throw AppError.fail("Seller not found.", 404);
    const sellerId = seller?.id;

    const folder = `products/${sellerId}`;

    uploadedImage = await cloudinaryService.uploadImage(
      req.file.buffer,
      folder,
    );

    const product = await sequelize.transaction(async (transaction) => {
      const stockType = req.body.stockType || PRODUCT_STOCK_TYPES.UNLIMITED;

      const quantity =
        stockType === PRODUCT_STOCK_TYPES.LIMITED
          ? Number(req.body.quantity)
          : null;

      const createdProduct = await Product.create(
        {
          sellerId,
          categoryId: req.body.categoryId,
          name: req.body.name,
          description: req.body.description || null,
          price: req.body.price,
          stockType,
          quantity,
          status: req.body.status,
        },
        { transaction },
      );

      const createdImage = await ProductImage.create(
        {
          productId: createdProduct.id,
          imageUrl: uploadedImage.url,
          publicId: uploadedImage.publicId,
          isPrimary: true,
          position: 0,
        },
        { transaction },
      );

      return {
        ...createdProduct.toJSON(),
        images: [
          {
            id: createdImage.id,
            imageUrl: createdImage.imageUrl,
            isPrimary: createdImage.isPrimary,
            position: createdImage.position,
          },
        ],
      };
    });

    return product;
  } catch (error) {
    if (uploadedImage) {
      await cloudinaryService
        .deleteImage(uploadedImage.publicId)
        .catch(() => null);
    }
    throw error;
  }
};

const updateProduct = async (req) => {
  const userId = getSellerIdFromRequest(req);
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const product = await Product.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
  });
  if (!product) throw AppError.fail("Product not found.", 404);

  const folder = `products/${sellerId}`;
  let uploadedImage = null;
  let oldPublicId = null;

  try {
    if (req.file) {
      uploadedImage = await cloudinaryService.uploadImage(
        req.file.buffer,
        folder,
      );
    }

    await sequelize.transaction(async (transaction) => {
      const nextStockType = req.body.stockType ?? product.stockType;
      const nextQuantity =
        nextStockType === PRODUCT_STOCK_TYPES.LIMITED
          ? req.body.quantity !== undefined
            ? req.body.quantity
            : product.quantity
          : null;

      await product.update(
        {
          categoryId: req.body.categoryId ?? product.categoryId,
          name: req.body.name ?? product.name,
          description:
            req.body.description !== undefined
              ? req.body.description || null
              : product.description,
          price: req.body.price ?? product.price,
          stockType: nextStockType,
          quantity: nextQuantity,
          status: req.body.status ?? product.status,
        },
        { transaction },
      );

      if (uploadedImage) {
        const oldImage = await ProductImage.findOne({
          where: { productId: product.id },
          transaction,
        });

        oldPublicId = oldImage?.publicId ?? null;

        await ProductImage.update(
          {
            imageUrl: uploadedImage.url,
            publicId: uploadedImage.publicId,
          },
          { where: { productId: product.id }, transaction },
        );
      }
    });

    if (oldPublicId) {
      await cloudinaryService
        .deleteImage(oldPublicId)
        .catch((err) =>
          console.error(`Failed to delete old image: ${oldPublicId}`, err),
        );
    }

    return product.reload({
      include: [
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "imageUrl", "isPrimary", "position"],
        },
      ],
    });
  } catch (error) {
    if (uploadedImage) {
      await cloudinaryService
        .deleteImage(uploadedImage.publicId)
        .catch(() => null);
    }
    throw error;
  }
};

const toggleStatus = async (req) => {
  const userId = getSellerIdFromRequest(req);
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const product = await Product.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
  });
  if (!product) throw AppError.fail("Product not found.", 404);

  const nextStatus =
    product.status === PRODUCT_STATUS.ACTIVE
      ? PRODUCT_STATUS.HIDDEN
      : PRODUCT_STATUS.ACTIVE;

  await product.update({ status: nextStatus });

  return {
    productId: product.id,
    status: nextStatus,
  };
};

const deleteProduct = async (req) => {
  const userId = getSellerIdFromRequest(req);
  if (!userId)
    throw AppError.fail("Seller authentication data is missing.", 401);

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const product = await Product.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
  });
  if (!product) throw AppError.fail("Product not found.", 404);

  const productImage = await ProductImage.findOne({
    where: { productId: product.id },
  });

  await sequelize.transaction(async (transaction) => {
    await ProductImage.destroy({
      where: { productId: product.id },
      transaction,
    });
    await product.update({ isDeleted: true }, { transaction });
  });

  if (productImage?.publicId) {
    await cloudinaryService
      .deleteImage(productImage.publicId)
      .catch(() => null);
  }

  return { message: "Product deleted successfully." };
};

const getAllProductsPublic = async (req) => {
  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";
  const sort = req.query.sort || "newest";

  const where = {
    status: PRODUCT_STATUS.ACTIVE,
    isDeleted: false,
  };

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  if (req.query.categoryId) {
    where.categoryId = req.query.categoryId;
  }

  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    where.price = {};
    if (req.query.minPrice !== undefined) {
      where.price[Op.gte] = req.query.minPrice;
    }
    if (req.query.maxPrice !== undefined) {
      where.price[Op.lte] = req.query.maxPrice;
    }
  }

  const order = PUBLIC_SORT_OPTIONS[sort] || PUBLIC_SORT_OPTIONS.newest;

  const { count, rows } = await Product.findAndCountAll({
    where,
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
        model: Category,
        as: "category",
        attributes: ["id", "name"],
      },
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
    order,
    limit,
    offset,
    distinct: true,
  });

  const products = rows.map((product) => {
    const primaryImage = product.images?.[0];

    return {
      id: product.id,
      name: product.name,
      price: product.price,
      stockType: product.stockType,
      quantity: product.quantity,
      averageRating: product.averageRating,
      reviewsCount: product.reviewsCount,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
      seller: product.seller ? { storeName: product.seller.storeName } : null,
      primaryImage: primaryImage ? { imageUrl: primaryImage.imageUrl } : null,
    };
  });

  const totalPages = Math.ceil(count / limit);

  return {
    products,
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

const getProductDetailsPublic = async (req) => {
  const { id } = req.params;

  if (!uuidValidate(id, 4)) {
    throw AppError.fail("Invalid product ID.", 400);
  }

  const customerId = await resolveCustomerIdFromRequest(req);

  const product = await Product.findOne({
    where: {
      id,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: false,
    },
    attributes: [
      "id",
      "name",
      "description",
      "price",
      "stockType",
      "quantity",
      "status",
      "averageRating",
      "reviewsCount",
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
      },
      {
        model: ProductImage,
        as: "images",
        attributes: ["id", "imageUrl", "isPrimary", "position"],
        separate: true,
        order: [["position", "ASC"]],
      },
    ],
  });

  if (!product) {
    throw AppError.fail("Product not found.", 404);
  }

  let isWishlisted = false;

  if (customerId) {
    const wishlistItem = await Wishlist.findOne({
      where: { customerId, productId: product.id },
    });
    isWishlisted = !!wishlistItem;
  }

  return {
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stockType: product.stockType,
      quantity: product.quantity,
      status: product.status,
      averageRating: product.averageRating,
      reviewsCount: product.reviewsCount,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
      seller: product.seller
        ? { id: product.seller.id, storeName: product.seller.storeName }
        : null,
      images: (product.images || []).map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        isPrimary: image.isPrimary,
        position: image.position,
      })),
      isWishlisted,
    },
  };
};

module.exports = {
  getSellerProducts,
  createProduct,
  updateProduct,
  toggleStatus,
  deleteProduct,
  getAllProductsPublic,
  getProductDetailsPublic,
};
