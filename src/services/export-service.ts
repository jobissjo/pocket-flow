import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { suppressSecurityLock, resumeSecurityLock } from './security-context';
import type { TransactionResponse } from './types';

export interface ExportOptions {
  transactions: TransactionResponse[];
  dateRangeLabel: string;
  currencySymbol: string;
  currencyCode: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Generates an executive-ready HTML document for PDF printing
 */
function buildStatementHtml(options: ExportOptions): string {
  const {
    transactions,
    dateRangeLabel,
    currencySymbol,
    userName = 'Valued User',
    userEmail = '',
  } = options;

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((t) => {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const rowsHtml = transactions
    .map((t, idx) => {
      const isIncome = t.type === 'income';
      const dateStr = new Date(t.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const source = t.credit_card_name
        ? `💳 ${t.credit_card_name}`
        : t.account_name
        ? `🏦 ${t.account_name}`
        : 'Cash';

      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

      return `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 10px 12px; font-size: 11px; color: #64748B; white-space: nowrap;">${dateStr}</td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #0F172A;">
            ${escapeHtml(t.title)}
            ${t.notes ? `<div style="font-size: 10px; font-weight: 400; color: #94A3B8; margin-top: 2px;">${escapeHtml(t.notes)}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; font-size: 11px; color: #334155;">
            <span style="background-color: #F1F5F9; padding: 3px 8px; border-radius: 6px; font-weight: 500;">
              ${escapeHtml(t.category_name || 'General')}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 11px; color: #64748B;">${escapeHtml(source)}</td>
          <td style="padding: 10px 12px; font-size: 11px; text-align: center;">
            <span style="background-color: ${isIncome ? '#DCFCE7' : '#FEE2E2'}; color: ${isIncome ? '#15803D' : '#B91C1C'}; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase;">
              ${t.type}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 700; text-align: right; color: ${isIncome ? '#16A34A' : '#DC2626'};">
            ${isIncome ? '+' : '-'}${currencySymbol}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>PocketFlow Statement - ${dateRangeLabel}</title>
      <style>
        @page {
          margin: 20mm 15mm;
          size: A4 portrait;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0F172A;
          margin: 0;
          padding: 0;
          background-color: #FFFFFF;
          -webkit-print-color-adjust: exact;
        }
        .header-table {
          width: 100%;
          border-bottom: 2px solid #2563EB;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .brand-title {
          font-size: 24px;
          font-weight: 900;
          color: #2563EB;
          letter-spacing: 1.5px;
          margin: 0;
        }
        .brand-sub {
          font-size: 10px;
          color: #64748B;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .meta-text {
          font-size: 11px;
          color: #475569;
          text-align: right;
          line-height: 1.5;
        }
        .summary-grid {
          display: table;
          width: 100%;
          margin-bottom: 24px;
        }
        .summary-card {
          display: table-cell;
          width: 25%;
          padding: 12px;
          background-color: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          text-align: center;
        }
        .summary-card + .summary-card {
          border-left: 0;
        }
        .summary-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .summary-value {
          font-size: 16px;
          font-weight: 800;
        }
        .tx-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .tx-th {
          background-color: #0F172A;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          text-align: left;
        }
        .footer {
          margin-top: 30px;
          padding-top: 14px;
          border-top: 1px solid #E2E8F0;
          font-size: 10px;
          color: #94A3B8;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="vertical-align: top;">
            <div class="brand-title">POCKETFLOW</div>
            <div class="brand-sub">Official Transaction Statement</div>
          </td>
          <td class="meta-text" style="vertical-align: top;">
            <div><strong>Account Holder:</strong> ${escapeHtml(userName)}</div>
            ${userEmail ? `<div><strong>Email:</strong> ${escapeHtml(userEmail)}</div>` : ''}
            <div><strong>Period:</strong> ${escapeHtml(dateRangeLabel)}</div>
            <div><strong>Generated:</strong> ${generatedDate}</div>
          </td>
        </tr>
      </table>

      <!-- Summary Metrics Bar -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;">
        <tr>
          <td style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #16A34A; text-transform: uppercase;">Total Income</div>
            <div style="font-size: 16px; font-weight: 800; color: #15803D; margin-top: 4px;">
              +${currencySymbol}${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </td>
          <td style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #DC2626; text-transform: uppercase;">Total Expenses</div>
            <div style="font-size: 16px; font-weight: 800; color: #B91C1C; margin-top: 4px;">
              -${currencySymbol}${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </td>
          <td style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #2563EB; text-transform: uppercase;">Net Cashflow</div>
            <div style="font-size: 16px; font-weight: 800; color: ${netBalance >= 0 ? '#1D4ED8' : '#DC2626'}; margin-top: 4px;">
              ${netBalance >= 0 ? '+' : ''}${currencySymbol}${netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </td>
          <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Records</div>
            <div style="font-size: 16px; font-weight: 800; color: #0F172A; margin-top: 4px;">
              ${transactions.length}
            </div>
          </td>
        </tr>
      </table>

      <!-- Transactions Table -->
      <table class="tx-table">
        <thead>
          <tr>
            <th class="tx-th">Date</th>
            <th class="tx-th">Description / Title</th>
            <th class="tx-th">Category</th>
            <th class="tx-th">Source</th>
            <th class="tx-th" style="text-align: center;">Type</th>
            <th class="tx-th" style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94A3B8;">No transactions recorded in this period.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        Generated automatically by PocketFlow • Secure Ledger & Expense Tracker
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Exports statement as a styled PDF and prompts share/download
 */
export async function exportStatementToPdf(options: ExportOptions): Promise<void> {
  const html = buildStatementHtml(options);

  if (Platform.OS === 'web') {
    // Web printing or PDF preview
    await Print.printAsync({ html });
    return;
  }

  try {
    suppressSecurityLock(60000);
    const { uri } = await Print.printToFileAsync({
      html,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `PocketFlow Statement - ${options.dateRangeLabel}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } finally {
    setTimeout(() => {
      resumeSecurityLock();
    }, 1500);
  }
}

/**
 * Exports statement as a clean CSV spreadsheet and prompts share/download
 */
export async function exportStatementToCsv(options: ExportOptions): Promise<void> {
  const { transactions, currencyCode, dateRangeLabel } = options;

  const headers = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Currency', 'Payment Source', 'Notes'];

  const rows = transactions.map((t) => {
    const dateStr = new Date(t.date).toISOString().split('T')[0];
    const source = t.credit_card_name || t.account_name || 'Cash';
    return [
      dateStr,
      escapeCsv(t.title),
      t.type,
      escapeCsv(t.category_name || 'General'),
      String(t.amount),
      currencyCode,
      escapeCsv(source),
      escapeCsv(t.notes || ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  if (Platform.OS === 'web') {
    // Browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pocketflow_statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  try {
    suppressSecurityLock(60000);
    const filename = `pocketflow_${dateRangeLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;
    const destinationUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(destinationUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(destinationUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share PocketFlow CSV Statement',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } finally {
    setTimeout(() => {
      resumeSecurityLock();
    }, 1500);
  }
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
