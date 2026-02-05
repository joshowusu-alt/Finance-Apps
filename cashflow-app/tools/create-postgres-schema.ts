import { neon } from "@neondatabase/serverless";

async function createSchema() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    console.error("Please add DATABASE_URL to your .env.local file");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    console.log("Creating main_plans table...");
    await sql`
      CREATE TABLE IF NOT EXISTS main_plans (
        token_hash VARCHAR(64) PRIMARY KEY,
        plan_json JSONB NOT NULL,
        prev_plan_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `;

    console.log("Creating indexes on main_plans...");
    await sql`CREATE INDEX IF NOT EXISTS idx_main_last_seen ON main_plans(last_seen_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_main_plan_json ON main_plans USING GIN (plan_json)`;

    console.log("Creating review_plans table...");
    await sql`
      CREATE TABLE IF NOT EXISTS review_plans (
        token_hash VARCHAR(64) PRIMARY KEY,
        plan_json JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `;

    console.log("Creating indexes on review_plans...");
    await sql`CREATE INDEX IF NOT EXISTS idx_review_last_seen ON review_plans(last_seen_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_review_plan_json ON review_plans USING GIN (plan_json)`;

    console.log("✅ Schema created successfully!");
    console.log("\nTables created:");
    console.log("  - main_plans (with indexes on last_seen_at and plan_json)");
    console.log("  - review_plans (with indexes on last_seen_at and plan_json)");
  } catch (error) {
    console.error("❌ Error creating schema:", error);
    throw error;
  }
}

createSchema().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
