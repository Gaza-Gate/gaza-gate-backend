const AI = require("../../constants/chatbot/ai.constant.js");
const aiClient = require("./aiClient.service.js");
const Seller = require("../../models/seller.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const cloudinaryService = require("../integrations/cloudinary.service.js");

const bufferToDataUrl = (buffer, mimeType) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const buildPrompt = (customPrompt) => {
  const base = [
    "You are a professional e-commerce product photo editor.",
    "The FIRST image is a product photo. The SECOND image is the store's visual identity (brand logo, colors, and style).",
    "Produce a single high-quality, e-commerce-ready image of the SAME product:",
    "- keep the product shape, details, and proportions accurate (do not invent or distort the product),",
    "- tastefully apply the brand's colors, style, and (subtly) the logo from the identity image and don't add any color not in the identity image,",
    "- clean up and improve the background so it looks professional,",
    "- enhance lighting, sharpness, and overall image quality.",
    "Output only the final edited image.",
  ].join(" ");

  const trimmed = customPrompt?.trim();
  return trimmed
    ? `${base}\n\nAdditional instructions from the seller: ${trimmed}`
    : base;
};

const extractGeneratedImageUrl = (completion) => {
  const message = completion?.choices?.[0]?.message;
  if (!message) return null;

  const fromImages = message.images?.[0]?.image_url?.url;
  if (fromImages) return fromImages;

  if (Array.isArray(message.content)) {
    const imagePart = message.content.find(
      (part) =>
        part?.type === "image_url" &&
        typeof part.image_url?.url === "string",
    );
    if (imagePart?.image_url?.url) return imagePart.image_url.url;
  }

  if (
    typeof message.content === "string" &&
    message.content.startsWith("data:")
  ) {
    return message.content;
  }

  return null;
};

const mapImageError = (error) => {
  const status = error?.status;

  if (status === 401 || status === 403) {
    throw AppError.fail(
      "AI image service authentication failed. Check AI_API_KEY and AI_BASE_URL.",
      502,
    );
  }

  if (status === 402) {
    console.log(error);
    throw AppError.fail(
      "The AI image service has insufficient credits. Please top up your AI account.",
      402,
    );
  }

  if (status === 404) {
    throw AppError.fail(
      "AI image model not found. Check AI_IMAGE_MODEL in server config.",
      502,
    );
  }

  if (status === 429) {
    throw AppError.fail(
      "AI image service rate limit reached. Please try again shortly.",
      429,
    );
  }

  throw AppError.error("AI image generation failed. Please try again.", 502);
};

// Core call: takes a product image + identity image and returns the edited image as a Buffer.
const runImageEdit = async ({
  productBuffer,
  productMimeType,
  identityBuffer,
  identityMimeType,
  prompt,
}) => {
  if (!aiClient.isAiEnabled()) {
    throw AppError.error("AI image service is not configured.", 500);
  }

  try {
    const completion = await aiClient.requestCompletion({
      model: AI.IMAGE_MODEL,
      modalities: ["image", "text"],
      max_tokens: AI.MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(prompt) },
            {
              type: "image_url",
              image_url: {
                url: bufferToDataUrl(productBuffer, productMimeType),
              },
            },
            {
              type: "image_url",
              image_url: {
                url: bufferToDataUrl(identityBuffer, identityMimeType),
              },
            },
          ],
        },
      ],
    });

    const generatedUrl = extractGeneratedImageUrl(completion);

    if (!generatedUrl || !generatedUrl.startsWith("data:")) {
      console.error(
        "AI image unexpected response:",
        JSON.stringify(completion)?.slice(0, 500),
      );
      throw AppError.error("AI image service returned no image.", 502);
    }

    const base64Data = generatedUrl.split(",")[1];
    return Buffer.from(base64Data, "base64");
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error("AI image error:", error.status || error.message);
    mapImageError(error);
  }
};

// Loads the single, site-wide visual identity image used to brand every product.
const fetchSiteIdentityImage = async () => {
  const identityUrl = AI.SITE_IDENTITY_IMAGE_URL;
  if (!identityUrl) {
    throw AppError.error(
      "The site visual identity image is not configured.",
      500,
    );
  }

  let response;
  try {
    response = await fetch(identityUrl);
  } catch {
    throw AppError.error("Failed to load the site visual identity image.", 502);
  }

  if (!response.ok) {
    throw AppError.error("Failed to load the site visual identity image.", 502);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") || "image/png",
  };
};

// Optimizes a product image against the fixed site identity and returns a Buffer.
const optimizeProductImageBuffer = async (
  productBuffer,
  productMimeType,
  prompt,
) => {
  const identity = await fetchSiteIdentityImage();
  return runImageEdit({
    productBuffer,
    productMimeType,
    identityBuffer: identity.buffer,
    identityMimeType: identity.mimeType,
    prompt,
  });
};

// Standalone endpoint: seller uploads both the product image and an identity image.
const generateBrandedProductImage = async (req) => {
  const userId = req.user?.id;
  if (!userId) {
    throw AppError.fail("Seller authentication data is missing.", 401);
  }

  const productFile = req.files?.productImage?.[0];
  const identityFile = req.files?.identityImage?.[0];
  if (!productFile) throw AppError.fail("Product image is required.", 400);
  if (!identityFile) {
    throw AppError.fail("Visual identity image is required.", 400);
  }

  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);

  const outputBuffer = await runImageEdit({
    productBuffer: productFile.buffer,
    productMimeType: productFile.mimetype,
    identityBuffer: identityFile.buffer,
    identityMimeType: identityFile.mimetype,
    prompt: req.body?.prompt,
  });

  const uploaded = await cloudinaryService.uploadImage(
    outputBuffer,
    `ai-products/${seller.id}`,
  );

  return { imageUrl: uploaded.url };
};

module.exports = { generateBrandedProductImage, optimizeProductImageBuffer };
