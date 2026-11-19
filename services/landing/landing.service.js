const { fn, col } = require("sequelize");
const Order = require("../../models/order.model.js");
const Product = require("../../models/product.model.js");
const Seller = require("../../models/seller.model.js");
const USER_STATUS = require("../../constants/user/userStatus.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const ORDER_STATUS = require("../../constants/order/orderStatuses.constant.js");
const User = require("../../models/user.model.js");

const getLandingState = async () => {
    const [productsCount, sellersCount, ordersCount] =
        await Promise.all([
            Product.count({
                where: {
                    isDeleted: false,
                    status: PRODUCT_STATUS.ACTIVE,
                },
            }),
            Seller.count({
                include: [
                    {
                        model: User,
                        as: "user",
                        where: { status: USER_STATUS.ACTIVE },
                    },
                ],
            }),
            Order.count({
                where: {
                    isDeleted: false,
                    status: ORDER_STATUS.COMPLETED,
                },
            }),
        ]);
    return {
        productsCount,
        sellersCount,
        ordersCount,
    };
};

module.exports = { getLandingState }