const Category = require("../../../models/category.model.js");
const productService = require("../../catalog/product.service.js");
const categoryService = require("../../catalog/category.service.js");

const getHomePage = async (req) => {
  const categoriesList = await categoryService.getAllCategoriesList();

  const productsObj = await productService.getAllProductsPublic(req);

  return {
    categoriesList,
    products: productsObj.products,
    pagination: productsObj.pagination,
  };
};

module.exports = { getHomePage };
