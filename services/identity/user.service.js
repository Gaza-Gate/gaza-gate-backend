const { Op, fn, col } = require("sequelize");
const User = require("../../models/user.model.js");
const bcrypt = require("bcryptjs");
const Role = require("../../models/role.model.js");
const Customer = require("../../models/customer.model.js");
const Seller = require("../../models/seller.model.js");
const PAGINATION = require("../../constants/shared/pagination.constant");
const Order = require("../../models/order.model.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

const getAllUsers = async (req) => {
  const { search, role, status } = req.query ?? {};
  const page = Math.max(Number(req.query?.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = {};

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    where[Op.or] = [
      { firstName: { [Op.like]: term } },
      { lastName: { [Op.like]: term } },
      { email: { [Op.like]: term } },
    ];
  }

  if (status) {
    where.status = status;
  }

  // User → Role is belongsTo (active_role_id), NOT many-to-many.
  const roleInclude = {
    model: Role,
    as: "role",
    attributes: ["id", "name"],
    required: Boolean(role),
    ...(role ? { where: { name: role } } : {}),
  };

  const [{ count, rows }, totalActive] = await Promise.all([
    User.findAndCountAll({
      where,
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "avatar",
        "status",
        "created_at",
      ],
      include: [
        roleInclude,
        {
          model: Customer,
          as: "customer",
          attributes: ["id"],
          required: false,
        },
        {
          model:Seller,
          as: "seller",
          attributes: ["id"],
          required: false,
        }
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),
    User.count({ where: { status: "active" } }),
  ]);

  // Orders use customer_id → count per customer, then map back to users.
  const customerIds = rows
    .map((user) => user.customer?.id)
    .filter(Boolean);

  const orderCountByCustomerId = new Map();

  if (customerIds.length > 0) {
    const orderCounts = await Order.findAll({
      attributes: ["customerId", [fn("COUNT", col("id")), "orderCount"]],
      where: { customerId: { [Op.in]: customerIds } },
      group: ["customerId"],
      raw: true,
    });

    for (const row of orderCounts) {
      orderCountByCustomerId.set(row.customerId, Number(row.orderCount) || 0);
    }
  }

  const users = rows.map((user) => {
    const plain = user.toJSON();
    const roleName = plain.role?.name ?? null;
    const customerId = plain.customer?.id || null;
    const sellerId = plain.seller?.id || null;

    return {
      id: plain.id,
      firstName: plain.firstName,
      lastName: plain.lastName,
      fullName: `${plain.firstName} ${plain.lastName}`,
      email: plain.email,
      avatar: plain.avatar,
      role: roleName,
      ...(roleName === USER_ROLES.CUSTOMER && { customerId }),
      ...(roleName === USER_ROLES.SELLER && { sellerId }),
      ordersCount: customerId
        ? orderCountByCustomerId.get(customerId) || 0
        : 0,
      status: plain.status,
      joinedAt: plain.created_at
        ? new Date(plain.created_at).toISOString().split("T")[0]
        : null,
    };
  });

  const totalPages = Math.ceil(count / limit);

  return {
    summary: {
      total: count,
      active: totalActive,
    },
    users,
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

const updateUserStatus = async (adminId, userId, status) => {
  if (adminId === userId) {
    throw AppError.fail("You cannot change your own status", 400);
  }
 
  const user = await User.findOne({
    where:      { id: userId },
    attributes: ['id', 'status', 'firstName', 'lastName'],
  });
  if (!user) throw AppError.fail('User not found', 404);
 
  if (user.status === status) {
    throw AppError.fail(
     'User already has this status',
      400
    );
  }
 
  await user.update({ status });
 
  return {
    userId,
    fullName:  `${user.firstName} ${user.lastName}`,
    newStatus: status,
    message:   status === 'active'
      ? 'تم تفعيل الحساب بنجاح'
      : 'تم تعليق الحساب بنجاح',
  };
};

const deleteUser = async (userId) => {
  const deletedUser = await User.findByIdAndDelete(userId);
  return deletedUser;
};

module.exports = {
  getAllUsers,
  updateUserStatus,

};
