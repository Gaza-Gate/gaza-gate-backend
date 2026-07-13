const Customer = require("../../models/customer.model.js");
const User = require("../../models/user.model.js");
const Address = require("../../models/address.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const cloudinaryService = require("../integrations/cloudinary.service.js");

const CUSTOMER_PROFILE_USER_ATTRIBUTES = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "avatar",
  "gender",
  "birthDate",
  "isVerified",
  ["created_at", "createdAt"],
];

const getCustomerProfile = async (userId) => {
  const customer = await Customer.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!customer) throw AppError.fail("Customer not found.", 404);

  const user = await User.findOne({
    where: { id: userId },
    attributes: CUSTOMER_PROFILE_USER_ATTRIBUTES,
    include: [
      {
        model: Address,
        as: "addresses",
        attributes: ["id", "neighborhood", "street", "notes"],
      },
    ],
  });

  if (!user) throw AppError.fail("Customer not found.", 404);

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    gender: user.gender,
    birthDate: user.birthDate,
    isVerified: user.isVerified,
    createdAt: user.dataValues.createdAt,
    addresses: (user.addresses || []).map((address) => ({
      id: address.id,
      neighborhood: address.neighborhood,
      street: address.street,
      notes: address.notes,
    })),
  };
};

const updateCustomerProfile = async (userId, data, file) => {
  if (!data) data = {};
  if (data.email) throw AppError.fail("Email cannot be updated", 400);

  const userFields = ["firstName", "lastName", "phone", "gender", "birthDate"];
  const userData = {};
  for (const key in data) {
    if (userFields.includes(key)) userData[key] = data[key];
  }

  const customer = await Customer.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!customer) throw AppError.fail("Customer not found.", 404);

  let uploadedImage = null;
  let oldAvatarPublicId = null;

  if (file) {
    uploadedImage = await cloudinaryService.uploadImage(
      file.buffer,
      `avatars/customer/${userId}`,
    );

    const existingUser = await User.findOne({
      where: { id: userId },
      attributes: ["publicId"],
    });
    oldAvatarPublicId = existingUser?.publicId ?? null;

    userData.avatar = uploadedImage.url;
    userData.publicId = uploadedImage.publicId;
  }

  try {
    if (Object.keys(userData).length > 0) {
      await User.update(userData, { where: { id: userId } });
    }
  } catch (error) {
    if (uploadedImage?.publicId) {
      await cloudinaryService
        .deleteImage(uploadedImage.publicId)
        .catch(() => null);
    }
    throw error;
  }

  if (file && oldAvatarPublicId) {
    cloudinaryService
      .deleteImage(oldAvatarPublicId)
      .catch((err) =>
        console.error(`Failed to delete old avatar: ${oldAvatarPublicId}`, err),
      );
  }

  const updatedUser = await User.findOne({
    where: { id: userId },
    attributes: CUSTOMER_PROFILE_USER_ATTRIBUTES,
  });

  return {
    id: updatedUser.id,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    email: updatedUser.email,
    phone: updatedUser.phone,
    avatar: updatedUser.avatar,
    gender: updatedUser.gender,
    birthDate: updatedUser.birthDate,
    isVerified: updatedUser.isVerified,
    createdAt: updatedUser.dataValues.createdAt,
  };
};

const addAddress = async (userId, data) => {
  const { neighborhood, street, notes } = data || {};

  const address = await Address.create({
    userId,
    neighborhood: neighborhood?.trim(),
    street: street?.trim(),
    notes: notes?.trim() || null,
  });

  return {
    id: address.id,
    neighborhood: address.neighborhood,
    street: address.street,
    notes: address.notes,
  };
};

const updateAddress = async (userId, addressId, data) => {
  const address = await Address.findOne({
    where: { id: addressId, userId },
  });
  if (!address) throw AppError.fail("Address not found.", 404);

  const { neighborhood, street, notes } = data || {};

  await address.update({
    neighborhood:
      neighborhood !== undefined ? neighborhood.trim() : address.neighborhood,
    street: street !== undefined ? street.trim() : address.street,
    notes: notes !== undefined ? notes.trim() || null : address.notes,
  });

  return {
    id: address.id,
    neighborhood: address.neighborhood,
    street: address.street,
    notes: address.notes,
  };
};

const deleteAddress = async (userId, addressId) => {
  const address = await Address.findOne({
    where: { id: addressId, userId },
  });
  if (!address) throw AppError.fail("Address not found.", 404);

  await address.destroy();
};

module.exports = {
  getCustomerProfile,
  updateCustomerProfile,
  addAddress,
  updateAddress,
  deleteAddress,
};
