import * as SQLite from 'expo-sqlite';

export interface Account {
  id: string;
  name: string;
  type: 'bank' | 'credit' | 'crypto' | 'digital';
  balance: number;
  details: string;
  color: string; // Comma separated list of gradient colors, e.g. '#1e3a8a,#0f172a'
}

export interface Transaction {
  id: string;
  account_id: string;
  amount: number; // Positive for income, negative for expense
  category: string;
  note: string;
  type: 'income' | 'expense' | 'transfer';
  date: string; // ISO String
  recurring: number; // 0 or 1
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  category: string;
  monthly_contribution: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'text' | 'chart';
  structured_data?: string; // JSON string for charts or custom elements
}

const DATABASE_NAME = 'wealthflow.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('bank', 'credit', 'crypto', 'digital')) NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      details TEXT,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      note TEXT,
      type TEXT CHECK(type IN ('income', 'expense', 'transfer')) NOT NULL,
      date TEXT NOT NULL,
      recurring INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      category TEXT,
      monthly_contribution REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_chat_history (
      id TEXT PRIMARY KEY,
      role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      structured_data TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed data if empty
  const accountsCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts');
  if (accountsCount && accountsCount.count === 0) {
    console.log('Seeding initial offline database data...');
    
    // Seed Accounts
    await db.runAsync(
      `INSERT INTO accounts (id, name, type, balance, details, color) VALUES 
      ('chase-1', 'Chase Private Client', 'bank', 84200.00, '•••• •••• •••• 8812', '#1e3a8a,#0f172a'),
      ('amex-1', 'Amex Platinum', 'credit', 12450.12, '•••• •••• •••• 4007', '#2c3e50,#000000'),
      ('meta-1', 'MetaMask Pro', 'crypto', 4520.10, '0x71...f92A', '#1e3a8a,#4c1d95'),
      ('upi-1', 'Instant UPI', 'digital', 41334.00, 'wealthflow@bank', '#0f172a,#1e293b');`
    );

    // Seed Savings Goals
    await db.runAsync(
      `INSERT INTO savings_goals (id, name, target_amount, current_amount, category, monthly_contribution) VALUES 
      ('goal-1', 'New Car', 35000.00, 22750.00, 'Transport', 500.00),
      ('goal-2', 'Emergency Fund', 20000.00, 18000.00, 'Security', 400.00),
      ('goal-3', 'Vacation', 6000.00, 1200.00, 'Travel', 200.00);`
    );

    // Seed Chat History
    await db.runAsync(
      `INSERT INTO ai_chat_history (id, role, content, timestamp, type, structured_data) VALUES 
      ('chat-0', 'assistant', 'Hello Alex! I am WealthAI, your offline financial helper. Ask me about your spending, budgets, or how you are tracking on goals!', '${new Date().toISOString()}', 'text', NULL);`
    );

    // Seed Settings
    await db.runAsync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('theme', 'dark'),
      ('currency', 'USD'),
      ('biometrics', 'true'),
      ('username', 'Alex'),
      ('member_since', 'June 2026');`
    );

    // Seed Transactions
    // Let's seed transactions with dates around now to make charts look great
    const now = new Date();
    const today = now.toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    
    await db.runAsync(
      `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring) VALUES 
      ('t1', 'chase-1', -12.50, 'Food', 'Apple Pay • Starbucks Coffee', 'expense', '${today}', 0),
      ('t2', 'amex-1', -32.95, 'Digital', 'Visa • Apple One Family', 'expense', '${today}', 1),
      ('t3', 'chase-1', 500.00, 'Transfer', 'Internal • Transfer from Savings', 'income', '${today}', 0),
      ('t4', 'amex-1', -24.20, 'Transport', 'Mastercard • Uber Trip', 'expense', '${yesterday}', 0),
      ('t5', 'chase-1', -60.00, 'Grocery', 'Apple Pay • Whole Foods', 'expense', '${yesterday}', 0),
      ('t6', 'chase-1', -5.45, 'Food', 'Today, 8:45 AM • Starbucks', 'expense', '${today}', 0),
      ('t7', 'chase-1', -1200.00, 'Housing', 'Rent Payment', 'expense', '${yesterday}', 1),
      ('t8', 'chase-1', 4200.00, 'Salary', 'Monthly Paycheck', 'income', '${twoDaysAgo}', 1),
      ('t9', 'chase-1', -850.00, 'Services', 'Apex Design Studio', 'expense', '${today}', 0),
      ('t10', 'amex-1', -1299.00, 'Electronics', 'Apple Store', 'expense', '${yesterday}', 0),
      ('t11', 'chase-1', 4200.00, 'Transfer', 'Deposit from External', 'income', '${twoDaysAgo}', 0),
      ('t12', 'upi-1', -142.50, 'Dining', 'The Modern Bistro', 'expense', '${threeDaysAgo}', 0);`
    );
    
    console.log('Seeding completed successfully.');
  }
}

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  } catch (error) {
    console.error(`Error setting ${key} to ${value}:`, error);
  }
}

export async function clearAllData(): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Disable foreign keys temporarily
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    
    // Delete all rows in tables
    await db.execAsync('DELETE FROM transactions;');
    await db.execAsync('DELETE FROM accounts;');
    await db.execAsync('DELETE FROM savings_goals;');
    await db.execAsync('DELETE FROM ai_chat_history;');
    await db.execAsync('DELETE FROM settings;');
    
    // Enable foreign keys back
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Seed default Cash account with $0 balance
    await db.runAsync(
      "INSERT INTO accounts (id, name, type, balance, details, color) VALUES ('cash-1', 'Main Cash Account', 'bank', 0.00, 'Main Wallet', '#10b981,#047857')"
    );

    // Seed default settings
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('theme', 'dark')");
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('currency', 'USD')");
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('username', 'Alex')");
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('member_since', 'June 2026')");
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('biometrics', 'false')");
  } catch (error) {
    console.error('Error clearing all database data:', error);
    throw error;
  }
}
