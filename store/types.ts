/**
 * Shared Types for Finance App
 * All type definitions used across the store modules
 */

// Transaction Types
export type TransactionType = 'expense' | 'income';

// Category
export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  budget_limit: number;
  category_type?: TransactionType;
  totalSpent?: number;
  percentage?: number;
};

// Transaction
export type Transaction = {
  id: number;
  category_id: number;
  amount: number;
  date: string;
  note: string;
  type?: TransactionType;
  image_uri?: string;
  created_at?: number;
  // Joined fields from category
  category_name?: string;
  category_icon?: string;
  category_color?: string;
};

// Split Bill
export type SplitBillMember = {
  id: number;
  split_bill_id: number;
  name: string;
  share_amount: number;
  is_me: boolean;
};

export type SplitBill = {
  id: number;
  date: string;
  name: string;
  total_amount: number;
  image_uri?: string;
  created_at?: number;
  members?: SplitBillMember[];
};
