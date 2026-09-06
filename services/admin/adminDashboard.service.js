const { Op, fn, col, literal } = require("sequelize");

const Order = require("../../models/order.model.js");
const Product = require("../../models/product.model.js");
const User = require("../../models/user.model.js");
const Role = require("../../models/role.model.js");
const Customer = require("../../models/customer.model.js");

const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const { STATUS_LABELS } = require("../../constants/order/orderStatusTransitions.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const USER_STATUS = require("../../constants/user/userStatus.constant.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const {
  mapCustomerSummary,
} = require("../../utils/navigation/customerProfileLink.util.js");

const REVENUE_STATUSES = [ORDER_STATUSES.COMPLETED];
const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const roundPercent = (value) => Math.round(value * 10) / 10;

const calcChangePercent = (current, previous) => {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return roundPercent(((current - previous) / previous) * 100);
};

const startOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

const addMonths = (date, months) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1, 0, 0, 0, 0);

const formatMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthLabel = (date) => ARABIC_MONTHS[date.getMonth()];

const buildMonthSeries = (monthsCount, valueMap) => {
  const now = new Date();
  const series = [];

  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const monthDate = addMonths(startOfMonth(now), -i);
    const key = formatMonthKey(monthDate);
    series.push({
      month: key,
      label: monthLabel(monthDate),
      value: toNumber(valueMap.get(key) || 0),
    });
  }

  return series;
};

const sumOrderTotal = async (where) => {
  const result = await Order.findOne({
    attributes: [[fn("COALESCE", fn("SUM", col("total_price")), 0), "total"]],
    where,
    raw: true,
  });
  return toNumber(result?.total);
};

const countOrders = async (where) => Order.count({ where });

const getMonthlyAggregates = async ({ monthsCount, metric }) => {
  const now = new Date();
  const from = addMonths(startOfMonth(now), -(monthsCount - 1));

  const valueExpression =
    metric === "revenue"
      ? fn("COALESCE", fn("SUM", col("total_price")), 0)
      : fn("COUNT", col("id"));

  const where = {
    isDeleted: false,
    created_at: { [Op.gte]: from },
  };

  if (metric === "revenue") {
    where.status = { [Op.in]: REVENUE_STATUSES };
  }

  const rows = await Order.findAll({
    attributes: [
      [fn("DATE_FORMAT", col("created_at"), "%Y-%m"), "month"],
      [valueExpression, "value"],
    ],
    where,
    group: [literal("DATE_FORMAT(`created_at`, '%Y-%m')")],
    order: [[literal("DATE_FORMAT(`created_at`, '%Y-%m')"), "ASC"]],
    raw: true,
  });

  const valueMap = new Map(
    rows.map((row) => [row.month, toNumber(row.value)]),
  );

  return buildMonthSeries(monthsCount, valueMap);
};

const getPeriodBounds = () => {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const previousStart = addMonths(currentStart, -1);
  const nextStart = addMonths(currentStart, 1);

  return { currentStart, previousStart, nextStart };
};

const getAdminDashboard = async (req) => {
  const monthsCount = Math.min(
    Math.max(Number(req.query?.months) || 7, 1),
    24,
  );
  const recentLimit = Math.min(
    Math.max(Number(req.query?.recentLimit) || 5, 1),
    20,
  );

  const { currentStart, previousStart, nextStart } = getPeriodBounds();

  const baseOrderWhere = { isDeleted: false };
  const revenueWhere = {
    ...baseOrderWhere,
    status: { [Op.in]: REVENUE_STATUSES },
  };

  const currentOrdersWhere = {
    ...baseOrderWhere,
    created_at: { [Op.gte]: currentStart, [Op.lt]: nextStart },
  };
  const previousOrdersWhere = {
    ...baseOrderWhere,
    created_at: { [Op.gte]: previousStart, [Op.lt]: currentStart },
  };

  const currentRevenueWhere = {
    ...revenueWhere,
    created_at: { [Op.gte]: currentStart, [Op.lt]: nextStart },
  };
  const previousRevenueWhere = {
    ...revenueWhere,
    created_at: { [Op.gte]: previousStart, [Op.lt]: currentStart },
  };

  const currentUsersWhere = {
    status: USER_STATUS.ACTIVE,
    created_at: { [Op.gte]: currentStart, [Op.lt]: nextStart },
  };
  const previousUsersWhere = {
    status: USER_STATUS.ACTIVE,
    created_at: { [Op.gte]: previousStart, [Op.lt]: currentStart },
  };

  const currentProductsWhere = {
    isDeleted: false,
    status: PRODUCT_STATUS.ACTIVE,
    created_at: { [Op.gte]: currentStart, [Op.lt]: nextStart },
  };
  const previousProductsWhere = {
    isDeleted: false,
    status: PRODUCT_STATUS.ACTIVE,
    created_at: { [Op.gte]: previousStart, [Op.lt]: currentStart },
  };

  const nonAdminRoleInclude = {
    model: Role,
    as: "role",
    attributes: [],
    required: true,
    where: { name: { [Op.ne]: USER_ROLES.ADMIN } },
  };

  const [
    totalOrders,
    currentOrders,
    previousOrders,
    totalRevenue,
    currentRevenue,
    previousRevenue,
    activeUsers,
    totalUsers,
    currentActiveUsers,
    previousActiveUsers,
    availableProducts,
    currentProducts,
    previousProducts,
    monthlyRevenue,
    monthlyOrders,
    recentOrdersRows,
  ] = await Promise.all([
    countOrders(baseOrderWhere),
    countOrders(currentOrdersWhere),
    countOrders(previousOrdersWhere),
    sumOrderTotal(revenueWhere),
    sumOrderTotal(currentRevenueWhere),
    sumOrderTotal(previousRevenueWhere),
    User.count({
      include: [nonAdminRoleInclude],
      where: { status: USER_STATUS.ACTIVE },
      distinct: true,
      col: "id",
    }),
    User.count({
      include: [nonAdminRoleInclude],
      distinct: true,
      col: "id",
    }),
    User.count({
      include: [nonAdminRoleInclude],
      where: currentUsersWhere,
      distinct: true,
      col: "id",
    }),
    User.count({
      include: [nonAdminRoleInclude],
      where: previousUsersWhere,
      distinct: true,
      col: "id",
    }),
    Product.count({
      where: { isDeleted: false, status: PRODUCT_STATUS.ACTIVE },
    }),
    Product.count({ where: currentProductsWhere }),
    Product.count({ where: previousProductsWhere }),
    getMonthlyAggregates({ monthsCount, metric: "revenue" }),
    getMonthlyAggregates({ monthsCount, metric: "orders" }),
    Order.findAll({
      where: baseOrderWhere,
      attributes: [
        "id",
        "orderNumber",
        "status",
        "totalPrice",
        ["created_at", "createdAt"],
      ],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["firstName", "lastName", "avatar"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: recentLimit,
    }),
  ]);

  const recentOrders = recentOrdersRows.map((order) => {
    const customer = mapCustomerSummary(order.customer, order.customer?.user);
    const customerName = customer
      ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
      : "";

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customer,
      total: toNumber(order.totalPrice),
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      createdAt: order.get?.("createdAt") ?? order.createdAt ?? null,
    };
  });

  return {
    stats: {
      totalOrders: {
        value: totalOrders,
        changePercent: calcChangePercent(currentOrders, previousOrders),
      },
      totalRevenue: {
        value: totalRevenue,
        currency: "ILS",
        changePercent: calcChangePercent(currentRevenue, previousRevenue),
      },
      activeUsers: {
        active: activeUsers,
        total: totalUsers,
        changePercent: calcChangePercent(
          currentActiveUsers,
          previousActiveUsers,
        ),
      },
      availableProducts: {
        value: availableProducts,
        changePercent: calcChangePercent(currentProducts, previousProducts),
      },
    },
    charts: {
      monthlyRevenue,
      monthlyOrders,
    },
    recentOrders,
    meta: {
      months: monthsCount,
      recentLimit,
      revenueStatuses: REVENUE_STATUSES,
      period: "month",
    },
  };
};

module.exports = {
  getAdminDashboard,
};
