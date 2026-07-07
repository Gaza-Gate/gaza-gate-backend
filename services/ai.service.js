const AI = require("../constants/ai.constant.js");
const Seller = require("../models/seller.model.js");
const AppError = require("../utils/AppError.util.js");
const cloudinaryService = require("./cloudinary.service.js");

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
  return trimmed ? `${base}\n\nAdditional instructions from the seller: ${trimmed}` : base;
};

// Core call: takes a product image + identity image and returns the edited image as a Buffer.
const runImageEdit = async ({
  productBuffer,
  productMimeType,
  identityBuffer,
  identityMimeType,
  prompt,
}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw AppError.error("AI image service is not configured.", 500);
  }

  const requestBody = {
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
            image_url: { url: bufferToDataUrl(productBuffer, productMimeType) },
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
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI.REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(AI.OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Gaza Gate",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw AppError.error("AI image request timed out. Please try again.", 504);
    }
    throw AppError.error("Failed to reach the AI image service.", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("OpenRouter error:", response.status, errorText);

    if (response.status === 402) {
      throw AppError.fail(
        "The AI image service has insufficient credits. Please top up the OpenRouter account.",
        402,
      );
    }

    throw AppError.error("AI image generation failed. Please try again.", 502);
  }

  const data = await response.json();
  const generatedUrl =
    data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!generatedUrl || !generatedUrl.startsWith("data:")) {
    console.error(
      "OpenRouter unexpected response:",
      JSON.stringify(data)?.slice(0, 500),
    );
    throw AppError.error("AI image service returned no image.", 502);
  }

  const base64Data = generatedUrl.split(",")[1];
  return Buffer.from(base64Data, "base64");
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
  } catch (error) {
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
