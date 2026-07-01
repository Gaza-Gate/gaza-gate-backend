const { Op } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const Product = require("../models/product.model.js");
const ProductImage = require("../models/productImage.model.js");
const Seller = require("../models/seller.model");
const cloudinaryService = require("./cloudinary.service.js");
const AppError = require("../utils/AppError.util.js");
const PRODUCT_STOCK_TYPES = require("../constants/stockType.constants.js");
const PRODUCT_STATUS = require("../constants/productStatus.constants.js");
const PAGINATION = require("../constants/pagination.constant.js");

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

module.exports = {
  getSellerProducts,
  createProduct,
  updateProduct,
  toggleStatus,
  deleteProduct,
};
