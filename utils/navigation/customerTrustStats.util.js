const { Op } = require("sequelize");
const { sequelize } = require("../../config/db.config.js");
const Order = require("../../models/order.model.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");

/**
 * Batch order trust stats for customers.
 * @param {string[]} customerIds
 * @returns {Promise<Map<string, { completedOrders: number, completionRate: number }>>}
 */
const getCustomersOrderTrustStats = async (customerIds = []) => {
  const uniqueIds = [...new Set((customerIds || []).filter(Boolean))];
  const statsByCustomerId = new Map();

  for (const id of uniqueIds) {
    statsByCustomerId.set(id, { completedOrders: 0, completionRate: 0 });
  }

  if (!uniqueIds.length) return statsByCustomerId;

  const rows = await Order.findAll({
    where: {
      customerId: { [Op.in]: uniqueIds },
      isDeleted: false,
    },
    attributes: [
      "customerId",
      [sequelize.fn("COUNT", sequelize.col("id")), "totalOrders"],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(
            `CASE WHEN status = '${ORDER_STATUSES.COMPLETED}' THEN 1 ELSE 0 END`,
          ),
        ),
        "completedOrders",
      ],
    ],
    group: ["customer_id"],
    raw: true,
  });

  for (const row of rows) {
    const customerId = row.customerId;
    const totalOrders = Number(row.totalOrders) || 0;
    const completedOrders = Number(row.completedOrders) || 0;
    const completionRate =
      totalOrders === 0
        ? 0
        : Math.round((completedOrders / totalOrders) * 100);

    statsByCustomerId.set(customerId, { completedOrders, completionRate });
  }

  return statsByCustomerId;
};

const getCustomerOrderTrustStats = async (customerId) => {
  if (!customerId) return { completedOrders: 0, completionRate: 0 };
  const map = await getCustomersOrderTrustStats([customerId]);
  return map.get(customerId) || { completedOrders: 0, completionRate: 0 };
};

module.exports = {
  getCustomersOrderTrustStats,
  getCustomerOrderTrustStats,
};
