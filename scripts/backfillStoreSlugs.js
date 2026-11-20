// Gives every store without a slug one generated from its name.
// Run after scripts/add-store-slug.sql:  npm run backfill:store-slugs
// Safe to run more than once: stores that already have a slug are skipped.
require("dotenv").config();
const { sequelize } = require("../config/db.config.js");
require("../models/associations.js");
const Seller = require("../models/seller.model.js");
const { generateUniqueStoreSlug } = require("../services/profile/storeSlug.service.js");

const run = async () => {
  await sequelize.authenticate();
  const sellers = await Seller.findAll({
    where: { slug: null },
    attributes: ["id", "storeName"],
    order: [["created_at", "ASC"]], // older stores get the plain slug first
  });

  console.log(`Stores without a slug: ${sellers.length}`);
  for (const seller of sellers) {
    // eslint-disable-next-line no-await-in-loop
    await sequelize.transaction(async (transaction) => {
      const slug = await generateUniqueStoreSlug(seller.storeName, { transaction });
      await seller.update({ slug }, { transaction, hooks: false });
      console.log(`  ${seller.storeName} → ${slug}`);
    });
  }
  console.log("Done.");
};

run()
  .catch((error) => {
    console.error("Backfill failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
