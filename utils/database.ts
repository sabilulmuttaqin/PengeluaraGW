import { type SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 5;
  // Get current version
  let { user_version: currentDbVersion } = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  ) || { user_version: 0 };

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  // Transaction for atomic updates
  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT, 
        color TEXT,
        budget_limit REAL DEFAULT 0
      );

      -- Transactions
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        amount REAL NOT NULL,
        date TEXT NOT NULL, 
        note TEXT,
        image_uri TEXT, 
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );
    `);

    // Seed default categories
    const result = await db.getFirstAsync('SELECT count(*) as count FROM categories');
    // @ts-ignore
    if (result && result.count === 0) {
       await db.runAsync(
        `INSERT INTO categories (name, icon, color) VALUES 
        ('Makanan & Minuman', 'emoji:🍔', '#000000'),
        ('Transport', 'emoji:🚗', '#000000'),
        ('Belanja', 'emoji:🛒', '#000000'),
        ('Hiburan', 'emoji:🎬', '#000000'),
        ('Kesehatan', 'emoji:💊', '#000000'),
        ('Pendidikan', 'emoji:📚', '#000000'),
        ('Tagihan', 'emoji:📄', '#000000'),
        ('Pulsa & Internet', 'emoji:📱', '#000000'),
        ('Olahraga', 'emoji:⚽', '#000000'),
        ('Kecantikan', 'emoji:💄', '#000000'),
        ('Hewan Peliharaan', 'emoji:🐶', '#000000'),
        ('Donasi', 'emoji:🎁', '#000000'),
        ('Lainnya', 'emoji:✨', '#000000');`
       );
    }
  }

  // Removed dummy transactions seeding to start fresh
  if (currentDbVersion < 2) {
       // Migration logic if needed, but skipping seed
  }

  // Migration for adding new categories (v2 -> v3)
  if (currentDbVersion < 3) {
    const result = await db.getFirstAsync('SELECT count(*) as count FROM categories');
    // @ts-ignore
    if (result && result.count === 5) {
      // Old schema with 5 categories, add the missing 8
      await db.runAsync(
        `INSERT INTO categories (name, icon, color) VALUES 
        ('Kesehatan', 'emoji:💊', '#000000'),
        ('Pendidikan', 'emoji:📚', '#000000'),
        ('Tagihan', 'emoji:📄', '#000000'),
        ('Pulsa & Internet', 'emoji:📱', '#000000'),
        ('Olahraga', 'emoji:⚽', '#000000'),
        ('Kecantikan', 'emoji:💄', '#000000'),
        ('Hewan Peliharaan', 'emoji:🐶', '#000000'),
        ('Donasi', 'emoji:🎁', '#000000');`
      );
      
      // Also update Makan to Makanan & Minuman
      await db.runAsync(
        `UPDATE categories SET name = 'Makanan & Minuman', icon = 'emoji:🍔' WHERE name = 'Makan'`
      );
      
      // Update Hiburan emoji
      await db.runAsync(
        `UPDATE categories SET icon = 'emoji:🎬' WHERE name = 'Hiburan'`
      );
    }
  }

  // Split Bill Migration (v3 -> v4)
  if (currentDbVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS split_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        total_amount REAL DEFAULT 0,
        image_uri TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS split_bill_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        split_bill_id INTEGER,
        name TEXT NOT NULL,
        share_amount REAL DEFAULT 0,
        is_me BOOLEAN DEFAULT 0,
        FOREIGN KEY (split_bill_id) REFERENCES split_bills (id) ON DELETE CASCADE
      );
    `);
  }

  // Income Tracking Migration (v4 -> v5)
  if (currentDbVersion < 5) {
    // Add type column to transactions (expense or income)
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN type TEXT DEFAULT 'expense';
    `);

    // Add category_type column to categories
    await db.execAsync(`
      ALTER TABLE categories ADD COLUMN category_type TEXT DEFAULT 'expense';
    `);

    // Add default income categories
    await db.runAsync(
      `INSERT INTO categories (name, icon, color, category_type) VALUES 
      ('Gaji', 'emoji:💰', '#10B981', 'income'),
      ('Freelance', 'emoji:💻', '#10B981', 'income'),
      ('Investasi', 'emoji:📈', '#10B981', 'income'),
      ('Bonus', 'emoji:🎉', '#10B981', 'income'),
      ('Transfer', 'emoji:🔄', '#10B981', 'income'),
      ('Hadiah', 'emoji:🎁', '#10B981', 'income'),
      ('Lainnya', 'emoji:💵', '#10B981', 'income');`
    );
  }

  // Update version
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
