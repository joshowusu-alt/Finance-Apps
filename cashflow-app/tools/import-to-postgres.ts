import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

async function importData() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set");
    console.error("Please add DATABASE_URL to your .env.local file");
    process.exit(1);
  }

  const exportPath = path.join(process.cwd(), "sqlite-export.json");

  if (!fs.existsSync(exportPath)) {
    console.error(`❌ Export file not found: ${exportPath}`);
    console.error("Please run 'npx tsx tools/export-sqlite-data.ts' first");
    process.exit(1);
  }

  console.log("Reading export file...");
  const data = JSON.parse(fs.readFileSync(exportPath, "utf-8"));

  console.log(`\nExport info:`);
  console.log(`  Exported at: ${data.exported_at}`);
  console.log(`  Main plans: ${data.main_plans.length}`);
  console.log(`  Review plans: ${data.review_plans.length}`);

  const sql = neon(databaseUrl);

  try {
    console.log("\nImporting main_plans...");
    for (const row of data.main_plans) {
      await sql`
        INSERT INTO main_plans
        (token_hash, plan_json, prev_plan_json, created_at, updated_at, last_seen_at)
        VALUES (
          ${row.token_hash},
          ${row.plan_json}::jsonb,
          ${row.prev_plan_json}::jsonb,
          ${new Date(row.created_at)},
          ${new Date(row.updated_at)},
          ${new Date(row.last_seen_at)}
        )
        ON CONFLICT (token_hash) DO UPDATE SET
          plan_json = EXCLUDED.plan_json,
          prev_plan_json = EXCLUDED.prev_plan_json,
          updated_at = EXCLUDED.updated_at,
          last_seen_at = EXCLUDED.last_seen_at
      `;
      console.log(`  ✓ Imported token_hash: ${row.token_hash.substring(0, 8)}...`);
    }

    console.log("\nImporting review_plans...");
    for (const row of data.review_plans) {
      await sql`
        INSERT INTO review_plans
        (token_hash, plan_json, created_at, updated_at, last_seen_at)
        VALUES (
          ${row.token_hash},
          ${row.plan_json}::jsonb,
          ${new Date(row.created_at)},
          ${new Date(row.updated_at)},
          ${new Date(row.last_seen_at)}
        )
        ON CONFLICT (token_hash) DO UPDATE SET
          plan_json = EXCLUDED.plan_json,
          updated_at = EXCLUDED.updated_at,
          last_seen_at = EXCLUDED.last_seen_at
      `;
      console.log(`  ✓ Imported token_hash: ${row.token_hash.substring(0, 8)}...`);
    }

    // Verify import
    console.log("\nVerifying import...");
    const mainCount = await sql`SELECT COUNT(*) as count FROM main_plans`;
    const reviewCount = await sql`SELECT COUNT(*) as count FROM review_plans`;

    console.log(`  Main plans in database: ${mainCount[0].count}`);
    console.log(`  Review plans in database: ${reviewCount[0].count}`);

    if (Number(mainCount[0].count) === data.main_plans.length && Number(reviewCount[0].count) === data.review_plans.length) {
      console.log("\n✅ Import complete! All records imported successfully.");
    } else {
      console.warn("\n⚠️  Warning: Record count mismatch!");
      console.warn(`  Expected main: ${data.main_plans.length}, got: ${mainCount[0].count}`);
      console.warn(`  Expected review: ${data.review_plans.length}, got: ${reviewCount[0].count}`);
    }
  } catch (error) {
    console.error("\n❌ Error during import:", error);
    throw error;
  }
}

importData().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
