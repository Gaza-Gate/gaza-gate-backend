const { Op } = require("sequelize");
const Category = require("../models/category.model");
const AppError = require("../utils/AppError.util");
const cloudinaryService = require("./cloudinary.service");
const PAGINATION = require("../constants/pagination.constant");

const getAllCategories = async (req) => {
  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";

  const where = {};
  if (req.query.active === "true") where.isActive = true;
  if (req.query.active === "false") where.isActive = false;
  if (search) where.name = { [Op.like]: `%${search}%` };

  const { count, rows } = await Category.findAndCountAll({
    where,
    order: [["name", "ASC"]],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);
  return {
    categories: rows,
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
  getAllCategories,
  getAllCategoriesList,
  getCategory,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
};
