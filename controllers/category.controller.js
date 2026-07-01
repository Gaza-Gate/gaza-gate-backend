const asyncWrapper = require("../utils/asyncWrapper.util.js");
const apiResponse = require("../utils/apiResponse.util.js");
const categoryService = require("../services/category.service.js");

const getAllCategories = asyncWrapper(async (req, res) => {
  const result = await categoryService.getAllCategories(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const getAllCategoriesList = asyncWrapper(async (req, res) => {
  const result = await categoryService.getAllCategoriesList();
  return apiResponse.sendSuccess(res, result, 200);
});

const getCategory = asyncWrapper(async (req, res) => {
  const category = await categoryService.getCategory(req.params.id);
  return apiResponse.sendSuccess(res, { category }, 200);
});

const createCategory = asyncWrapper(async (req, res) => {
  const category = await categoryService.createCategory(req);
  return apiResponse.sendSuccess(res, { category }, 201);
});

const updateCategory = asyncWrapper(async (req, res) => {
  const category = await categoryService.updateCategory(req);
  return apiResponse.sendSuccess(res, { category }, 200);
});

const toggleCategory = asyncWrapper(async (req, res) => {
  const result = await categoryService.toggleCategory(req.params.id);
  return apiResponse.sendSuccess(res, result, 200);
});

const deleteCategory = asyncWrapper(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  return apiResponse.sendSuccess(res, null, 200);
});

module.exports = {
  getAllCategories,
  getAllCategoriesList,
  getCategory,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
};
