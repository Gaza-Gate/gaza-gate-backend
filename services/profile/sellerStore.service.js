const { Op } = require('sequelize');
const Seller = require('../../models/seller.model');
const Customer = require('../../models/customer.model');
const User = require('../../models/user.model');
const Product = require('../../models/product.model');
const ProductImage = require('../../models/productImage.model');
const Review = require('../../models/review.model');
const Category = require('../../models/category.model');
const AppError = require('../../utils/http/AppError.util');
const PAGINATION = require('../../constants/shared/pagination.constant');
const PRODUCT_STOCK_TYPES = require('../../constants/product/stockType.constant');
const PRODUCT_STATUS = require('../../constants/product/productStatus.constant');

const PREVIEW_LIMIT = 4;

const PRODUCT_SORT = Object.freeze({
  newest: [['created_at', 'DESC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  rating: [['average_rating', 'DESC']],
});

const primaryImageInclude = {
  model: ProductImage,
  as: 'images',
  attributes: ['imageUrl'],
  where: { isPrimary: true },
  required: false,
  separate: true,
};

const categoryInclude = {
  model: Category,
  as: 'category',
  attributes: ['id', 'name'],
};

const activeProductWhere = (sellerId) => ({
  sellerId,
  status: PRODUCT_STATUS.ACTIVE,
  isDeleted: false,
});

const getPrimaryImageUrl = (product) =>
  product.images?.[0]?.imageUrl ?? null;

const mapStoreProduct = (product) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  image: getPrimaryImageUrl(product),
  quantity:
    product.stockType === PRODUCT_STOCK_TYPES.LIMITED ? product.quantity : null,
  stockType: product.stockType,
  category: product.category?.name ?? null,
});

const mapPreviewProduct = (product) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  image: getPrimaryImageUrl(product),
  category: product.category
    ? { id: product.category.id, name: product.category.name }
    : null,
});

const mapReview = (review) => {
  const user = review.customer?.user;
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    imageUrl: review.imageUrl ?? null,
    sellerReply: review.sellerReply ?? null,
    sellerRepliedAt: review.sellerRepliedAt ?? null,
    createdAt: review.get('createdAt'),
    customer: user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
        }
      : null,
  };
};

const getPublicStore = async (sellerId) => {
  const seller = await Seller.findOne({
    where: { id: sellerId },
    attributes: [
      'id',
      'storeName',
      'storeDescription',
      'rating',
      'ratingCount',
    ],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['avatar'],
      },
    ],
  });

  if (!seller) throw AppError.fail('Store not found.', 404);

  const reviewsLimit = PAGINATION.DEFAULT_LIMIT;
  const productWhere = activeProductWhere(seller.id);

  const [
    activeProductsCount,
    positiveReviewsCount,
    previewProducts,
    { count: reviewsTotal, rows: reviews },
  ] = await Promise.all([
    Product.count({ where: productWhere }),

    Review.count({
      where: { sellerId: seller.id, rating: { [Op.gte]: 4 } },
    }),

    Product.findAll({
      where: productWhere,
      attributes: ['id', 'name', 'price'],
      include: [primaryImageInclude, categoryInclude],
      order: [['created_at', 'DESC']],
      limit: PREVIEW_LIMIT,
    }),

    Review.findAndCountAll({
      where: { sellerId: seller.id },
      attributes: [
        'id',
        'rating',
        'comment',
        'imageUrl',
        'sellerReply',
        'sellerRepliedAt',
        ['created_at', 'createdAt'],
      ],
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: reviewsLimit,
      distinct: true,
    }),
  ]);

  return {
    store: {
      id: seller.id,
      storeName: seller.storeName,
      storeDescription: seller.storeDescription,
      rating: seller.rating,
      ratingCount: seller.ratingCount,
      user: {
        avatar: seller.user?.avatar ?? null,
      },
    },
    stats: {
      positiveReviews: positiveReviewsCount,
      activeProducts: activeProductsCount,
    },
    products: {
      total: activeProductsCount,
      preview: previewProducts.map(mapPreviewProduct),
    },
    reviews: {
      average:      seller.rating,
      total:        seller.ratingCount,
      list:         reviews,
      hasMore:      reviewsTotal > reviewsLimit
    },
  };
};

const getStoreProducts = async (sellerId, query) => {
  const seller = await Seller.findOne({
    where: { id: sellerId },
    attributes: ['id', 'storeName'],
  });
  if (!seller) throw AppError.fail('Store not found.', 404);

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const order = PRODUCT_SORT[query.sort] ?? PRODUCT_SORT.newest;

  const { count, rows } = await Product.findAndCountAll({
    where: activeProductWhere(seller.id),
    attributes: ['id', 'name', 'price', 'quantity', 'stockType'],
    include: [primaryImageInclude, categoryInclude],
    order,
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);

  return {
    storeName: seller.storeName,
    products: rows.map(mapStoreProduct),
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: count,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

module.exports = { getPublicStore, getStoreProducts };
