const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const Seller = require("../../models/seller.model.js");
const User = require("../../models/user.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const UserStatus = require("../../constants/user/userStatus.constant.js");
const {
  buildProductShareUrl,
  buildStoreShareUrl,
} = require("../../utils/navigation/shareLink.util.js");

const SITE_NAME = "Gaza Gate";
const DESCRIPTION_MAX_LENGTH = 160;

const flattenDescription = (value) => {
  if (value == null) return "";
  const flattened = String(value).replace(/\s+/g, " ").trim();
  if (!flattened) return "";
  if (flattened.length <= DESCRIPTION_MAX_LENGTH) return flattened;
  return `${flattened.slice(0, DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`;
};

const fallbackImage = () => process.env.SITE_IDENTITY_IMAGE_URL || null;

const activeSellerUserInclude = (attributes) => ({
  model: User,
  as: "user",
  attributes,
  where: { status: UserStatus.ACTIVE },
  required: true,
});

const getProductMeta = async (productId) => {
  const product = await Product.findOne({
    where: {
      id: productId,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: false,
    },
    attributes: ["id", "name", "description"],
    include: [
      {
        model: Seller,
        as: "seller",
        attributes: ["id"],
        required: true,
        include: [activeSellerUserInclude(["id"])],
      },
      {
        model: ProductImage,
        as: "images",
        attributes: ["imageUrl"],
        where: { isPrimary: true },
        required: false,
      },
    ],
  });

  if (!product) {
    throw AppError.fail("Product not found.", 404);
  }

  const description =
    flattenDescription(product.description) ||
    flattenDescription(`Shop ${product.name} on ${SITE_NAME}.`);

  return {
    title: product.name,
    description,
    image: product.images?.[0]?.imageUrl || fallbackImage(),
    url: buildProductShareUrl(product.id),
    type: "product",
    siteName: SITE_NAME,
  };
};


module.exports = {
  getProductMeta,
};
