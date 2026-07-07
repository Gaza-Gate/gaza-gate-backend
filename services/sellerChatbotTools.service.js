const profileService = require("./profile.service.js");
const dashboardService = require("./dashboard.service.js");
const productService = require("./product.service.js");
const orderService = require("./order.service.js");
const categoryService = require("./category.service.js");
const Category = require("../models/category.model.js");
const imageTokenService = require("./sellerChatbotImageToken.service.js");
const { SELLER_CHATBOT_TOOLS } = require("../constants/sellerChatbot.constant.js");
const ORDER_STATUSES = require("../constants/orderStatuses.constant.js");
const AppError = require("../utils/AppError.util.js");

const buildSellerReq = (
  userId,
  { body = {}, params = {}, query = {}, file = null } = {},
) => ({
  user: { id: userId },
  body,
  params,
  query,
  ...(file && { file }),
});

const sanitizeError = (error) => ({
  success: false,
  message: error.message || "An error occurred while executing the action.",
});

const runTool = async (userId, executor) => {
  try {
    const data = await executor();
    return { success: true, data };
  } catch (error) {
    return sanitizeError(error);
  }
};

const buildActionSummary = (toolName, result) => {
  if (!result.success) {
    return `${toolName} failed: ${result.message}`;
  }

  const data = result.data;
  switch (toolName) {
    case SELLER_CHATBOT_TOOLS.ADVANCE_ORDER_STATUS:
      return `Order ${data.orderId} → ${data.updatedStatusLabel || data.updatedStatus}`;
    case SELLER_CHATBOT_TOOLS.REJECT_ORDER:
      return `Order ${data.orderId} rejected`;
    case SELLER_CHATBOT_TOOLS.UPDATE_PROFILE:
      return "Profile updated";
    case SELLER_CHATBOT_TOOLS.UPDATE_PRODUCT:
      return `Product ${data.id || data.name} updated`;
    case SELLER_CHATBOT_TOOLS.TOGGLE_PRODUCT_STATUS:
      return `Product ${data.productId} → ${data.status}`;
    case SELLER_CHATBOT_TOOLS.CREATE_PRODUCT:
      return `Product "${data.name}" created`;
    default:
      return toolName;
  }
};

const resolveCategoryId = async (categoryId, categoryName) => {
  if (categoryId) return categoryId;
  if (!categoryName?.trim()) {
    throw AppError.fail("Category is required (use categoryName or categoryId).", 400);
  }

  const category = await Category.findOne({
    where: { isActive: true, name: categoryName.trim() },
    attributes: ["id", "name"],
  });

  if (!category) {
    throw AppError.fail(
      `Category "${categoryName.trim()}" not found. Use listCategories to see available categories.`,
      400,
    );
  }

  return category.id;
};

const executors = {
  [SELLER_CHATBOT_TOOLS.GET_PROFILE]: (userId) =>
    runTool(userId, () => profileService.getSellerProfile(userId)),

  [SELLER_CHATBOT_TOOLS.UPDATE_PROFILE]: (userId, args) =>
    runTool(userId, async () => {
      await profileService.updateSellerProfile(userId, args, null);
      return profileService.getSellerProfile(userId);
    }),

  [SELLER_CHATBOT_TOOLS.GET_DASHBOARD]: (userId) =>
    runTool(userId, () => dashboardService.getDashboard(userId)),

  [SELLER_CHATBOT_TOOLS.LIST_PRODUCTS]: (userId, args) =>
    runTool(userId, () =>
      productService.getSellerProducts(
        buildSellerReq(userId, { query: { search: args.search, page: args.page } }),
      ),
    ),

  [SELLER_CHATBOT_TOOLS.UPDATE_PRODUCT]: (userId, args) => {
    const { productId, ...fields } = args;
    return runTool(userId, () =>
      productService.updateProduct(
        buildSellerReq(userId, { params: { id: productId }, body: fields }),
      ),
    );
  },

  [SELLER_CHATBOT_TOOLS.TOGGLE_PRODUCT_STATUS]: (userId, args) =>
    runTool(userId, () =>
      productService.toggleStatus(
        buildSellerReq(userId, { params: { id: args.productId } }),
      ),
    ),

  [SELLER_CHATBOT_TOOLS.LIST_CATEGORIES]: () =>
    runTool(null, () => categoryService.getAllCategoriesList()),

  [SELLER_CHATBOT_TOOLS.CREATE_PRODUCT]: (userId, args, context = {}) => {
    const { imageToken, categoryName, categoryId, ...fields } = args;
    return runTool(userId, async () => {
      const resolvedCategoryId = await resolveCategoryId(categoryId, categoryName);

      let imageEntry;
      if (imageToken) {
        imageEntry = imageTokenService.consumeImageToken(userId, imageToken);
      } else if (context.sessionId) {
        imageEntry = imageTokenService.consumeSessionImage(
          userId,
          context.sessionId,
        );
      } else {
        throw AppError.fail(
          "No product image found. Attach an image in this chat first.",
          400,
        );
      }

      return productService.createProduct(
        buildSellerReq(userId, {
          body: { ...fields, categoryId: resolvedCategoryId },
          file: {
            buffer: imageEntry.buffer,
            mimetype: imageEntry.mimeType,
          },
        }),
      );
    });
  },

  [SELLER_CHATBOT_TOOLS.LIST_ORDERS]: (userId, args) =>
    runTool(userId, () =>
      orderService.getSellerOrders(
        buildSellerReq(userId, { query: { status: args.status, page: args.page } }),
      ),
    ),

  [SELLER_CHATBOT_TOOLS.GET_ORDER_DETAILS]: (userId, args) =>
    runTool(userId, () =>
      orderService.getOrderDetails(
        buildSellerReq(userId, { params: { id: args.orderId } }),
      ),
    ),

  [SELLER_CHATBOT_TOOLS.ADVANCE_ORDER_STATUS]: (userId, args) =>
    runTool(userId, () =>
      orderService.updateOrderStatus(
        buildSellerReq(userId, { params: { id: args.orderId } }),
      ),
    ),

  [SELLER_CHATBOT_TOOLS.REJECT_ORDER]: (userId, args) =>
    runTool(userId, () =>
      orderService.rejectOrder(
        buildSellerReq(userId, {
          params: { id: args.orderId },
          body: { rejectionReason: args.rejectionReason },
        }),
      ),
    ),

  // Future plug-in: replace with real messaging service calls.
  [SELLER_CHATBOT_TOOLS.LIST_CONVERSATIONS]: () =>
    Promise.resolve({
      success: false,
      error: "messaging_not_integrated",
      message:
        "Customer messaging is not yet integrated with the chatbot. Use the dashboard messaging section when available.",
    }),

  [SELLER_CHATBOT_TOOLS.REPLY_TO_CUSTOMER]: () =>
    Promise.resolve({
      success: false,
      error: "messaging_not_integrated",
      message:
        "Replying to customers via chatbot is not yet available. Use the dashboard messaging section when available.",
    }),
};

const getToolDefinitions = () => [
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.GET_PROFILE,
      description: "Get the seller's store and account profile information.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.UPDATE_PROFILE,
      description:
        "Update seller profile text fields. Cannot change email or password.",
      parameters: {
        type: "object",
        properties: {
          storeName: { type: "string" },
          storeDescription: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string" },
          neighborhood: { type: "string" },
          street: { type: "string" },
          notes: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.GET_DASHBOARD,
      description: "Get seller dashboard stats, ratings, and recent orders.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.LIST_PRODUCTS,
      description: "List the seller's products with optional search.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by product name" },
          page: { type: "integer", description: "Page number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.UPDATE_PRODUCT,
      description: "Update product metadata (no image changes).",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "Product UUID" },
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          categoryId: { type: "string" },
          stockType: { type: "string", enum: ["limited", "unlimited"] },
          quantity: { type: "integer" },
          status: { type: "string", enum: ["active", "hidden"] },
        },
        required: ["productId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.TOGGLE_PRODUCT_STATUS,
      description: "Toggle product between active and hidden.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "Product UUID" },
        },
        required: ["productId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.LIST_CATEGORIES,
      description: "List active product categories for product creation.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.CREATE_PRODUCT,
      description:
        "Create a new product. Use the session image automatically — imageToken is NOT needed when seller uploaded an image in this chat. Prefer categoryName over categoryId.",
      parameters: {
        type: "object",
        properties: {
          imageToken: {
            type: "string",
            description: "Optional. Only if image was uploaded outside this chat session.",
          },
          name: { type: "string" },
          price: { type: "number" },
          categoryName: {
            type: "string",
            description: "Category name e.g. Electronics (preferred)",
          },
          categoryId: { type: "string", description: "Category UUID (optional)" },
          stockType: { type: "string", enum: ["limited", "unlimited"] },
          quantity: { type: "integer" },
          description: { type: "string" },
          status: { type: "string", enum: ["active", "hidden"] },
        },
        required: ["name", "price", "stockType"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.LIST_ORDERS,
      description: "List seller orders with optional status filter.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: Object.values(ORDER_STATUSES),
            description: "Filter by order status",
          },
          page: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.GET_ORDER_DETAILS,
      description: "Get full details for a specific order.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order UUID" },
        },
        required: ["orderId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.ADVANCE_ORDER_STATUS,
      description:
        "Advance order to the next status in the workflow (accept, start production, mark ready, complete).",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order UUID" },
        },
        required: ["orderId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.REJECT_ORDER,
      description:
        "Reject a pending order. Only works when status is pending_review. Requires rejection reason.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Order UUID" },
          rejectionReason: { type: "string", description: "Reason for rejection" },
        },
        required: ["orderId", "rejectionReason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.LIST_CONVERSATIONS,
      description: "List customer conversations (messaging).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: SELLER_CHATBOT_TOOLS.REPLY_TO_CUSTOMER,
      description: "Send a reply message to a customer in a conversation.",
      parameters: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          content: { type: "string" },
        },
        required: ["conversationId", "content"],
        additionalProperties: false,
      },
    },
  },
];

const executeTool = async (userId, toolName, args, context = {}) => {
  const executor = executors[toolName];
  if (!executor) {
    return { success: false, message: `Unknown tool: ${toolName}` };
  }
  return executor(userId, args || {}, context);
};

module.exports = {
  getToolDefinitions,
  executeTool,
  buildActionSummary,
};
