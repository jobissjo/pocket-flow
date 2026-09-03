import { parseImportDraftResponse } from './transactionImports';

export function runParserTests() {
  console.log('--- Starting Mobile AI Transaction Import Parser Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // Test 1: FastAPI Swagger Schema (TransactionImportResponse with nested draft & items)
  try {
    const swaggerResponse = {
      id: '65e9f8a1b2c3d4e5f6a7b8c9',
      user_id: 'usr_123',
      file_name: 'swiggy_receipt.jpg',
      status: 'review',
      draft: {
        transaction_type: 'expense',
        title: 'Swiggy Food Order',
        amount: 450.0,
        currency: 'INR',
        merchant: {
          extracted_name: 'Swiggy',
          matched_id: 'mer_swiggy_1',
          matched_name: 'Swiggy',
          confidence: 0.98,
          status: 'matched',
        },
        account: {
          extracted_name: 'HDFC Corp',
          matched_id: 'acc_hdfc_sal',
          matched_name: 'HDFC Corporate Salary',
          confidence: 0.92,
          status: 'matched',
          last_four: '4821',
        },
        credit_card: {
          extracted_name: null,
          matched_id: null,
          matched_name: null,
          confidence: 0.0,
          status: 'not_found',
        },
        category: {
          extracted_name: 'Food',
          matched_id: 'cat_food',
          matched_name: 'Food & Dining',
          confidence: 0.95,
          status: 'matched',
        },
        transaction_date: '2026-09-01T14:30:00.000Z',
        payment_method: 'UPI',
        reference_id: 'UPI4928104829',
        notes: 'Lunch delivery',
        items: [
          { name: 'Paneer Butter Masala', quantity: 1, unit_price: 280, amount: 280 },
          { name: 'Butter Naan', quantity: 2, unit_price: 60, amount: 120 },
          { name: 'Delivery Charge', quantity: 1, unit_price: 50, amount: 50 },
        ],
        warnings: [],
        confidence: 0.96,
        is_duplicate: false,
        possible_duplicate_id: null,
        possible_duplicate_title: null,
      },
      warnings: [],
      error_message: null,
      created_at: '2026-09-01T14:31:00.000Z',
      updated_at: '2026-09-01T14:31:00.000Z',
    };

    const draft = parseImportDraftResponse(swaggerResponse, 'file:///tmp/receipt.jpg');

    assert(draft.importId === '65e9f8a1b2c3d4e5f6a7b8c9', 'Parses FastAPI mongo id as importId');
    assert(draft.merchant.name === 'Swiggy' && !draft.merchant.isNew, 'Parses matched merchant name');
    assert(draft.merchant.matchedMerchantId === 'mer_swiggy_1', 'Parses merchant matched ID');
    assert(draft.amount === 450.0, 'Parses total amount');
    assert(draft.date === '2026-09-01', 'Parses and formats date');
    assert(draft.accountMatch.status === 'matched', 'Parses account matched status');
    assert(draft.accountMatch.accountId === 'acc_hdfc_sal', 'Parses account matched ID');
    assert(draft.accountMatch.last4Digits === '4821', 'Parses last 4 digits');
    assert(draft.categoryMatch.status === 'matched', 'Parses category matched status');
    assert(draft.categoryMatch.categoryId === 'cat_food', 'Parses category matched ID');
    assert(draft.lineItems?.length === 3, 'Parses 3 itemized line items');
    assert(draft.lineItems?.[0].totalPrice === 280, 'Calculates item 1 price correctly');
    assert(draft.lineItems?.[1].totalPrice === 120, 'Calculates item 2 price correctly');
    assert(draft.duplicateWarning === undefined, 'No false duplicate flag');
  } catch (err) {
    console.error('Error in Test 1:', err);
    failed++;
  }

  // Test 2: Duplicate detection from Swagger response
  try {
    const duplicateSwaggerResponse = {
      id: 'imp_dup_001',
      user_id: 'usr_123',
      file_name: 'bill.png',
      status: 'review',
      draft: {
        title: 'Electricity Bill',
        amount: 2450.0,
        merchant: {
          extracted_name: 'MSEB Electricity',
          matched_id: null,
          status: 'not_found',
        },
        account: {
          extracted_name: 'Unknown',
          matched_id: null,
          status: 'ambiguous',
        },
        category: {
          extracted_name: 'Bills',
          matched_id: 'cat_bills',
          status: 'matched',
        },
        is_duplicate: true,
        possible_duplicate_id: 'tx_existing_889',
        possible_duplicate_title: 'MSEB Electricity',
        warnings: ['Please verify the payment date on the receipt.'],
      },
      created_at: '2026-09-01T14:31:00.000Z',
      updated_at: '2026-09-01T14:31:00.000Z',
    };

    const draft = parseImportDraftResponse(duplicateSwaggerResponse);

    assert(draft.merchant.isNew === true, 'Identifies new / unmatched merchant');
    assert(draft.accountMatch.status === 'ambiguous', 'Identifies ambiguous account');
    assert(draft.duplicateWarning?.isDuplicate === true, 'Flags duplicate transaction');
    assert(draft.duplicateWarning?.existingTransaction?.id === 'tx_existing_889', 'Parses duplicate transaction ID');
    assert(draft.warnings?.length === 1, 'Parses confidence warning');
  } catch (err) {
    console.error('Error in Test 2:', err);
    failed++;
  }

  // Test 3: Credit Card extraction prioritization
  try {
    const ccResponse = {
      id: 'imp_cc_001',
      draft: {
        title: 'Amazon Purchase',
        amount: 1999.0,
        credit_card: {
          extracted_name: 'HDFC Regalia',
          matched_id: 'cc_hdfc_regalia',
          matched_name: 'HDFC Regalia Card',
          confidence: 0.99,
          status: 'matched',
          last_four: '9012',
        },
        category: {
          extracted_name: 'Shopping',
          matched_id: 'cat_shopping',
          status: 'matched',
        },
      },
    };

    const draft = parseImportDraftResponse(ccResponse);
    assert(draft.accountMatch.sourceType === 'CREDIT_CARD', 'Identifies credit card source');
    assert(draft.accountMatch.creditCardId === 'cc_hdfc_regalia', 'Resolves credit card ID');
    assert(draft.accountMatch.last4Digits === '9012', 'Resolves card last 4 digits');
  } catch (err) {
    console.error('Error in Test 3:', err);
    failed++;
  }

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (typeof require !== 'undefined' && (require as any).main === module) {
  const { failed } = runParserTests();
  if (failed > 0) process.exit(1);
}
