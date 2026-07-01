const userServices = require("../services/user.service.js");
const PAGINATION = require("../constants/pagination.js");
const tokens = require("../utils/tokens.js");

const getAllUsers = async (req, res) => {
  const page = Number(req.query.page) || PAGINATION.DEFAULT_PAGE || 1;
  const limit = PAGINATION.DEFAULT_LIMIT || 10;
  const skip = (page - 1) * limit;
  
  const users = await userServices.getAllUsers(limit, skip);
  
  apiResponse.sendSuccess(
    res,
    data: { users }
  );
};

const getUser = async (req, res) => {
  const userId = req.params.userId;
  const user = await userServices.getUserById(userId);
  
  if(!user){
    apiResponse.sendFail(
      res,
      data: { user: "User not found!" },
      404
    );
  }
  
  apiResponse.sendSuccess(
    res,
    data: { user }
  );
};

const createUser = async (req, res) => {
  const oldUser = await userServices.getUserByEmail(req.body.email);
  
  if(oldUser){
    apiResponse.sendFail(
      res,
      data: { user: "User already exists!" }
    );
  }
  
  const newUser = await userServices.createUser(req.body);
  
  apiResponse.sendSuccess(
    res,
    data: { user: newUser },
    201
  );
};

const updateAllUsers = async (req, res) => {
  const result = await userServices.updateAllUsers(req.body);
  
  
  apiResponse.sendSuccess(
    res,
    data{
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  );
};

const updateUser = async (req, res) => {
  const userId = req.params.userId;
  const updatedUser = await userServices.updateUser(userId, req.body);
  
  if(!updatedUser){
    apiResponse.sendFail(
      res,
      data: { user: "User not found!" },
      404
    );
  }
  
  apiResponse.sendSuccess(
    res,
    data: { user: updatedUser },
  );
};

const deleteAllUsers = async (req, res) => {
  const result = await userServices.deleteAllUsers();
  
  apiResponse.sendSuccess(
    res,
    data: { deletedCount: result.deletedCount },
  );
};

const deleteUser = async (req, res) => {
  const userId = req.params.userId;
  const deletedUser = await userServices.deleteUser(userId);
  
  if(!deletedUser){
    apiResponse.sendFail(
      res,
      data: { user: "User not found!" },
      404
    );
  }
  
  apiResponse.sendSuccess(
    res,
    data: { user: deletedUser }
  );
};

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateAllUsers,
  updateUser,
  deleteAllUsers,
  deleteUser
};