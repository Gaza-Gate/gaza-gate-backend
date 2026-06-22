const { sequelize } = require("../config/db.config.js");
const Product = require("../models/product.model.js");
const ProductImage = require("../models/productImage.model.js");
const cloudinaryService = require("./cloudinary.service.js");
const AppError = require("../utils/AppError.util.js");
const PRODUCT_STOCK_TYPES = require("../constants/stockType.constants.js");

const getSellerIdFromRequest = (req) => {
  return req.user?.id || req.user?.sellerId || null;
};

const getSellerProducts = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) {
    throw new AppError("Seller authentication data is missing.", 401);
  }
  
  return await Product.findAll({
    where: {
      sellerId,
      isDeleted: false,
    },
    include: [
      {
        model: ProductImage,
        attributes: ["id", "imageUrl", "isPrimary", "position"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
};

const createProduct = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) {
    throw new AppError("Seller authentication data is missing.", 401);
  }
  if (!req.files || req.files.length === 0) {
    throw new AppError("At least one product image is required.", 400);
  }

  const uploadedImages = [];
  const folder = `products/${sellerId}`;
  try {
    const images = await cloudinaryService.uploadManyImages(req.files, folder);
    uploadedImages.push(...images);

    const product = await sequelize.transaction(async (transaction) => {
      const stockType = req.body.stockType || PRODUCT_STOCK_TYPES.UNLIMITED;

      const quantity =
        stockType === PRODUCT_STOCK_TYPES.LIMITED
          ? req.body.quantity
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
        { transaction }
      );

      const imageRows = images.map((img, index) => ({
        productId: createdProduct.id,
        imageUrl: img.url,
        publicId: img.publicId,
        isPrimary: index === 0,
        position: index,
      }));

      await ProductImage.bulkCreate(imageRows, { transaction });

      return createdProduct;
    });

    return product;
  } catch (error) {
    await Promise.all(
      uploadedImages.map((img) =>
        cloudinaryService.deleteImage(img.publicId).catch(() => null)
      )
    );
    throw error;
  }
};

const updateProduct = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) {
    throw new AppError("Seller authentication data is missing.", 401);
  }

  const productId = req.params.id;
  const product = await Product.findOne({
    where: {
      id: productId,
      sellerId,
      isDeleted: false,
    },
  });

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  const uploadedImages = [];
  const folder = `products/${sellerId}/${product.id}`;
  try {
    if (req.files && req.files.length > 0) {
      const images = await cloudinaryService.uploadManyImages(req.files, folder);
      uploadedImages.push(...images);
    }

    const updatedProduct = await sequelize.transaction(async (transaction) => {
      const nextStockType = req.body.stockType ?? product.stockType;

      const nextQuantity =
        nextStockType === PRODUCT_STOCK_TYPES.LIMITED
          ? (req.body.quantity !== undefined ? req.body.quantity : product.quantity)
          : null;

      await product.update(
        {
          categoryId: req.body.categoryId ?? product.categoryId,
          name: req.body.name ?? product.name,
          description:
            req.body.description !== undefined
              ? req.body.description
              : product.description,
          price: req.body.price ?? product.price,
          stockType: nextStockType,
          quantity: nextQuantity,
          status: req.body.status ?? product.status,
        },
        { transaction }
      );

      if (uploadedImages.length > 0) {
        const maxPosition = await ProductImage.max("position", {
          where: { productId: product.id },
          transaction,
        });

        const startPosition =
          maxPosition === null || maxPosition === undefined
            ? 0
            : Number(maxPosition) + 1;

        const imageRows = uploadedImages.map((img, index) => ({
          productId: product.id,
          imageUrl: img.url,
          publicId: img.publicId,
          isPrimary: false,
          position: startPosition + index,
        }));

        await ProductImage.bulkCreate(imageRows, { transaction });
      }

      return product;
    });

    return updatedProduct;
  } catch (error) {
    await Promise.all(
      uploadedImages.map((img) =>
        cloudinaryService.deleteImage(img.publicId).catch(() => null)
      )
    );
    throw error;
  }
};

const toggleStatus = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) {
    throw new AppError("Seller authentication data is missing.", 401);
  }

  const productId = req.params.id;
  const product = await Product.findOne({
    where: {
      id: productId,
      sellerId,
      isDeleted: false,
    },
  });
  if (!product) {
    throw new AppError("Product not found.", 404);
  }
  
  const nextStatus = product.status === "active" ? "draft" : "active";
  await product.update({ status: nextStatus });

  return product;
};

const deleteProduct = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) {
    throw new AppError("Seller authentication data is missing.", 401);
  }

  const productId = req.params.id;
  const product = await Product.findOne({
    where: {
      id: productId,
      sellerId,
      isDeleted: false,
    },
  });
  if (!product) {
    throw new AppError("Product not found.", 404);
  }
  
  const productImages = await ProductImage.findAll({
    where: { productId: product.id },
  });
  
  await sequelize.transaction(async (transaction) => {
    await ProductImage.destroy({
      where: { productId: product.id },
      transaction,
    });
    await product.update({ isDeleted: true }, { transaction });
  });
  
  if (productImages.length > 0) {
    await Promise.all(
      productImages.map((img) =>
        cloudinaryService.deleteImage(img.publicId).catch(() => null)
      )
    );
  }

  return { message: "Product and its associated images deleted successfully." };
};

module.exports = {
  getSellerProducts,
  createProduct,
  updateProduct,
  toggleStatus,
  deleteProduct,
};