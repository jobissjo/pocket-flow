import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

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

export interface DebtLoan {
  id: string;
  person_name: string;
  amount: number; // Positive = Lent (they owe you), Negative = Borrowed (you owe them)
  description: string;
  due_date: string;
  status: 'pending' | 'settled';
  created_at: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  category: string;
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  next_billing_date: string; // YYYY-MM-DD
  account_id: string;
  status: 'active' | 'paused';
  created_at: string;
}

export interface Investment {
  id: string;
  name: string;
  type: 'mutual_fund' | 'stock' | 'crypto' | 'gold' | 'other';
  shares: number;
  buy_price: number;
  current_price: number;
  account_id: string;
  created_at: string;
}

export interface SIP {
  id: string;
  name: string;
  investment_id: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  next_date: string; // YYYY-MM-DD
  account_id: string;
  status: 'active' | 'paused';
  created_at: string;
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
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then((db) => {
    dbInstance = db;
    return db;
  });

  return dbPromise;
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

    CREATE TABLE IF NOT EXISTS debts_loans (
      id TEXT PRIMARY KEY,
      person_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      due_date TEXT,
      status TEXT CHECK(status IN ('pending', 'settled')) NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      billing_cycle TEXT CHECK(billing_cycle IN ('weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
      next_billing_date TEXT NOT NULL,
      account_id TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'paused')) NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('mutual_fund', 'stock', 'crypto', 'gold', 'other')) NOT NULL,
      shares REAL NOT NULL DEFAULT 0,
      buy_price REAL NOT NULL,
      current_price REAL NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      frequency TEXT CHECK(frequency IN ('weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
      next_date TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      status TEXT CHECK(status IN ('active', 'paused')) NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
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
    await db.execAsync('DELETE FROM debts_loans;');
    await db.execAsync('DELETE FROM subscriptions;');
    await db.execAsync('DELETE FROM investments;');
    await db.execAsync('DELETE FROM sips;');
    
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

export async function exportDatabaseToJson(): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Fetch all tables
    const accounts = await db.getAllAsync<any>('SELECT * FROM accounts');
    const transactions = await db.getAllAsync<any>('SELECT * FROM transactions');
    const savingsGoals = await db.getAllAsync<any>('SELECT * FROM savings_goals');
    const aiChatHistory = await db.getAllAsync<any>('SELECT * FROM ai_chat_history');
    const settings = await db.getAllAsync<any>('SELECT * FROM settings');
    const debtsLoans = await db.getAllAsync<any>('SELECT * FROM debts_loans');
    const subscriptions = await db.getAllAsync<any>('SELECT * FROM subscriptions');
    const investments = await db.getAllAsync<any>('SELECT * FROM investments');
    const sips = await db.getAllAsync<any>('SELECT * FROM sips');

    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        accounts,
        transactions,
        savings_goals: savingsGoals,
        ai_chat_history: aiChatHistory,
        settings,
        debts_loans: debtsLoans,
        subscriptions,
        investments,
        sips
      }
    };

    const jsonString = JSON.stringify(backupData, null, 2);

    if (Platform.OS === 'web') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wealthflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const fileUri = `${FileSystem.cacheDirectory}wealthflow_backup.json`;
      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export WealthFlow Backup'
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    }
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
}

export async function importDatabaseFromJson(): Promise<boolean> {
  try {
    let jsonString = '';

    if (Platform.OS === 'web') {
      jsonString = await new Promise<string>((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (!file) {
            reject(new Error('No file selected'));
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
            resolve(evt.target?.result as string);
          };
          reader.onerror = () => reject(new Error('Error reading file'));
          reader.readAsText(file);
        };
        input.click();
      });
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return false;
      }

      const fileUri = result.assets[0].uri;
      jsonString = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8
      });
    }

    if (!jsonString) {
      throw new Error('Backup file is empty or could not be read.');
    }

    const backup = JSON.parse(jsonString);
    if (!backup || typeof backup !== 'object' || !backup.data || typeof backup.data !== 'object') {
      throw new Error('Invalid backup file format: missing data.');
    }

    const { accounts, transactions, savings_goals, ai_chat_history, settings, debts_loans, subscriptions, investments, sips } = backup.data;

    if (!Array.isArray(accounts) || !Array.isArray(transactions)) {
      throw new Error('Invalid backup data: accounts and transactions must be list arrays.');
    }

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await db.execAsync('PRAGMA foreign_keys = OFF;');

      await db.execAsync('DELETE FROM transactions;');
      await db.execAsync('DELETE FROM accounts;');
      await db.execAsync('DELETE FROM savings_goals;');
      await db.execAsync('DELETE FROM ai_chat_history;');
      await db.execAsync('DELETE FROM settings;');
      await db.execAsync('DELETE FROM debts_loans;');
      await db.execAsync('DELETE FROM subscriptions;');
      await db.execAsync('DELETE FROM investments;');
      await db.execAsync('DELETE FROM sips;');

      for (const acc of accounts) {
        await db.runAsync(
          'INSERT INTO accounts (id, name, type, balance, details, color) VALUES (?, ?, ?, ?, ?, ?)',
          [
            acc.id,
            acc.name,
            acc.type,
            acc.balance ?? 0,
            acc.details || '',
            acc.color || '#1e3a8a,#0f172a'
          ]
        );
      }

      for (const tx of transactions) {
        await db.runAsync(
          'INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            tx.id,
            tx.account_id,
            tx.amount,
            tx.category,
            tx.note || '',
            tx.type,
            tx.date,
            tx.recurring ? 1 : 0
          ]
        );
      }

      if (Array.isArray(savings_goals)) {
        for (const goal of savings_goals) {
          await db.runAsync(
            'INSERT INTO savings_goals (id, name, target_amount, current_amount, category, monthly_contribution) VALUES (?, ?, ?, ?, ?, ?)',
            [
              goal.id,
              goal.name,
              goal.target_amount,
              goal.current_amount ?? 0,
              goal.category || '',
              goal.monthly_contribution ?? 0
            ]
          );
        }
      }

      if (Array.isArray(ai_chat_history)) {
        for (const chat of ai_chat_history) {
          await db.runAsync(
            'INSERT INTO ai_chat_history (id, role, content, timestamp, type, structured_data) VALUES (?, ?, ?, ?, ?, ?)',
            [
              chat.id,
              chat.role,
              chat.content,
              chat.timestamp,
              chat.type || 'text',
              chat.structured_data || null
            ]
          );
        }
      }

      if (Array.isArray(settings)) {
        for (const setting of settings) {
          await db.runAsync(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [setting.key, setting.value]
          );
        }
      }

      if (Array.isArray(debts_loans)) {
        for (const dl of debts_loans) {
          await db.runAsync(
            'INSERT INTO debts_loans (id, person_name, amount, description, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              dl.id,
              dl.person_name,
              dl.amount,
              dl.description || '',
              dl.due_date || '',
              dl.status || 'pending',
              dl.created_at
            ]
          );
        }
      }

      if (Array.isArray(subscriptions)) {
        for (const s of subscriptions) {
          await db.runAsync(
            'INSERT INTO subscriptions (id, name, amount, category, billing_cycle, next_billing_date, account_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              s.id,
              s.name,
              s.amount,
              s.category || 'Utilities',
              s.billing_cycle || 'monthly',
              s.next_billing_date,
              s.account_id,
              s.status || 'active',
              s.created_at
            ]
          );
        }
      }

      if (Array.isArray(investments)) {
        for (const inv of investments) {
          await db.runAsync(
            'INSERT INTO investments (id, name, type, shares, buy_price, current_price, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              inv.id,
              inv.name,
              inv.type,
              inv.shares ?? 0,
              inv.buy_price ?? 0,
              inv.current_price ?? 0,
              inv.account_id,
              inv.created_at
            ]
          );
        }
      }

      if (Array.isArray(sips)) {
        for (const s of sips) {
          await db.runAsync(
            'INSERT INTO sips (id, name, investment_id, amount, frequency, next_date, account_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              s.id,
              s.name,
              s.investment_id,
              s.amount,
              s.frequency || 'monthly',
              s.next_date,
              s.account_id,
              s.status || 'active',
              s.created_at
            ]
          );
        }
      }

      await db.execAsync('PRAGMA foreign_keys = ON;');
    });

    return true;
  } catch (error) {
    console.error('Error importing database:', error);
    throw error;
  }
}

export async function getDebtsLoans(): Promise<DebtLoan[]> {
  try {
    const db = await getDatabase();
    return await db.getAllAsync<DebtLoan>('SELECT * FROM debts_loans ORDER BY created_at DESC');
  } catch (error) {
    console.error('Error getting debts & loans:', error);
    return [];
  }
}

export async function addDebtLoan(
  personName: string,
  amount: number,
  description: string,
  dueDate: string
): Promise<void> {
  try {
    const db = await getDatabase();
    const id = 'dl-' + Date.now();
    const createdAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO debts_loans (id, person_name, amount, description, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, personName, amount, description, dueDate, createdAt]
    );
  } catch (error) {
    console.error('Error adding debt/loan:', error);
    throw error;
  }
}

export async function settleDebtLoan(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync("UPDATE debts_loans SET status = 'settled' WHERE id = ?", [id]);
  } catch (error) {
    console.error('Error settling debt/loan:', error);
    throw error;
  }
}

export async function deleteDebtLoan(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM debts_loans WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting debt/loan:', error);
    throw error;
  }
}

export async function getSubscriptions(): Promise<Subscription[]> {
  try {
    const db = await getDatabase();
    return await db.getAllAsync<Subscription>('SELECT * FROM subscriptions ORDER BY next_billing_date ASC');
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    return [];
  }
}

export async function addSubscription(
  name: string,
  amount: number,
  category: string,
  billingCycle: 'weekly' | 'monthly' | 'yearly',
  nextBillingDate: string,
  accountId: string
): Promise<void> {
  try {
    const db = await getDatabase();
    const id = 'sub-' + Date.now();
    const createdAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO subscriptions (id, name, amount, category, billing_cycle, next_billing_date, account_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?);`,
      [id, name, amount, category, billingCycle, nextBillingDate, accountId, createdAt]
    );
  } catch (error) {
    console.error('Error adding subscription:', error);
    throw error;
  }
}

export async function pauseSubscription(id: string, status: 'active' | 'paused'): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('UPDATE subscriptions SET status = ? WHERE id = ?;', [status, id]);
  } catch (error) {
    console.error('Error changing subscription status:', error);
    throw error;
  }
}

export async function deleteSubscription(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM subscriptions WHERE id = ?;', [id]);
  } catch (error) {
    console.error('Error deleting subscription:', error);
    throw error;
  }
}

export async function autoApplySubscriptions(): Promise<void> {
  try {
    const db = await getDatabase();
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Query active subscriptions past due
    const dueSubs = await db.getAllAsync<Subscription>(
      "SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?",
      [todayStr]
    );

    if (dueSubs.length === 0) return;

    await db.withTransactionAsync(async () => {
      for (const sub of dueSubs) {
        let nextDate = new Date(sub.next_billing_date);
        const today = new Date(todayStr);

        while (nextDate <= today) {
          const txId = 'tx-sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
          const txDateStr = nextDate.toISOString();

          // 1. Insert transaction
          await db.runAsync(
            `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
             VALUES (?, ?, ?, ?, ?, 'expense', ?, 1);`,
            [txId, sub.account_id, -sub.amount, sub.category, `Subscription: ${sub.name}`, txDateStr]
          );

          // 2. Update account balance
          await db.runAsync(
            'UPDATE accounts SET balance = balance - ? WHERE id = ?;',
            [sub.amount, sub.account_id]
          );

          // 3. Advance billing date
          if (sub.billing_cycle === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (sub.billing_cycle === 'yearly') {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
        }

        // 4. Update the subscription in DB
        const nextDateStr = nextDate.toISOString().split('T')[0];
        await db.runAsync(
          'UPDATE subscriptions SET next_billing_date = ? WHERE id = ?;',
          [nextDateStr, sub.id]
        );
      }
    });
  } catch (error) {
    console.error('Error auto-applying subscriptions:', error);
  }
}

export async function getInvestments(): Promise<Investment[]> {
  try {
    const db = await getDatabase();
    return await db.getAllAsync<Investment>('SELECT * FROM investments ORDER BY name ASC');
  } catch (error) {
    console.error('Error getting investments:', error);
    return [];
  }
}

export async function addInvestment(
  name: string,
  type: 'mutual_fund' | 'stock' | 'crypto' | 'gold' | 'other',
  shares: number,
  buyPrice: number,
  currentPrice: number,
  accountId: string
): Promise<void> {
  try {
    const db = await getDatabase();
    const id = 'inv-' + Date.now();
    const createdAt = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Insert investment
      await db.runAsync(
        `INSERT INTO investments (id, name, type, shares, buy_price, current_price, account_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [id, name, type, shares, buyPrice, currentPrice, accountId, createdAt]
      );

      // 2. Add transaction representing purchase if shares > 0
      if (shares > 0) {
        const txId = 'tx-inv-' + Date.now();
        const cost = shares * buyPrice;
        await db.runAsync(
          `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
           VALUES (?, ?, ?, 'Investment', ?, 'expense', ?, 0);`,
          [txId, accountId, -cost, `Bought ${shares} shares of ${name}`, createdAt]
        );
        // 3. Update account balance
        await db.runAsync(
          'UPDATE accounts SET balance = balance - ? WHERE id = ?;',
          [cost, accountId]
        );
      }
    });
  } catch (error) {
    console.error('Error adding investment:', error);
    throw error;
  }
}

export async function updateInvestmentPrice(id: string, currentPrice: number): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('UPDATE investments SET current_price = ? WHERE id = ?;', [currentPrice, id]);
  } catch (error) {
    console.error('Error updating current price:', error);
    throw error;
  }
}

export async function buyMoreInvestment(
  id: string,
  sharesToAdd: number,
  buyPrice: number,
  accountId: string
): Promise<void> {
  try {
    const db = await getDatabase();
    const inv = await db.getFirstAsync<Investment>('SELECT * FROM investments WHERE id = ?;', [id]);
    if (!inv) throw new Error('Investment not found');

    const totalShares = inv.shares + sharesToAdd;
    // Calculate new average buy price
    const newAverageBuyPrice = ((inv.shares * inv.buy_price) + (sharesToAdd * buyPrice)) / totalShares;
    const cost = sharesToAdd * buyPrice;
    const txId = 'tx-inv-buy-' + Date.now();
    const dateStr = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Update investment shares & buy price
      await db.runAsync(
        'UPDATE investments SET shares = ?, buy_price = ? WHERE id = ?;',
        [totalShares, newAverageBuyPrice, id]
      );
      // 2. Add expense transaction
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
         VALUES (?, ?, ?, 'Investment', ?, 'expense', ?, 0);`,
        [txId, accountId, -cost, `Bought ${sharesToAdd} shares of ${inv.name}`, dateStr]
      );
      // 3. Deduct balance from account
      await db.runAsync(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?;',
        [cost, accountId]
      );
    });
  } catch (error) {
    console.error('Error buying more investment:', error);
    throw error;
  }
}

export async function sellInvestment(
  id: string,
  sharesToSell: number,
  sellPrice: number,
  accountId: string
): Promise<void> {
  try {
    const db = await getDatabase();
    const inv = await db.getFirstAsync<Investment>('SELECT * FROM investments WHERE id = ?;', [id]);
    if (!inv) throw new Error('Investment not found');
    if (inv.shares < sharesToSell) throw new Error('Insufficient shares to sell');

    const remainingShares = inv.shares - sharesToSell;
    const gain = sharesToSell * sellPrice;
    const txId = 'tx-inv-sell-' + Date.now();
    const dateStr = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Update shares
      await db.runAsync('UPDATE investments SET shares = ? WHERE id = ?;', [remainingShares, id]);
      // 2. Add income transaction
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
         VALUES (?, ?, ?, 'Investment', ?, 'income', ?, 0);`,
        [txId, accountId, gain, `Sold ${sharesToSell} shares of ${inv.name}`, dateStr]
      );
      // 3. Add proceeds to account balance
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?;',
        [gain, accountId]
      );
    });
  } catch (error) {
    console.error('Error selling investment:', error);
    throw error;
  }
}

export async function getSIPs(): Promise<SIP[]> {
  try {
    const db = await getDatabase();
    return await db.getAllAsync<SIP>('SELECT * FROM sips ORDER BY next_date ASC');
  } catch (error) {
    console.error('Error getting sips:', error);
    return [];
  }
}

export async function addSIP(
  name: string,
  investmentId: string,
  amount: number,
  frequency: 'weekly' | 'monthly' | 'yearly',
  nextDate: string,
  accountId: string
): Promise<void> {
  try {
    const db = await getDatabase();
    const id = 'sip-' + Date.now();
    const createdAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sips (id, name, investment_id, amount, frequency, next_date, account_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?);`,
      [id, name, investmentId, amount, frequency, nextDate, accountId, createdAt]
    );
  } catch (error) {
    console.error('Error adding SIP:', error);
    throw error;
  }
}

export async function pauseSIP(id: string, status: 'active' | 'paused'): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('UPDATE sips SET status = ? WHERE id = ?;', [status, id]);
  } catch (error) {
    console.error('Error pausing/resuming SIP:', error);
    throw error;
  }
}

export async function deleteSIP(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM sips WHERE id = ?;', [id]);
  } catch (error) {
    console.error('Error deleting SIP:', error);
    throw error;
  }
}

export async function autoApplySIPs(): Promise<void> {
  try {
    const db = await getDatabase();
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Query active SIPs past due
    const dueSIPs = await db.getAllAsync<SIP>(
      "SELECT * FROM sips WHERE status = 'active' AND next_date <= ?",
      [todayStr]
    );

    if (dueSIPs.length === 0) return;

    await db.withTransactionAsync(async () => {
      for (const sip of dueSIPs) {
        // Load target investment details
        const inv = await db.getFirstAsync<Investment>(
          'SELECT * FROM investments WHERE id = ?;',
          [sip.investment_id]
        );

        if (!inv) continue; // if investment was deleted somehow, skip

        let nextDate = new Date(sip.next_date);
        const today = new Date(todayStr);

        while (nextDate <= today) {
          const txId = 'tx-sip-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
          const txDateStr = nextDate.toISOString();
          const sharesBought = sip.amount / inv.current_price;

          // 1. Insert transaction
          await db.runAsync(
            `INSERT INTO transactions (id, account_id, amount, category, note, type, date, recurring)
             VALUES (?, ?, ?, 'Investment', ?, 'expense', ?, 1);`,
            [txId, sip.account_id, -sip.amount, `SIP: ${sip.name} (${sharesBought.toFixed(4)} shares)`, txDateStr]
          );

          // 2. Update account balance
          await db.runAsync(
            'UPDATE accounts SET balance = balance - ? WHERE id = ?;',
            [sip.amount, sip.account_id]
          );

          // 3. Update investment shares (average buy price remains weighted)
          const newShares = inv.shares + sharesBought;
          const newAvgBuyPrice = ((inv.shares * inv.buy_price) + (sharesBought * inv.current_price)) / newShares;
          await db.runAsync(
            'UPDATE investments SET shares = ?, buy_price = ? WHERE id = ?;',
            [newShares, newAvgBuyPrice, inv.id]
          );

          // 4. Advance billing date
          if (sip.frequency === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (sip.frequency === 'yearly') {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }

          // Sync in-memory representation for potential multi-cycle runs
          inv.shares = newShares;
          inv.buy_price = newAvgBuyPrice;
        }

        // 5. Update next date in database
        const nextDateStr = nextDate.toISOString().split('T')[0];
        await db.runAsync(
          'UPDATE sips SET next_date = ? WHERE id = ?;',
          [nextDateStr, sip.id]
        );
      }
    });
  } catch (error) {
    console.error('Error auto-applying SIPs:', error);
  }
}

