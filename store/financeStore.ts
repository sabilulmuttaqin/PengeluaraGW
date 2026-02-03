/**
 * Finance Store
 * Central state management for transactions, categories, and split bills
 * Uses Zustand for state management
 */

import { create } from 'zustand';
import { type SQLiteDatabase } from 'expo-sqlite';
import { 
  TransactionType, 
  Category, 
  Transaction, 
  SplitBill, 
  SplitBillMember 
} from './types';

// Re-export types for backward compatibility
export type { TransactionType, Category, Transaction, SplitBill, SplitBillMember } from './types';

// ============================================
// STORE INTERFACE
// ============================================

interface FinanceState {
  // State
  transactions: Transaction[];
  categories: Category[];
  splitBills: SplitBill[];
  
  // Computed Totals
  balance: number;       // Income - Expense
  totalIncome: number;
  totalExpense: number;
  
  // Backward Compat Aliases
  totalMonth: number;    // Alias for balance
  
  // UI State
  isLoading: boolean;
  
  // Category Actions
  fetchCategories: (db: SQLiteDatabase) => Promise<void>;
  addCategory: (db: SQLiteDatabase, category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (db: SQLiteDatabase, id: number, category: Partial<Category>) => Promise<void>;
  deleteCategory: (db: SQLiteDatabase, id: number) => Promise<void>;
  
  // Transaction Actions (handles both income & expense)
  addTransaction: (db: SQLiteDatabase, transaction: Omit<Transaction, 'id' | 'created_at' | 'category_name' | 'category_icon' | 'category_color'>) => Promise<void>;
  addExpense: (db: SQLiteDatabase, transaction: Omit<Transaction, 'id' | 'created_at' | 'category_name' | 'category_icon' | 'category_color'>) => Promise<void>; // Alias
  fetchRecentTransactions: (db: SQLiteDatabase) => Promise<void>;
  deleteTransaction: (db: SQLiteDatabase, id: number) => Promise<void>;
  
  // Summary Actions
  calculateMonthSummary: (db: SQLiteDatabase, selectedMonth?: Date) => Promise<void>;
  calculateTotalMonth: (db: SQLiteDatabase, selectedMonth?: Date) => Promise<void>; // Alias
  
  // Split Bill Actions
  fetchSplitBills: (db: SQLiteDatabase) => Promise<void>;
  addSplitBill: (db: SQLiteDatabase, bill: Omit<SplitBill, 'id' | 'created_at' | 'members'>, members: Omit<SplitBillMember, 'id' | 'split_bill_id'>[]) => Promise<void>;
  deleteSplitBill: (db: SQLiteDatabase, id: number) => Promise<void>;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useFinanceStore = create<FinanceState>((set, get) => ({
  // Initial State
  transactions: [],
  categories: [],
  splitBills: [],
  balance: 0,
  totalMonth: 0, // Backward compat alias for balance
  totalIncome: 0,
  totalExpense: 0,
  isLoading: false,

  // ============================================
  // CATEGORY ACTIONS
  // ============================================

  fetchCategories: async (db) => {
    try {
      const result = await db.getAllAsync<Category>('SELECT * FROM categories');
      set({ categories: result });
    } catch (error) {
      console.error('[FinanceStore] Error fetching categories:', error);
    }
  },

  addCategory: async (db, category) => {
    try {
      await db.runAsync(
        'INSERT INTO categories (name, icon, color, budget_limit, category_type) VALUES (?, ?, ?, ?, ?)',
        [category.name, category.icon, category.color, category.budget_limit || 0, category.category_type || 'expense']
      );
      await get().fetchCategories(db);
    } catch (error) {
      console.error('[FinanceStore] Error adding category:', error);
    }
  },

  updateCategory: async (db, id, category) => {
    try {
      await db.runAsync(
        'UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?',
        [category.name || '', category.icon || '', category.color || '', id]
      );
      await get().fetchCategories(db);
    } catch (error) {
      console.error('[FinanceStore] Error updating category:', error);
    }
  },

  deleteCategory: async (db, id) => {
    try {
      await db.runAsync('DELETE FROM transactions WHERE category_id = ?', [id]);
      await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
      await get().fetchCategories(db);
    } catch (error) {
      console.error('[FinanceStore] Error deleting category:', error);
    }
  },

  // ============================================
  // TRANSACTION ACTIONS (Income & Expense)
  // ============================================

  addTransaction: async (db, transaction) => {
    set({ isLoading: true });
    try {
      await db.runAsync(
        'INSERT INTO transactions (category_id, amount, date, note, image_uri, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transaction.category_id, 
          transaction.amount, 
          transaction.date, 
          transaction.note, 
          transaction.image_uri ?? null, 
          transaction.type ?? 'expense'
        ]
      );
      await get().fetchRecentTransactions(db);
      await get().calculateMonthSummary(db);
    } catch (error) {
      console.error('[FinanceStore] Error adding transaction:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Backward compat alias
  addExpense: async (db, transaction) => {
    return get().addTransaction(db, transaction);
  },

  fetchRecentTransactions: async (db) => {
    try {
      const result = await db.getAllAsync<Transaction>(`
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color 
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        ORDER BY t.date DESC, t.id DESC
        LIMIT 20
      `);
      set({ transactions: result });
    } catch (error) {
      console.error('[FinanceStore] Error fetching transactions:', error);
    }
  },

  deleteTransaction: async (db, id) => {
    try {
      await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
      await get().fetchRecentTransactions(db);
      await get().calculateMonthSummary(db);
    } catch (error) {
      console.error('[FinanceStore] Error deleting transaction:', error);
    }
  },

  // ============================================
  // SUMMARY & ANALYTICS
  // ============================================

  calculateMonthSummary: async (db, selectedMonth) => {
    try {
      const targetDate = selectedMonth || new Date();
      const yearMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Query: Total Expense
      const expenseResult = await db.getFirstAsync<{ total: number }>(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM transactions 
        WHERE strftime('%Y-%m', date) = ? AND (type = 'expense' OR type IS NULL)
      `, [yearMonth]);
      
      // Query: Total Income
      const incomeResult = await db.getFirstAsync<{ total: number }>(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM transactions 
        WHERE strftime('%Y-%m', date) = ? AND type = 'income'
      `, [yearMonth]);
      
      const totalExpense = expenseResult?.total || 0;
      const totalIncome = incomeResult?.total || 0;
      const balance = totalIncome - totalExpense;
      
      // Query: Category Breakdown (expense only for category cards)
      const breakdownResult = await db.getAllAsync<{ category_id: number; total: number }>(`
        SELECT category_id, SUM(amount) as total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ? AND (type = 'expense' OR type IS NULL)
        GROUP BY category_id
      `, [yearMonth]);

      // Map breakdown to categories with stats
      const categories = get().categories;
      const categoriesWithStats = categories.map(cat => {
        const catTotal = breakdownResult.find(b => b.category_id === cat.id)?.total || 0;
        const percentage = totalExpense > 0 ? Math.round((catTotal / totalExpense) * 100) : 0;
        return { ...cat, totalSpent: catTotal, percentage };
      });

      set({ 
        balance,
        totalMonth: balance, // Backward compat alias
        totalIncome,
        totalExpense,
        categories: categoriesWithStats
      });

    } catch (error) {
      console.error('[FinanceStore] Error calculating summary:', error);
    }
  },

  // Backward compat alias
  calculateTotalMonth: async (db, selectedMonth) => {
    return get().calculateMonthSummary(db, selectedMonth);
  },

  // ============================================
  // SPLIT BILL ACTIONS
  // ============================================

  fetchSplitBills: async (db) => {
    try {
      const bills = await db.getAllAsync<SplitBill>('SELECT * FROM split_bills ORDER BY date DESC, id DESC');
      set({ splitBills: bills });
    } catch (error) {
      console.error('[FinanceStore] Error fetching split bills:', error);
    }
  },

  addSplitBill: async (db, bill, members) => {
    try {
      const result = await db.runAsync(
        'INSERT INTO split_bills (name, date, total_amount, image_uri) VALUES (?, ?, ?, ?)',
        [bill.name, bill.date, bill.total_amount, bill.image_uri ?? null]
      );
      const billId = result.lastInsertRowId;
      
      for (const member of members) {
        await db.runAsync(
          'INSERT INTO split_bill_members (split_bill_id, name, share_amount, is_me) VALUES (?, ?, ?, ?)',
          [billId, member.name, member.share_amount, member.is_me ? 1 : 0]
        );
      }
      
      await get().fetchSplitBills(db);
    } catch (error) {
      console.error('[FinanceStore] Error adding split bill:', error);
    }
  },

  deleteSplitBill: async (db, id) => {
    try {
      await db.runAsync('DELETE FROM split_bills WHERE id = ?', [id]);
      await get().fetchSplitBills(db);
    } catch (error) {
      console.error('[FinanceStore] Error deleting split bill:', error);
    }
  },
}));

// ============================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================

// Keep old name working for existing imports
export const useExpenseStore = useFinanceStore;

// Alias for old function names
export const useStore = () => {
  const store = useFinanceStore();
  return {
    ...store,
    // Backward compat aliases
    totalMonth: store.balance,
    addExpense: store.addTransaction,
    calculateTotalMonth: store.calculateMonthSummary,
  };
};
