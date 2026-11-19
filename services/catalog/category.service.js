const { Op, fn, col } = require("sequelize");
const Category = require("../../models/category.model");
const AppError = require("../../utils/http/AppError.util");
const cloudinaryService = require("../integrations/cloudinary.service");
const PAGINATION = require("../../constants/shared/pagination.constant");
const Product = require("../../models/product.model");
const Seller = require("../../models/seller.model.js");
const User = require("../../models/user.model.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const UserStatus = require("../../constants/user/userStatus.constant.js");

const getCategories = async (req, categoryWhere, productVisibility) => {
  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";

  const where = { ...categoryWhere };
  if (where.isActive === undefined && ["true", "false"].includes(req.query.active)) {
    where.isActive = req.query.active === "true";
  }
  if (search) where.name = { [Op.like]: `%${search}%` };

  const { count, rows } = await Category.findAndCountAll({
    where,
    attributes: [
      'id',
      'name',
      'description',
      [fn('COUNT', col('products.id')), 'productCount'],  // ✅ one JOIN, not N subqueries
    ],
    include: [
      {
        model:   Product,
        as:         'products',
        attributes: [],           // don't select any product columns
        required: false,
        ...productVisibility,
      },
    ],
    group:    ['Category.id'],    // required when using COUNT with include
    order:    [['name', 'ASC']],
    limit,
    offset,
    distinct:  true,              // accurate count with GROUP BY
    subQuery:  false,             // required alongside limit + group
  });

  const totalPages = Math.ceil(count.length / limit);
  return {
    categories: rows,
    pagination: {
      totalItems: count.length,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

const getAllCategories = (req) => getCategories(req, {}, {});

const getPublicCategories = (req) => getCategories(req, { isActive: true }, {
  where: { status: PRODUCT_STATUS.ACTIVE, isDeleted: false },
  include: [{
    model: Seller, as: "seller", attributes: [], required: true,
    include: [{
      model: User, as: "user", attributes: [], required: true,
      where: { status: UserStatus.ACTIVE },
    }],
  }],
});

const getPublicCategory = async (id) => {
  const category = await Category.findOne({
    where: { id, isActive: true },
    attributes: ["id", "name", "description", "image", "isActive"],
  });
  if (!category) throw AppError.fail("Category not found.", 404);
  return category;
};

const getAllCategoriesList = async () => {
  const categories = await Category.findAll({
    where: { isActive: true },
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });

  return { categories };
};

const getCategory = async (id) => {
  const category = await Category.findByPk(id);
  if (!category) throw AppError.fail("Category not found.", 404);
  return category;
};

const createCategory = async (req) => {
  const { name, description, isActive } = req.body || {};

  const existing = await Category.findOne({
    where: { name: name?.trim() },
  });
  if (existing) throw AppError.fail("Category name already exists.", 409);

  let imageUrl = null;
  let publicId = null;

  if (req.file) {
    const uploaded = await cloudinaryService.uploadImage(
      req.file.buffer,
      "categories",
    );
    imageUrl = uploaded.url;
    publicId = uploaded.publicId;
  }

  return Category.create({
    name: name.trim(),
    description: description?.trim() || null,
    ...(imageUrl && { image: imageUrl }),
    publicId,
    isActive: isActive ?? true,
  });
};

const updateCategory = async (req) => {
  const category = await getCategory(req.params.id);
  const { name, description, isActive } = req.body || {};

  if (name && name.trim() !== category.name) {
    const existing = await Category.findOne({
      where: {
        name: name.trim(),
        id: { [Op.ne]: category.id },
      },
    });
    if (existing) throw AppError.fail("Category name already exists.", 409);
  }

  let newImageUrl = null;
  let newPublicId = null;
  let oldPublicId = null;

  if (req.file) {
    const uploaded = await cloudinaryService.uploadImage(
      req.file.buffer,
      "categories",
    );
    newImageUrl = uploaded.url;
    newPublicId = uploaded.publicId;
    oldPublicId = category.publicId ?? null;
  }

  await category.update({
    name: name?.trim() ?? category.name,
    description:
      description !== undefined
        ? description?.trim() || null
        : category.description,
    image: newImageUrl || category.image,
    publicId: newPublicId || category.publicId,
    isActive: isActive ?? category.isActive,
  });

  if (oldPublicId) {
    await cloudinaryService
      .deleteImage(oldPublicId)
      .catch((err) =>
        console.error(
          `Failed to delete old category image: ${oldPublicId}`,
          err,
        ),
      );
  }

  return category;
};

const toggleCategory = async (id) => {
  const category = await getCategory(id);
  await category.update({ isActive: !category.isActive });
  return {
    categoryId: category.id,
    isActive: category.isActive,
  };
};

const deleteCategory = async (id) => {
  const category = await getCategory(id);
  const publicId = category.publicId ?? null;

  await category.destroy();

  if (publicId) {
    await cloudinaryService
      .deleteImage(publicId)
      .catch((err) =>
        console.error(`Failed to delete category image: ${publicId}`, err),
      );
  }
};

module.exports = {
  getPublicCategories,
  getPublicCategory,
  getAllCategories,
  getAllCategoriesList,
  getCategory,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
};
