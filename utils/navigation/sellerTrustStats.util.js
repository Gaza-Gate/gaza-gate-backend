const { Op } = require("sequelize");
const { sequelize } = require("../../config/db.config.js");
const Order = require("../../models/order.model.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");

/**
 * Batch order trust stats for sellers.
 * @param {string[]} sellerIds
 * @returns {Promise<Map<string, { completedOrders: number, completionRate: number }>>}
 */
const getSellersOrderTrustStats = async (sellerIds = []) => {
  const uniqueIds = [...new Set((sellerIds || []).filter(Boolean))];
  const statsBySellerId = new Map();

  for (const id of uniqueIds) {
    statsBySellerId.set(id, { completedOrders: 0, completionRate: 0 });
  }

  if (!uniqueIds.length) return statsBySellerId;

  const rows = await Order.findAll({
    where: {
      sellerId: { [Op.in]: uniqueIds },
      isDeleted: false,
    },
    attributes: [
      "sellerId",
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
    group: ["seller_id"],
    raw: true,
  });

  for (const row of rows) {
    const sellerId = row.sellerId;
    const totalOrders = Number(row.totalOrders) || 0;
    const completedOrders = Number(row.completedOrders) || 0;
    const completionRate =
      totalOrders === 0
        ? 0
        : Math.round((completedOrders / totalOrders) * 100);

    statsBySellerId.set(sellerId, { completedOrders, completionRate });
  }

  return statsBySellerId;
};

const getSellerOrderTrustStats = async (sellerId) => {
  if (!sellerId) return { completedOrders: 0, completionRate: 0 };
  const map = await getSellersOrderTrustStats([sellerId]);
  return map.get(sellerId) || { completedOrders: 0, completionRate: 0 };
};

module.exports = {
  getSellersOrderTrustStats,
  getSellerOrderTrustStats,
};
