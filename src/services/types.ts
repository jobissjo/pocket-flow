// OpenAPI 3.1 Data Types for PocketFlow Backend

export type AccountType = 'savings' | 'current' | 'salary' | 'cash' | 'other';
export type CategoryType = 'income' | 'expense';
export type TransactionType = 'income' | 'expense';
export type EMIStatus = 'active' | 'completed' | 'overdue';

// Auth Models
export interface UserRegisterRequest {
  email: string;
  password: string;
  full_name: string;
  mobile_number: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface ResendOTPRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  new_password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  mobile_number: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  full_name?: string | null;
  mobile_number?: string | null;
}

export interface MessageResponse {
  message: string;
  detail?: string;
}

// Account Models
export interface AccountResponse {
  id: string;
  user_id: string;
  name: string;
  bank_name: string;
  account_type: AccountType;
  last_four: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface AccountCreate {
  name: string;
  bank_name: string;
  account_type: AccountType;
  account_number: string;
  balance?: number;
}

export interface AccountUpdate {
  name?: string | null;
  bank_name?: string | null;
  account_type?: AccountType | null;
  account_number?: string | null;
  balance?: number | null;
}

// Credit Card Models
export interface CreditCardResponse {
  id: string;
  user_id: string;
  card_name: string;
  provider: string;
  last_four: string;
  credit_limit: number;
  outstanding_amount: number;
  available_limit: number;
  billing_date: number;
  payment_due_date: number;
  created_at: string;
  updated_at: string;
}

export interface CreditCardCreate {
  card_name: string;
  provider: string;
  last_four: string;
  credit_limit: number;
  outstanding_amount?: number;
  billing_date: number;
  payment_due_date: number;
}

export interface CreditCardUpdate {
  card_name?: string | null;
  provider?: string | null;
  last_four?: string | null;
  credit_limit?: number | null;
  outstanding_amount?: number | null;
  billing_date?: number | null;
  payment_due_date?: number | null;
}

// Category Models
export interface CategoryResponse {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  is_system: boolean;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  type: CategoryType;
  icon?: string;
}

export interface CategoryUpdate {
  name?: string | null;
  type?: CategoryType | null;
  icon?: string | null;
}

// Transaction Models
export interface TransactionResponse {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  category_name?: string | null;
  category_icon?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  credit_card_id?: string | null;
  credit_card_name?: string | null;
  date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionCreate {
  title: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  account_id?: string | null;
  credit_card_id?: string | null;
  date?: string;
  notes?: string | null;
}

export interface TransactionUpdate {
  title?: string | null;
  amount?: number | null;
  type?: TransactionType | null;
  category_id?: string | null;
  account_id?: string | null;
  credit_card_id?: string | null;
  date?: string | null;
  notes?: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface TransactionFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: TransactionType;
  category?: string;
  account?: string;
  credit_card?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  sort_by?: 'date' | 'amount' | 'title' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// EMI Models
export interface EMIResponse {
  id: string;
  user_id: string;
  name: string;
  total_amount: number;
  monthly_emi_amount: number;
  total_installments: number;
  paid_installments: number;
  remaining_installments: number;
  next_payment_date?: string | null;
  start_date: string;
  due_day: number;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id?: string | null;
  status: EMIStatus;
  created_at: string;
  updated_at: string;
}

export interface EMICreate {
  name: string;
  total_amount: number;
  monthly_emi_amount: number;
  total_installments: number;
  paid_installments?: number;
  start_date?: string;
  due_day: number;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id?: string | null;
}

export interface EMIUpdate {
  name?: string | null;
  total_amount?: number | null;
  monthly_emi_amount?: number | null;
  total_installments?: number | null;
  paid_installments?: number | null;
  start_date?: string | null;
  due_day?: number | null;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id?: string | null;
  status?: EMIStatus | null;
}

export interface EMIMarkPaidResponse {
  message: string;
  emi: EMIResponse;
}

// Dashboard Models
export interface SummaryResponse {
  total_balance: number;
  total_income: number;
  total_expenses: number;
  total_credit_card_outstanding: number;
  net_savings: number;
  savings_percentage: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TimeSeriesDataPoint {
  period: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryBreakdownItem {
  category_id: string;
  category_name: string;
  category_icon: string;
  amount: number;
  percentage: number;
}

export interface AnalyticsResponse {
  income_vs_expense: TimeSeriesDataPoint[];
  expense_breakdown: CategoryBreakdownItem[];
  income_breakdown: CategoryBreakdownItem[];
}
