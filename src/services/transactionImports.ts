import { Platform } from 'react-native';
import { apiRequest } from './api';
import { transactionService } from './transactions';
import type {
  TransactionImportDraft,
  ConfirmImportPayload,
  ExtractedLineItem,
  AccountMatchResult,
  CategoryMatchResult,
  MerchantMatchResult,
  DuplicateTransactionInfo,
  TransactionImportResponse,
} from './transactionImportsTypes';

/**
 * Normalizes backend response from AI Transaction Import into standard TransactionImportDraft
 */
export function parseImportDraftResponse(
  data: any,
  imageUrl?: string
): TransactionImportDraft {
  const importId = data.id || data.import_id || data.importId || `imp_${Date.now()}`;

  // Support both top-level draft and nested data.draft
  const draftObj = data.draft || data;

  // Merchant parsing
  const rawMerchant = draftObj.merchant || {};
  const merchantName =
    typeof rawMerchant === 'string'
      ? rawMerchant
      : rawMerchant.matched_name ||
        rawMerchant.extracted_name ||
        rawMerchant.name ||
        draftObj.title ||
        draftObj.merchant_name ||
        'Unidentified Merchant';

  const merchantStatus = (rawMerchant.status || '').toLowerCase();
  const isMerchantNew =
    rawMerchant.is_new !== undefined
      ? Boolean(rawMerchant.is_new)
      : rawMerchant.isNew !== undefined
      ? Boolean(rawMerchant.isNew)
      : merchantStatus === 'not_found' || !rawMerchant.matched_id;

  const merchant: MerchantMatchResult = {
    name: merchantName,
    isNew: isMerchantNew,
    matchedMerchantId: rawMerchant.matched_id || rawMerchant.merchant_id || rawMerchant.id || null,
    confidence: rawMerchant.confidence ?? draftObj.confidence ?? data.confidence_score,
  };

  // Account & Credit Card matching parsing
  const rawAccount = draftObj.account || draftObj.account_match || draftObj.accountMatch || {};
  const rawCreditCard = draftObj.credit_card || {};

  let matchedSourceType: 'ACCOUNT' | 'CREDIT_CARD' = 'ACCOUNT';
  let accountStatus = (rawAccount.status || 'not_found').toLowerCase();
  const accountId = rawAccount.matched_id || rawAccount.account_id || rawAccount.accountId || null;
  const creditCardId = rawCreditCard.matched_id || rawCreditCard.credit_card_id || rawCreditCard.creditCardId || null;
  let suggestedAccName = rawAccount.extracted_name || rawAccount.suggested_name || rawAccount.name;
  let matchedAccName = rawAccount.matched_name || rawAccount.name;

  // If credit card has a match or is higher confidence, prioritize credit card
  if (rawCreditCard.status === 'matched' || (rawCreditCard.matched_id && !accountId)) {
    matchedSourceType = 'CREDIT_CARD';
    accountStatus = (rawCreditCard.status || 'matched').toLowerCase();
    suggestedAccName = rawCreditCard.extracted_name || rawCreditCard.suggested_name;
    matchedAccName = rawCreditCard.matched_name;
  }

  const accountMatch: AccountMatchResult = {
    status: (['matched', 'ambiguous', 'not_found', 'uncertain', 'needs_confirmation'].includes(accountStatus)
      ? accountStatus
      : 'needs_confirmation') as any,
    accountId,
    creditCardId,
    sourceType: matchedSourceType,
    confidence: rawAccount.confidence ?? rawCreditCard.confidence,
    suggestedName: suggestedAccName,
    matchedName: matchedAccName,
    last4Digits: rawAccount.last_four || rawCreditCard.last_four,
  };

  // Category matching parsing
  const rawCategory = draftObj.category || draftObj.category_match || draftObj.categoryMatch || {};
  const categoryStatus = (rawCategory.status || 'not_found').toLowerCase();

  const categoryMatch: CategoryMatchResult = {
    status: (['matched', 'ambiguous', 'not_found', 'uncertain', 'needs_confirmation'].includes(categoryStatus)
      ? categoryStatus
      : 'needs_confirmation') as any,
    categoryId: rawCategory.matched_id || rawCategory.category_id || rawCategory.categoryId || null,
    confidence: rawCategory.confidence,
    suggestedName: rawCategory.extracted_name || rawCategory.suggested_name || rawCategory.name,
    matchedName: rawCategory.matched_name || rawCategory.name,
  };

  // Line items parsing (draft.items or draft.line_items)
  const rawItems = draftObj.items || draftObj.line_items || draftObj.lineItems || [];
  const lineItems: ExtractedLineItem[] = Array.isArray(rawItems)
    ? rawItems.map((item: any, idx: number) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 1;
        const unit =
          item.unit_price !== undefined && item.unit_price !== null
            ? Number(item.unit_price)
            : item.price !== undefined
            ? Number(item.price)
            : undefined;
        const total =
          item.amount !== undefined && item.amount !== null
            ? Number(item.amount)
            : item.total_price !== undefined
            ? Number(item.total_price)
            : unit !== undefined
            ? unit * qty
            : 0;

        return {
          id: item.id || `item_${idx + 1}`,
          name: item.name || item.description || item.title || `Item ${idx + 1}`,
          quantity: qty,
          unitPrice: unit,
          totalPrice: total,
        };
      })
    : [];

  // Duplicate warning parsing
  const isDuplicate = Boolean(
    draftObj.is_duplicate ||
    draftObj.isDuplicate ||
    data.is_duplicate ||
    draftObj.possible_duplicate_id
  );

  const duplicateWarning: DuplicateTransactionInfo | undefined = isDuplicate
    ? {
        isDuplicate: true,
        existingTransaction: {
          id: draftObj.possible_duplicate_id || 'existing_tx',
          title: draftObj.possible_duplicate_title || merchantName,
          amount: Number(draftObj.amount || data.amount || 0),
          date: draftObj.transaction_date || draftObj.date || data.date || new Date().toISOString().split('T')[0],
        },
        message:
          draftObj.duplicate_message ||
          `A similar transaction for ₹${Number(draftObj.amount || 0).toLocaleString('en-IN')} already exists in your ledger.`,
      }
    : undefined;

  // Clean formatted date
  const rawDateStr = draftObj.transaction_date || draftObj.date || data.date;
  let cleanDate = new Date().toISOString().split('T')[0];
  if (rawDateStr) {
    const parsedDate = new Date(rawDateStr);
    if (!isNaN(parsedDate.getTime())) {
      cleanDate = parsedDate.toISOString().split('T')[0];
    } else if (typeof rawDateStr === 'string' && rawDateStr.includes('-')) {
      cleanDate = rawDateStr.split('T')[0];
    }
  }

  // Combined warnings
  const combinedWarnings = [
    ...(Array.isArray(data.warnings) ? data.warnings : []),
    ...(Array.isArray(draftObj.warnings) ? draftObj.warnings : []),
  ];

  return {
    importId,
    imageUrl: imageUrl || data.image_url || data.imageUrl,
    merchant,
    amount: Number(draftObj.amount || data.amount || 0),
    currency: draftObj.currency || data.currency || 'INR',
    date: cleanDate,
    time: draftObj.time || undefined,
    transactionType:
      (draftObj.transaction_type || draftObj.transactionType || 'expense').toLowerCase() === 'income'
        ? 'income'
        : 'expense',
    paymentMethod: draftObj.payment_method || draftObj.paymentMethod || undefined,
    referenceId: draftObj.reference_id || draftObj.referenceId || draftObj.utr || undefined,
    notes: draftObj.notes || draftObj.description || '',
    accountMatch,
    categoryMatch,
    lineItems,
    warnings: Array.from(new Set(combinedWarnings)),
    duplicateWarning,
    confidenceScore: draftObj.confidence ?? data.confidence_score,
    rawText: data.raw_extraction ? JSON.stringify(data.raw_extraction) : draftObj.rawText,
  };
}

export const transactionImportsService = {
  /**
   * Upload an image (receipt, invoice, UPI screenshot) for AI processing
   * POST /api/transaction-imports/image
   */
  uploadImage: async (
    fileUri: string,
    mimeType: string = 'image/jpeg',
    fileName: string = 'receipt.jpg'
  ): Promise<TransactionImportDraft> => {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      // In web browser, fetch the blob URL to create a real File/Blob
      try {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } catch {
        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: mimeType,
        } as any);
      }
    } else {
      // React Native native FormData expects { uri, name, type }
      const cleanUri = Platform.OS === 'android' ? fileUri : fileUri.replace('file://', '');
      formData.append('file', {
        uri: cleanUri,
        name: fileName,
        type: mimeType,
      } as any);
    }

    const data = await apiRequest<TransactionImportResponse>('/api/transaction-imports/image', {
      method: 'POST',
      body: formData,
    });

    return parseImportDraftResponse(data, fileUri);
  },

  /**
   * Retrieve a specific transaction import draft
   * GET /api/transaction-imports/{import_id}
   */
  getById: async (importId: string): Promise<TransactionImportDraft> => {
    const data = await apiRequest<TransactionImportResponse>(
      `/api/transaction-imports/${importId}`,
      { method: 'GET' }
    );
    return parseImportDraftResponse(data);
  },

  /**
   * List recent transaction imports
   * GET /api/transaction-imports
   */
  list: async (limit = 20, skip = 0): Promise<TransactionImportResponse[]> => {
    return apiRequest<TransactionImportResponse[]>('/api/transaction-imports', {
      method: 'GET',
      params: { limit, skip },
    });
  },

  /**
   * Confirm the reviewed transaction draft and create the actual transaction record
   * POST /api/transaction-imports/{import_id}/confirm
   */
  confirmImport: async (
    importId: string,
    payload: ConfirmImportPayload
  ): Promise<any> => {
    const requestBody = {
      title: payload.title,
      amount: payload.amount,
      type: payload.transaction_type,
      category_id: payload.category_id,
      account_id: payload.account_id || null,
      credit_card_id: payload.credit_card_id || null,
      date: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString(),
      notes: payload.notes || null,
    };

    try {
      return await apiRequest<TransactionImportResponse>(
        `/api/transaction-imports/${importId}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );
    } catch (err: any) {
      // If endpoint doesn't exist on backend (404), fallback seamlessly to standard transaction creation
      if (err.status === 404) {
        return await transactionService.createTransaction({
          title: payload.title,
          amount: payload.amount,
          type: payload.transaction_type,
          category_id: payload.category_id,
          account_id: payload.account_id || null,
          credit_card_id: payload.credit_card_id || null,
          date: requestBody.date,
          notes: payload.notes || undefined,
        });
      }
      throw err;
    }
  },

  /**
   * Reject and cancel a transaction import draft
   * POST /api/transaction-imports/{import_id}/reject
   */
  rejectImport: async (importId: string): Promise<TransactionImportResponse> => {
    return apiRequest<TransactionImportResponse>(
      `/api/transaction-imports/${importId}/reject`,
      { method: 'POST' }
    );
  },

  /**
   * Alias for cancel (best effort)
   */
  cancelImport: async (importId: string): Promise<void> => {
    try {
      await transactionImportsService.rejectImport(importId);
    } catch {
      // Best effort cancellation
    }
  },
};
