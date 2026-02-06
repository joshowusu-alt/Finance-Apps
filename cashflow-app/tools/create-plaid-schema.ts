import { neon } from "@neondatabase/serverless";

async function createSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);

  console.log("Creating Plaid schema...");

  // Table for storing Plaid connection tokens
  await sql`
    CREATE TABLE IF NOT EXISTS plaid_connections (
      user_id VARCHAR(255) NOT NULL,
      item_id VARCHAR(255) PRIMARY KEY,
      access_token TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_synced_at TIMESTAMP WITH TIME ZONE
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_plaid_connections_user ON plaid_connections(user_id)`;

  console.log("✓ Created plaid_connections table");

  // Table for storing connected accounts
  await sql`
    CREATE TABLE IF NOT EXISTS plaid_accounts (
      account_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      official_name VARCHAR(255),
      type VARCHAR(50) NOT NULL,
      subtype VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      FOREIGN KEY (item_id) REFERENCES plaid_connections(item_id) ON DELETE CASCADE
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user ON plaid_accounts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON plaid_accounts(item_id)`;

  console.log("✓ Created plaid_accounts table");

  console.log("✅ Plaid schema created successfully!");
}

createSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error creating schema:", error);
    process.exit(1);
  });
