const router = require('express').Router();
const controller = require('../controllers/category.controller');
const upload = require('../middlewares/upload/productImageUpload.middleware');
const { validateCategory } = require('../middlewares/validators/category.validation');
const requestsValidator = require('../middlewares/validators/request.validator');

router.get('/', controller.getAllCategories);
router.get('/:id', controller.getCategory);

router.post('/',
  upload(1).single('image'),
  validateCategory,
  requestsValidator,
  controller.createCategory
);

router.put('/:id',
  upload(1).single('image'),
  validateCategory,
  requestsValidator,
  controller.updateCategory
);

router.patch('/:id/toggle', controller.toggleCategory);
router.delete('/:id', controller.deleteCategory);
router.delete('/', controller.deleteAllCategories);

module.exports = router;