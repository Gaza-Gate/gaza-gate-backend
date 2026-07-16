const categoryService = require("../../services/catalog/category.service");
const asyncWrapper = require("../../utils/http/asyncWrapper.util");
const apiResponse = require("../../utils/http/apiResponse.util");

const getAllCategories = asyncWrapper(async (req, res) => {
    const categories = await categoryService.getAllCategories(req);
    
    return apiResponse.sendSuccess(res,{categories},200);
    
});


const createCategory = asyncWrapper(async (req, res) => {
    const category=await categoryService.createCategory(req);
    
    return apiResponse.sendSuccess(res,{category},201);
})

const updateCategory = asyncWrapper(async (req, res) => {
    const category=await categoryService.updateCategory(req);
    
    return apiResponse.sendSuccess(res,{category},200);
})

const deleteCategory = asyncWrapper(async (req, res) => {
    await categoryService.deleteCategory(req);
    
    return apiResponse.sendSuccess(res,{message:"Category deleted successfully"},200);
})

module.exports={
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
}