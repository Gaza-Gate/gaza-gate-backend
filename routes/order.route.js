const router = require('express').Router();
const controller = require('../controllers/order.controller');

router.get('/', controller.getSellerOrders);
router.get('/:id', controller.getOrderDetails);
router.patch('/:id/status', controller.updateOrderStatus);

module.exports = router;