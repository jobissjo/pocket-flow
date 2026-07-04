import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase, Account, getSetting } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ReportModal({ visible, onClose }: ReportModalProps) {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');

  // Month & Year state (defaults to current month/year)
  const [selectedDate, setSelectedDate] = useState(new Date());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const rows = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(rows);
    } catch (e) {
      console.error('Failed to load accounts for report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAccounts();
    }
  }, [visible]);

  const handlePrevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const db = await getDatabase();
      const username = await getSetting('username', 'Alex');

      // Calculate start and end date for the selected month
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 1).toISOString();

      // Query transactions
      let query = `SELECT t.*, a.name as account_name 
                   FROM transactions t 
                   JOIN accounts a ON t.account_id = a.id
                   WHERE t.date >= ? AND t.date < ?`;
      const params: any[] = [startDate, endDate];

      if (selectedAccount !== 'all') {
        query += ` AND t.account_id = ?`;
        params.push(selectedAccount);
      }

      query += ` ORDER BY t.date ASC`;
      const txs = await db.getAllAsync<any>(query, params);

      if (txs.length === 0) {
        Alert.alert('No Data', 'No transactions found for the selected period.');
        setGenerating(false);
        return;
      }

      // Generate reports depending on format
      if (format === 'csv') {
        await generateAndShareCsv(txs);
      } else {
        await generateAndSharePdf(txs, username);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate financial report.');
    } finally {
      setGenerating(false);
    }
  };

  const generateAndShareCsv = async (txs: any[]) => {
    let csvContent = 'Date,Type,Category,Note,Account,Amount\n';

    txs.forEach((tx) => {
      const date = new Date(tx.date).toLocaleDateString();
      const type = tx.type;
      const category = tx.category;
      const note = tx.note ? `"${tx.note.replace(/"/g, '""')}"` : '';
      const account = tx.account_name;
      const amount = tx.amount;

      csvContent += `${date},${type},${category},${note},${account},${amount}\n`;
    });

    const filename = `WealthFlow_Report_${selectedDate.getFullYear()}_${selectedDate.getMonth() + 1}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV Report'
      });
    }
  };

  const generateAndSharePdf = async (txs: any[], username: string) => {
    // Calculate summaries
    const income = txs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = txs.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const net = income - expenses;

    const monthStr = months[selectedDate.getMonth()];
    const yearStr = selectedDate.getFullYear();
    const period = `${monthStr} ${yearStr}`;

    const rowsHtml = txs
      .map((tx) => {
        const isExp = tx.amount < 0;
        const color = isExp ? '#ff4d4d' : '#2ecc71';
        const formattedDate = new Date(tx.date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const amtStr = (tx.amount > 0 ? '+' : '') + formatAmount(tx.amount);
        return `
          <tr>
            <td>${formattedDate}</td>
            <td>${tx.account_name}</td>
            <td><span class="category-badge">${tx.category}</span></td>
            <td>${tx.note || tx.category}</td>
            <td style="color: ${color}; font-weight: bold; text-align: right;">${amtStr}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            padding: 40px;
            background-color: #ffffff;
            margin: 0;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #eaeaea;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 2px;
            color: #0A0A0A;
          }
          .meta {
            text-align: right;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 5px 0;
          }
          .subtitle {
            font-size: 13px;
            color: #8e9192;
            margin: 0;
          }
          .summary-container {
            display: flex;
            gap: 20px;
            margin-bottom: 40px;
          }
          .summary-card {
            flex: 1;
            background: #f8f9fa;
            border: 1px solid #eaeaea;
            border-radius: 12px;
            padding: 16px;
          }
          .summary-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #8e9192;
            margin-bottom: 6px;
          }
          .summary-value {
            font-size: 20px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f1f2f6;
            color: #2c3e50;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eaeaea;
          }
          td {
            padding: 12px;
            font-size: 13px;
            border-bottom: 1px solid #eaeaea;
            color: #4a4a4a;
          }
          tr:nth-child(even) {
            background-color: #fafafa;
          }
          .category-badge {
            background-color: #f1f2f6;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #57606f;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: #8e9192;
            border-top: 1px solid #eaeaea;
            padding-top: 20px;
            margin-top: 50px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">POCKETFLOW</div>
          <div class="meta">
            <h1 class="title">Financial Statement</h1>
            <p class="subtitle">Statement Period: ${period}</p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px;"><strong>Account Owner:</strong> ${username}</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #8e9192;">Generated locally on ${new Date().toLocaleDateString()} (Secure Offline Crypt)</p>
        </div>

        <div class="summary-container">
          <div class="summary-card">
            <div class="summary-label">Total Deposits</div>
            <div class="summary-value" style="color: #2ecc71;">+${formatAmount(income)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Outflows</div>
            <div class="summary-value" style="color: #ff4d4d;">-${formatAmount(expenses).replace('-', '')}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Net Balance Change</div>
            <div class="summary-value" style="color: ${net >= 0 ? '#2ecc71' : '#ff4d4d'};">
              ${net >= 0 ? '+' : ''}${formatAmount(net)}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%">Date</th>
              <th style="width: 20%">Account</th>
              <th style="width: 15%">Category</th>
              <th style="width: 35%">Note</th>
              <th style="width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <p>PocketFlow Vault Statement &bull; Thank you for tracking with us &bull; Confidential Data</p>
        </div>
      </body>
      </html>
    `;

    const filename = `WealthFlow_Report_${selectedDate.getFullYear()}_${selectedDate.getMonth() + 1}.pdf`;

    if (Platform.OS === 'web') {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const response = await fetch(uri);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Export PDF Statement'
      });
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
            <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Financial Reports</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContainer}>
            
            {/* Month/Year Selector */}
            <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Report Month</Text>
            <View style={[styles.monthSelector, !isDark && styles.monthSelectorLight]}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
                <MaterialIcons name="chevron-left" size={28} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
              <Text style={[styles.monthText, !isDark && styles.textLight]}>
                {months[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.arrowBtn}>
                <MaterialIcons name="chevron-right" size={28} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
            </View>

            {/* Account Selector */}
            <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Filter By Account</Text>
            {loading ? (
              <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#0A0A0A'} style={{ marginVertical: 10 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
                <TouchableOpacity
                  style={[
                    styles.accountOption,
                    !isDark && styles.accountOptionLight,
                    selectedAccount === 'all' && styles.activeAccountOption,
                    selectedAccount === 'all' && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                  ]}
                  onPress={() => setSelectedAccount('all')}
                >
                  <Text style={[
                    styles.accountOptionText,
                    !isDark && styles.textSecondaryLight,
                    selectedAccount === 'all' && styles.activeAccountOptionText,
                    selectedAccount === 'all' && !isDark && { color: '#ffffff' }
                  ]}>
                    All Accounts
                  </Text>
                </TouchableOpacity>
                {accounts.map((acc) => {
                  const isSelected = selectedAccount === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.accountOption,
                        !isDark && styles.accountOptionLight,
                        isSelected && styles.activeAccountOption,
                        isSelected && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                      ]}
                      onPress={() => setSelectedAccount(acc.id)}
                    >
                      <Text style={[
                        styles.accountOptionText,
                        !isDark && styles.textSecondaryLight,
                        isSelected && styles.activeAccountOptionText,
                        isSelected && !isDark && { color: '#ffffff' }
                      ]}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Format Selector */}
            <Text style={[styles.fieldLabel, !isDark && styles.textSecondaryLight]}>Export Format</Text>
            <View style={[styles.formatToggle, !isDark && styles.formatToggleLight]}>
              <TouchableOpacity
                style={[
                  styles.formatBtn,
                  format === 'pdf' && styles.activeFormatBtn,
                  format === 'pdf' && !isDark && { backgroundColor: '#0A0A0A' }
                ]}
                onPress={() => setFormat('pdf')}
              >
                <MaterialIcons
                  name="picture-as-pdf"
                  size={16}
                  color={format === 'pdf' ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.formatBtnText,
                  format === 'pdf' && styles.activeFormatBtnText,
                  format === 'pdf' && !isDark && { color: '#ffffff' }
                ]}>PDF Document</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.formatBtn,
                  format === 'csv' && styles.activeFormatBtn,
                  format === 'csv' && !isDark && { backgroundColor: '#0A0A0A' }
                ]}
                onPress={() => setFormat('csv')}
              >
                <MaterialIcons
                  name="grid-on"
                  size={16}
                  color={format === 'csv' ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.formatBtnText,
                  format === 'csv' && styles.activeFormatBtnText,
                  format === 'csv' && !isDark && { color: '#ffffff' }
                ]}>CSV Spreadsheet</Text>
              </TouchableOpacity>
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[styles.generateBtn, !isDark && styles.generateBtnLight]}
              onPress={generateReport}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={isDark ? '#0A0A0A' : '#ffffff'} />
              ) : (
                <>
                  <MaterialIcons
                    name="cloud-download"
                    size={20}
                    color={isDark ? '#0A0A0A' : '#ffffff'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.generateBtnText, !isDark && styles.generateBtnTextLight]}>
                    Generate & Share
                  </Text>
                </>
              )}
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  formContainer: {
    padding: 24,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  monthSelectorLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  arrowBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  accountsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 24,
  },
  accountOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  accountOptionLight: {
    backgroundColor: '#f2f2f7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeAccountOption: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  accountOptionText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '500',
  },
  activeAccountOptionText: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  formatToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  formatToggleLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  formatBtn: {
    flex: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  activeFormatBtn: {
    backgroundColor: '#ffffff',
  },
  formatBtnText: {
    color: '#8e9192',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFormatBtnText: {
    color: '#0A0A0A',
  },
  generateBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 4,
  },
  generateBtnLight: {
    backgroundColor: '#0A0A0A',
    shadowColor: '#000000',
  },
  generateBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
  generateBtnTextLight: {
    color: '#ffffff',
  }
});
