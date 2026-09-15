import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, 'tiffin.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to local SQLite database at:', dbPath);
  }
});

// Helper wrapper for async database queries
export const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getRow = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const getAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema
export const initDb = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      meal_preference TEXT DEFAULT 'Both',
      diet_type TEXT DEFAULT 'Veg',
      plan_type TEXT DEFAULT 'PerMeal',
      rate_lunch REAL DEFAULT 80.0,
      rate_dinner REAL DEFAULT 80.0,
      monthly_rate REAL DEFAULT 3000.0,
      advance_balance REAL DEFAULT 0.0,
      status TEXT DEFAULT 'Active',
      start_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      meal_slot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Delivered',
      extra_amount REAL DEFAULT 0.0,
      extra_notes TEXT,
      applied_lunch_rate REAL,
      applied_dinner_rate REAL,
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
      UNIQUE(customer_id, date, meal_slot)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_mode TEXT DEFAULT 'UPI',
      is_advance INTEGER DEFAULT 0,
      month_year TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS customer_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS closed_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      reason TEXT,
      closed_by TEXT DEFAULT 'Owner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Safe migration checks for existing columns
  try {
    await runQuery(`ALTER TABLE customers ADD COLUMN advance_balance REAL DEFAULT 0.0`);
  } catch (e) {
    // Column already exists
  }

  try {
    await runQuery(`ALTER TABLE payments ADD COLUMN is_advance INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }

  try {
    await runQuery(`ALTER TABLE daily_logs ADD COLUMN applied_lunch_rate REAL`);
  } catch (e) {
    // Column already exists
  }

  try {
    await runQuery(`ALTER TABLE daily_logs ADD COLUMN applied_dinner_rate REAL`);
  } catch (e) {
    // Column already exists
  }

  // Backfill and sync rates for Monthly and PerMeal plan customers
  try {
    await runQuery(`
      UPDATE customers 
      SET 
        rate_lunch = CASE 
          WHEN meal_preference = 'Both' THEN ROUND(monthly_rate / 60)
          ELSE ROUND(monthly_rate / 30)
        END,
        rate_dinner = CASE 
          WHEN meal_preference = 'Both' THEN ROUND(monthly_rate / 60)
          ELSE ROUND(monthly_rate / 30)
        END
      WHERE plan_type = 'Monthly' AND monthly_rate > 0
    `);

    await runQuery(`
      UPDATE daily_logs 
      SET applied_lunch_rate = (
        SELECT COALESCE(NULLIF(c.rate_lunch, 0), 80) FROM customers c WHERE c.id = daily_logs.customer_id
      )
      WHERE applied_lunch_rate IS NULL OR applied_lunch_rate = 0 OR customer_id IN (SELECT id FROM customers WHERE plan_type = 'Monthly')
    `);

    await runQuery(`
      UPDATE daily_logs 
      SET applied_dinner_rate = (
        SELECT COALESCE(NULLIF(c.rate_dinner, 0), 80) FROM customers c WHERE c.id = daily_logs.customer_id
      )
      WHERE applied_dinner_rate IS NULL OR applied_dinner_rate = 0 OR customer_id IN (SELECT id FROM customers WHERE plan_type = 'Monthly')
    `);
  } catch (e) {
    // Ignore migration error
  }

  // Insert default settings if not exists
  const centerName = await getRow(`SELECT value FROM settings WHERE key = 'center_name'`);
  if (!centerName) {
    await runQuery(`INSERT INTO settings (key, value) VALUES ('center_name', 'Adarsh Tiffin Centre')`);
    await runQuery(`INSERT INTO settings (key, value) VALUES ('owner_phone', '9876543210')`);
    await runQuery(`INSERT INTO settings (key, value) VALUES ('upi_id', '9876543210@upi')`);
    await runQuery(`INSERT INTO settings (key, value) VALUES ('address', 'Main Market, City')`);
    await runQuery(`INSERT INTO settings (key, value) VALUES ('default_lunch_rate', '80')`);
    await runQuery(`INSERT INTO settings (key, value) VALUES ('default_dinner_rate', '80')`);
  }

  // Seed sample data if database is brand new
  const countObj = await getRow(`SELECT COUNT(*) as count FROM customers`);
  if (countObj && countObj.count === 0) {
    console.log('Seeding initial sample customers for Tiffin Centre...');
    await runQuery(`
      INSERT INTO customers (name, phone, address, meal_preference, diet_type, plan_type, rate_lunch, rate_dinner, monthly_rate, advance_balance, status, start_date, notes)
      VALUES 
      ('Rahul Verma', '9812345678', 'Flat 201, Green Heights', 'Both', 'Veg', 'PerMeal', 80, 80, 4500, 500, 'Active', '2026-09-01', 'Prefers less spicy food'),
      ('Priya Sharma', '9823456789', 'H.No 45, Civil Lines', 'Lunch', 'Veg', 'Monthly', 80, 80, 2400, 0, 'Active', '2026-09-01', 'Lunch delivery by 1:00 PM'),
      ('Amit Patel', '9834567890', 'Sector 14, Pocket B', 'Dinner', 'Non-Veg', 'PerMeal', 90, 90, 4800, 200, 'Active', '2026-09-01', 'Requires extra rotis'),
      ('Vikram Singh', '9845678901', 'Hostel 3, Room 12', 'Both', 'Veg', 'PerMeal', 75, 75, 4200, 0, 'Paused', '2026-09-01', 'On leave till Sunday')
    `);

    const todayStr = new Date().toISOString().split('T')[0];
    await runQuery(`
      INSERT OR IGNORE INTO daily_logs (customer_id, date, meal_slot, status, extra_amount, extra_notes)
      VALUES 
      (1, '${todayStr}', 'Lunch', 'Delivered', 0, ''),
      (1, '${todayStr}', 'Dinner', 'Delivered', 20, '2 Extra Rotis'),
      (2, '${todayStr}', 'Lunch', 'Delivered', 0, ''),
      (3, '${todayStr}', 'Dinner', 'Delivered', 0, ''),
      (4, '${todayStr}', 'Lunch', 'Skipped', 0, 'Customer on leave')
    `);

    await runQuery(`
      INSERT INTO payments (customer_id, amount, payment_date, payment_mode, is_advance, month_year, notes)
      VALUES 
      (1, 1000, '2026-09-05', 'UPI', 1, '2026-09', 'Advance deposit'),
      (2, 2400, '2026-09-02', 'Cash', 0, '2026-09', 'Full monthly payment')
    `);
  }
};

export default db;
