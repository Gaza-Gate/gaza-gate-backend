const { Op } = require("sequelize");
const uuidValidate = require("uuid-validate");
const { sequelize } = require("../../config/db.config.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const Category = require("../../models/category.model.js");
const Seller = require("../../models/seller.model.js");
const Customer = require("../../models/customer.model.js");
const Wishlist = require("../../models/wishlist.model.js");
const User = require("../../models/user.model.js");
const Review = require("../../models/review.model.js");
const cloudinaryService = require("../integrations/cloudinary.service.js");
const aiService = require("../ai/ai.service.js");
const AppError = require("../../utils/http/AppError.util.js");
const resolveCustomerIdFromRequest = require("../../utils/security/resolveCustomerIdFromRequest.util.js");
const PRODUCT_STOCK_TYPES = require("../../constants/product/stockType.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const PUBLIC_SORT_OPTIONS = require("../../constants/shared/sort-options.constant.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const { mapSellerSummary } = require("../../utils/navigation/sellerStoreLink.util.js");
const { mapCustomerSummary } = require("../../utils/navigation/customerProfileLink.util.js");
const {
  getSellersOrderTrustStats,
  getSellerOrderTrustStats,
} = require("../../utils/navigation/sellerTrustStats.util.js");
const {
  getCustomersOrderTrustStats,
} = require("../../utils/navigation/customerTrustStats.util.js");

const RECENT_REVIEWS_LIMIT = 3;

const sellerSummaryInclude = {
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

const mapProductReviewPreview = (review, customerTrust = null, sellerTrust = null) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  imageUrl: review.imageUrl ?? null,
  sellerReply: review.sellerReply ?? null,
  sellerRepliedAt: review.sellerRepliedAt ?? null,
  createdAt: review.get("createdAt"),
  customer: mapCustomerSummary(
    review.customer,
    review.customer?.user,
    customerTrust,
  ),
  seller: mapSellerSummary(
    review.seller,
    review.seller?.user,
    sellerTrust,
  ),
});

const getProductReviewsPreview = async (productId) => {
  const rows = await Review.findAll({
    where: { productId, isDeleted: false },
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
      sellerSummaryInclude,
    ],
    order: [["created_at", "DESC"]],
    limit: RECENT_REVIEWS_LIMIT,
  });

  const [trustByCustomerId, trustBySellerId] = await Promise.all([
    getCustomersOrderTrustStats(
      rows.map((review) => review.customer?.id).filter(Boolean),
    ),
    getSellersOrderTrustStats(
      rows.map((review) => review.seller?.id).filter(Boolean),
    ),
  ]);

  return rows.map((review) =>
    mapProductReviewPreview(
      review,
      trustByCustomerId.get(review.customer?.id),
      trustBySellerId.get(review.seller?.id),
    ),
  );
};

const buildReviewsBlock = async (product) => {
  const preview = await getProductReviewsPreview(product.id);
  return {
    average: product.averageRating,
    total: product.reviewsCount,
    preview,
  };
};

const getSellerIdFromRequest = (req) => {
  const userId = req.user?.id || req.user?.userId || null;

  if (!userId) return null;

  if (req.user?.role !== USER_ROLES.SELLER) {
    throw AppError.fail(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return userId;
};

// Downloads an already-stored (Cloudinary) image so it can be re-optimized.
const fetchRemoteImage = async (url) => {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw AppError.error("Failed to load the existing product image.", 502);
  }

  if (!response.ok) {
    throw AppError.error("Failed to load the existing product image.", 502);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") || "image/jpeg",
  };
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

    const isOptimized =
      req.body.isOptimized === true || req.body.isOptimized === "true";

    const bufferToUpload = isOptimized
      ? await aiService.optimizeProductImageBuffer(
          req.file.buffer,
          req.file.mimetype,
        )
      : req.file.buffer;

    uploadedImage = await cloudinaryService.uploadImage(bufferToUpload, folder);

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
          isOptimized,
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
            isOptimized: createdImage.isOptimized,
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

  const isOptimized =
    req.body.isOptimized === true || req.body.isOptimized === "true";

  try {
    if (isOptimized) {
      const existingImage = await ProductImage.findOne({
        where: { productId: product.id },
      });
      if (!existingImage) {
        throw AppError.fail("Product has no image to optimize.", 400);
      }
      if (existingImage.isOptimized) {
        throw AppError.fail("This image is already optimized.", 400);
      }

      const original = await fetchRemoteImage(existingImage.imageUrl);
      const optimizedBuffer = await aiService.optimizeProductImageBuffer(
        original.buffer,
        original.mimeType,
      );
      uploadedImage = await cloudinaryService.uploadImage(
        optimizedBuffer,
        folder,
      );
    } else if (req.file) {
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
            isOptimized,
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
          attributes: [
            "id",
            "imageUrl",
            "isPrimary",
            "isOptimized",
            "position",
          ],
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
      sellerSummaryInclude,
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

  const trustBySellerId = await getSellersOrderTrustStats(
    rows.map((product) => product.seller?.id).filter(Boolean),
  );

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
      seller: mapSellerSummary(
        product.seller,
        null,
        trustBySellerId.get(product.seller?.id),
      ),
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
      sellerSummaryInclude,
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

  const reviews = await buildReviewsBlock(product);
  const orderTrust = await getSellerOrderTrustStats(product.seller?.id);

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
      seller: mapSellerSummary(product.seller, null, orderTrust),
      images: (product.images || []).map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        isPrimary: image.isPrimary,
        position: image.position,
      })),
      isWishlisted,
    },
    reviews,
  };
};

const getSellerProductDetails = async (req) => {
  const userId = getSellerIdFromRequest(req);
  if (!userId) {
    throw AppError.fail("Seller authentication data is missing.", 401);
  }

  const { id } = req.params;
  if (!uuidValidate(id, 4)) {
    throw AppError.fail("Invalid product ID.", 400);
  }

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);

  const product = await Product.findOne({
    where: {
      id,
      sellerId: seller.id,
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
      ["created_at", "createdAt"],
      ["updated_at", "updatedAt"],
    ],
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name"],
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

  const reviews = await buildReviewsBlock(product);

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
      createdAt: product.get("createdAt"),
      updatedAt: product.get("updatedAt"),
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
      images: (product.images || []).map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        isPrimary: image.isPrimary,
        position: image.position,
      })),
    },
    reviews,
  };
};

module.exports = {
  getSellerProducts,
  getSellerProductDetails,
  createProduct,
  updateProduct,
  toggleStatus,
  deleteProduct,
  getAllProductsPublic,
  getProductDetailsPublic,
};
