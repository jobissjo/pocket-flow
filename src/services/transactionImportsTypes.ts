export type MatchStatus =
  | 'matched'
  | 'ambiguous'
  | 'not_found'
  | 'uncertain'
  | 'needs_confirmation';

export interface ExtractedLineItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
}

export interface AccountMatchResult {
  status: MatchStatus;
  accountId?: string | null;
  creditCardId?: string | null;
  sourceType?: 'ACCOUNT' | 'CREDIT_CARD' | 'CASH';
  confidence?: number;
  suggestedName?: string;
  matchedName?: string;
  last4Digits?: string;
}

export interface CategoryMatchResult {
  status: MatchStatus;
  categoryId?: string | null;
  confidence?: number;
  suggestedName?: string;
  matchedName?: string;
}

export interface MerchantMatchResult {
  name: string;
  isNew?: boolean;
  matchedMerchantId?: string | null;
  confidence?: number;
}

export interface DuplicateTransactionInfo {
  isDuplicate: boolean;
  existingTransaction?: {
    id: string;
    title: string;
    amount: number;
    date: string;
    categoryName?: string;
    sourceName?: string;
  };
  similarityScore?: number;
  message?: string;
}

export interface TransactionImportDraft {
  importId: string;
  imageUrl?: string;
  merchant: MerchantMatchResult;
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  time?: string;
  transactionType: 'expense' | 'income';
  paymentMethod?: string;
  referenceId?: string;
  notes?: string;
  accountMatch: AccountMatchResult;
  categoryMatch: CategoryMatchResult;
  lineItems?: ExtractedLineItem[];
  warnings?: string[];
  duplicateWarning?: DuplicateTransactionInfo;
  confidenceScore?: number;
  rawText?: string;
}

export interface ConfirmImportPayload {
  transaction_type: 'expense' | 'income';
  amount: number;
  currency: string;
  title: string;
  merchant_id?: string | null;
  merchant_name?: string;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id: string;
  date: string;
  payment_method?: string;
  reference_id?: string;
  notes?: string;
  line_items?: {
    name: string;
    quantity: number;
    unit_price?: number;
    total_price: number;
  }[];
}

export type ImportStep =
  | 'idle'
  | 'file_selected'
  | 'uploading'
  | 'processing'
  | 'review'
  | 'confirming'
  | 'success'
  | 'error'
  | 'unsupported'
  | 'multiple_transactions';

// Swagger schemas from FastAPI
export interface EntityMatchResponse {
  extracted_name?: string | null;
  matched_id?: string | null;
  matched_name?: string | null;
  confidence?: number;
  status?: 'matched' | 'not_found' | 'ambiguous' | 'needs_confirmation' | string;
  possible_matches?: Record<string, any>[];
}

export interface TransactionItemDraftResponse {
  name: string;
  quantity?: number | null;
  unit_price?: number | null;
  amount?: number | null;
}

export interface TransactionDraftResponse {
  transaction_type?: 'income' | 'expense' | string;
  title?: string;
  amount?: number | null;
  currency?: string | null;
  merchant?: EntityMatchResponse | null;
  account?: EntityMatchResponse | null;
  credit_card?: EntityMatchResponse | null;
  category?: EntityMatchResponse | null;
  transaction_date?: string | null;
  payment_method?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  items?: TransactionItemDraftResponse[];
  warnings?: string[];
  confidence?: number;
  is_duplicate?: boolean;
  possible_duplicate_id?: string | null;
  possible_duplicate_title?: string | null;
  duplicate_message?: string | null;
}

export interface TransactionImportResponse {
  id: string;
  user_id: string;
  file_name: string;
  status: 'processing' | 'review' | 'confirmed' | 'rejected' | 'failed';
  source_type?: string | null;
  draft?: TransactionDraftResponse | null;
  raw_extraction?: Record<string, any> | null;
  created_transaction_id?: string | null;
  warnings?: string[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}
