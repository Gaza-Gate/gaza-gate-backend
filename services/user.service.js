const User = require("../models/user.model.js");
const bcrypt = require("bcryptjs");

const getAllUsers = async (limit, skip) => {
  const users = await User.find(
    {},
    { password: false, __v: false },
    { limit, skip },
  );
  return users;
};

const getUserById = async (userId) => {
  const user = await User.findById(userId, { password: false, __v: false });
  return user;
};

const getUserByEmail = async (userEmail) => {
  const user = await User.findOne(
    { email: userEmail },
    { password: false, __v: false },
  );
  return user;
};

const getUserByEmailWithPassword = async (userEmail) => {
  const user = await User.findOne({ email: userEmail }, { __v: false });
  return user;
};

const createUser = async (data) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  data.password = hashedPassword;

  const newUser = await User.create(data);
  return newUser;
};

const updateAllUsers = async (data) => {
  const result = await User.updateMany({}, { $set: data });
  return result;
};

const updateUser = async (userId, data) => {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: data },
    { new: true, runValidators: true },
  );
  return updatedUser;
};

const deleteAllUsers = async () => {
  const result = await User.deleteMany({});
  return result;
};

const deleteUser = async (userId) => {
  const deletedUser = await User.findByIdAndDelete(userId);
  return deletedUser;
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUserByEmailWithPassword,
  createUser,
  updateAllUsers,
  updateUser,
  deleteAllUsers,
  deleteUser,
};
