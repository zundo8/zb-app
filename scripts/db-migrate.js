const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to database.");

  const safeQuery = async (sql, ignoreErrors = []) => {
    try {
      console.log(`Executing: ${sql.trim()}`);
      await client.query(sql);
    } catch (e) {
      if (ignoreErrors.some(err => e.message.toLowerCase().includes(err.toLowerCase()))) {
        console.log(`  -> Ignored expected error: ${e.message}`);
      } else {
        console.error(`  -> ERROR: ${e.message}`);
        throw e;
      }
    }
  };

  // 1. Rename tables if they exist
  await safeQuery('ALTER TABLE "MfgTask" RENAME TO pending_tasks;', ['already exists', 'does not exist', 'relation "MfgTask" does not exist']);
  await safeQuery('ALTER TABLE "MfgProductionBatch" RENAME TO manufacturing_batches;', ['already exists', 'does not exist', 'relation "MfgProductionBatch" does not exist']);
  await safeQuery('ALTER TABLE "MfgDesignTask" RENAME TO design_tasks;', ['already exists', 'does not exist', 'relation "MfgDesignTask" does not exist']);

  // 2. Rename columns in pending_tasks
  const pendingCols = {
    'dueDate': 'due_date',
    'completedAt': 'completed_at',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'createdByName': 'created_by_name',
    'batchId': 'batch_id',
    'assignedToId': 'assigned_to_id',
    'workdriveUrl': 'workdrive_url',
    'workdriveFolderId': 'workdrive_folder_id',
    'approvalStatus': 'approval_status',
    'designName': 'design_name',
    'designImage': 'design_image'
  };
  for (const [oldCol, newCol] of Object.entries(pendingCols)) {
    await safeQuery(`ALTER TABLE pending_tasks RENAME COLUMN "${oldCol}" TO ${newCol};`, ['does not exist', 'already exists', 'column']);
  }
  await safeQuery('ALTER TABLE pending_tasks ADD COLUMN IF NOT EXISTS workdrive_folder_name TEXT;', []);

  // 3. Rename columns in manufacturing_batches
  const batchCols = {
    'batchCode': 'batch_code',
    'productName': 'product_name',
    'currentStage': 'current_stage',
    'washCostTotal': 'wash_cost_total',
    'fabricId': 'fabric_id',
    'estimatedCostPerUnit': 'estimated_cost_per_unit',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'isCuttingDone': 'is_cutting_done',
    'isEmbroideryDone': 'is_embroidery_done',
    'isPrintingDone': 'is_printing_done',
    'isSampleDone': 'is_sample_done',
    'isWashingDone': 'is_washing_done',
    'isStitchingDone': 'is_stitching_done',
    'workdriveFolderId': 'workdrive_folder_id',
    'workdriveUrl': 'workdrive_url'
  };
  for (const [oldCol, newCol] of Object.entries(batchCols)) {
    await safeQuery(`ALTER TABLE manufacturing_batches RENAME COLUMN "${oldCol}" TO ${newCol};`, ['does not exist', 'already exists', 'column']);
  }
  await safeQuery('ALTER TABLE manufacturing_batches ADD COLUMN IF NOT EXISTS workdrive_folder_name TEXT;', []);

  // 4. Recreate design_tasks
  await safeQuery('DROP TABLE IF EXISTS design_tasks CASCADE;', []);
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS design_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      order_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      workdrive_folder_id TEXT,
      workdrive_folder_name TEXT,
      approved_file_id TEXT,
      approved_by TEXT REFERENCES "User"(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_by TEXT REFERENCES "User"(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `, []);

  // 5. Enable Row Level Security and add policy
  await safeQuery('ALTER TABLE design_tasks ENABLE ROW LEVEL SECURITY;', ['does not support', 'not found']);
  await safeQuery(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'design_tasks' AND policyname = 'Authenticated users can access design_tasks'
      ) THEN
        CREATE POLICY "Authenticated users can access design_tasks"
          ON design_tasks FOR ALL
          USING (true);
      END IF;
    END $$;
  `, []);

  console.log("Migration completed successfully.");
  await client.end();
}
run().catch(console.error);
