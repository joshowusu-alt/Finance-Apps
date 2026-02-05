import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

function exportData() {
  const dataDir = path.join(process.cwd(), ".data");
  const mainDbPath = path.join(dataDir, "main.sqlite");
  const reviewDbPath = path.join(dataDir, "review.sqlite");

  // Check if databases exist
  if (!fs.existsSync(mainDbPath)) {
    console.error(`❌ main.sqlite not found at: ${mainDbPath}`);
    console.error("Make sure you're running this from the cashflow-app directory");
    process.exit(1);
  }

  if (!fs.existsSync(reviewDbPath)) {
    console.error(`❌ review.sqlite not found at: ${reviewDbPath}`);
    console.error("Make sure you're running this from the cashflow-app directory");
    process.exit(1);
  }

  console.log("Opening SQLite databases...");
  const mainDb = new Database(mainDbPath, { readonly: true });
  const reviewDb = new Database(reviewDbPath, { readonly: true });

  try {
    // Export main plans
    console.log("\nExporting main_plans...");
    const mainPlans = mainDb.prepare("SELECT * FROM main_plans").all() as any[];
    console.log(`  Found ${mainPlans.length} main plan(s)`);

    // Export review plans
    console.log("Exporting review_plans...");
    const reviewPlans = reviewDb.prepare("SELECT * FROM review_plans").all() as any[];
    console.log(`  Found ${reviewPlans.length} review plan(s)`);

    // Convert to export format
    const exportData = {
      exported_at: new Date().toISOString(),
      main_plans: mainPlans.map((row) => ({
        token_hash: row.token_hash,
        plan_json: row.plan_json,
        prev_plan_json: row.prev_plan_json || null,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
        last_seen_at: new Date(row.last_seen_at).toISOString(),
      })),
      review_plans: reviewPlans.map((row) => ({
        token_hash: row.token_hash,
        plan_json: row.plan_json,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
        last_seen_at: new Date(row.last_seen_at).toISOString(),
      })),
    };

    // Write to file
    const exportPath = path.join(process.cwd(), "sqlite-export.json");
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    console.log(`\n✅ Export complete!`);
    console.log(`   File: ${exportPath}`);
    console.log(`   Main plans: ${mainPlans.length}`);
    console.log(`   Review plans: ${reviewPlans.length}`);
  } catch (error) {
    console.error("\n❌ Error during export:", error);
    throw error;
  } finally {
    mainDb.close();
    reviewDb.close();
  }
}

exportData();
