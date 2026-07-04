import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, Account, getSetting, setSetting, clearAllData, exportDatabaseToJson, importDatabaseFromJson } from '@/services/db';
import { useTheme } from '@/services/theme-context';
import { getCurrencySymbol } from '@/services/currency';
import { useSecurity } from '@/services/security-context';
import ReportModal from '@/components/report-modal';
import SubscriptionsModal from '@/components/subscriptions-modal';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const { biometricsEnabled, toggleBiometrics, lockVault, hasSecurity } = useSecurity();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Settings state
  const [currency, setCurrency] = useState('USD');
  const [username, setUsername] = useState('Alex');
  const [memberSince, setMemberSince] = useState('June 2026');

  // Modal visibility states
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [manageAccountsVisible, setManageAccountsVisible] = useState(false);
  const [accountFormVisible, setAccountFormVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [subsVisible, setSubsVisible] = useState(false);

  // Profile Edit fields
  const [editName, setEditName] = useState('');
  const [editMember, setEditMember] = useState('');

  // Account Form fields (for add/edit account)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'bank' | 'credit' | 'crypto' | 'digital'>('bank');
  const [accBalance, setAccBalance] = useState('');
  const [accDetails, setAccDetails] = useState('');
  const [accColor, setAccColor] = useState('#1e3a8a,#0f172a');

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      
      // Load accounts
      const rows = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(rows);

      // Load settings (biometrics is managed by SecurityContext)

      const curr = await getSetting('currency', 'USD');
      setCurrency(curr);

      const name = await getSetting('username', 'Alex');
      setUsername(name);

      const since = await getSetting('member_since', 'June 2026');
      setMemberSince(since);

    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadProfileData();
    }
  }, [isFocused]);

  const handleToggleBiometrics = async (val: boolean) => {
    if (!hasSecurity && val) {
      Alert.alert(
        'Not Supported',
        'Your device does not support biometric or passcode security, or it is not set up.'
      );
      return;
    }
    const success = await toggleBiometrics(val);
    if (!success && !val) {
      Alert.alert('Authentication Failed', 'Could not disable lock security.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    await setSetting('username', editName);
    await setSetting('member_since', editMember);
    setUsername(editName);
    setMemberSince(editMember);
    setEditProfileVisible(false);
  };

  const handleSelectCurrency = async (currCode: string) => {
    await setSetting('currency', currCode);
    setCurrency(currCode);
    setCurrencyVisible(false);
  };

  // Open Account form for new account
  const handleAddAccountClick = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('bank');
    setAccBalance('');
    setAccDetails('');
    setAccColor('#1e3a8a,#0f172a');
    setAccountFormVisible(true);
  };

  // Open Account form for editing
  const handleEditAccountClick = (acc: Account) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccBalance(acc.balance.toString());
    setAccDetails(acc.details || '');
    setAccColor(acc.color);
    setAccountFormVisible(true);
  };

  const handleSaveAccount = async () => {
    if (!accName.trim()) {
      Alert.alert('Error', 'Account name cannot be empty.');
      return;
    }
    const balNum = parseFloat(accBalance);
    if (isNaN(balNum)) {
      Alert.alert('Error', 'Please enter a valid balance.');
      return;
    }

    try {
      const db = await getDatabase();
      if (editingAccount) {
        // Edit existing account
        await db.runAsync(
          `UPDATE accounts SET name = ?, type = ?, balance = ?, details = ?, color = ? WHERE id = ?`,
          [accName, accType, balNum, accDetails, accColor, editingAccount.id]
        );
      } else {
        // Create new account
        const accId = 'acc-' + Date.now();
        await db.runAsync(
          `INSERT INTO accounts (id, name, type, balance, details, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [accId, accName, accType, balNum, accDetails, accColor]
        );
      }
      setAccountFormVisible(false);
      loadProfileData();
    } catch (e) {
      console.error('Error saving account:', e);
      Alert.alert('Error', 'Failed to save account.');
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account? All associated transactions will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM accounts WHERE id = ?', [accId]);
              loadProfileData();
            } catch (e) {
              console.error('Error deleting account:', e);
            }
          } 
        }
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'All local data will be exported as a JSON database backup. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Export', 
          onPress: async () => {
            try {
              await exportDatabaseToJson();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to export backup.');
            }
          } 
        }
      ]
    );
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'Restoring a backup will overwrite all current app data. This action cannot be undone. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restore Backup', 
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await importDatabaseFromJson();
              if (success) {
                Alert.alert('Success', 'Data restored successfully from backup.', [
                  { text: 'OK', onPress: () => loadProfileData() }
                ]);
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to import backup. Please ensure the file is a valid WealthFlow backup.');
            }
          } 
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Lock Vault', 'Are you sure you want to lock the vault? You will need to authenticate to access it again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', style: 'destructive', onPress: () => lockVault() }
    ]);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data?',
      'Are you absolutely sure you want to delete all accounts, transactions, goals, and start from scratch? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Everything', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Data Cleared', 'All data has been wiped. App will now reload options.', [
                {
                  text: 'OK',
                  onPress: () => {
                    loadProfileData();
                  }
                }
              ]);
            } catch (e) {
              Alert.alert('Error', 'Failed to clear data.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, !isDark && styles.containerLight]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* User Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarBorder}>
            <View style={[styles.avatarPlaceholder, !isDark && styles.avatarPlaceholderLight]}>
              <MaterialIcons name="person" size={56} color={isDark ? '#ffffff' : '#0A0A0A'} />
            </View>
            <TouchableOpacity 
              style={styles.editBtn}
              onPress={() => {
                setEditName(username);
                setEditMember(memberSince);
                setEditProfileVisible(true);
              }}
            >
              <MaterialIcons name="edit" size={14} color="#0A0A0A" />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.profileName, !isDark && styles.textLight]}>{username}</Text>
          <View style={styles.membershipTag}>
            <MaterialIcons name="stars" size={16} color="#a6c8ff" />
            <Text style={styles.membershipText}>Member Since {memberSince}</Text>
          </View>
        </View>

        {/* Linked Accounts Section */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardSectionTitle, !isDark && styles.textLight]}>Linked Accounts</Text>
            <TouchableOpacity onPress={() => setManageAccountsVisible(true)}>
              <Text style={styles.cardActionLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#0A0A0A'} style={{ marginVertical: 10 }} />
          ) : (
            <View style={styles.accountsRow}>
              {accounts.map(acc => (
                <TouchableOpacity 
                  key={acc.id} 
                  style={[styles.accountBadge, !isDark && styles.accountBadgeLight]}
                  onPress={() => handleEditAccountClick(acc)}
                >
                  <MaterialIcons 
                    name={acc.type === 'crypto' ? 'currency-bitcoin' : 'account-balance'} 
                    size={16} 
                    color={isDark ? '#ffffff' : '#0A0A0A'} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.accountBadgeText, !isDark && styles.textLight]}>
                    {acc.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addAccountBtn} onPress={handleAddAccountClick}>
                <MaterialIcons name="add" size={18} color="#8e9192" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Settings: App Theme (Manual Toggle) */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight]}>
          <View style={styles.settingsRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(166, 200, 255, 0.1)' }]}>
                <MaterialIcons name="brightness-6" size={22} color="#a6c8ff" />
              </View>
              <View>
                <Text style={[styles.settingTitle, !isDark && styles.textLight]}>Dark Mode</Text>
                <Text style={styles.settingDesc}>
                  Theme is set to {themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </View>
            </View>
            
            {/* Toggle dark mode directly */}
            <Switch
              value={isDark}
              onValueChange={async (val) => {
                await setThemeMode(val ? 'dark' : 'light');
              }}
              trackColor={{ false: '#3a3a3c', true: '#a6c8ff' }}
              thumbColor={isDark ? '#ffffff' : '#8e9192'}
            />
          </View>
        </View>

        {/* Security Module */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight]}>
          <View style={styles.settingsRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(166, 200, 255, 0.1)' }]}>
                <MaterialIcons name="fingerprint" size={22} color="#a6c8ff" />
              </View>
              <View>
                <Text style={[styles.settingTitle, !isDark && styles.textLight]}>Biometric Unlock</Text>
                <Text style={styles.settingDesc}>Fingerprint / FaceID enabled</Text>
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: '#3a3a3c', true: '#a6c8ff' }}
              thumbColor={biometricsEnabled ? '#ffffff' : '#8e9192'}
            />
          </View>
        </View>

        {/* Currency Module */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight]}>
          <TouchableOpacity 
            style={styles.settingsRow} 
            activeOpacity={0.7}
            onPress={() => setCurrencyVisible(true)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(158, 119, 237, 0.1)' }]}>
                <MaterialIcons name="payments" size={22} color="#9e77ed" />
              </View>
              <View>
                <Text style={[styles.settingTitle, !isDark && styles.textLight]}>Default Currency</Text>
                <Text style={styles.settingDesc}>{currency} ({getCurrencySymbol(currency)})</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </TouchableOpacity>
        </View>

        {/* Settings List */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight, { paddingVertical: 8 }]}>
          <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={() => setReportVisible(true)}>
            <View style={styles.listLeft}>
              <MaterialIcons name="assessment" size={22} color="#8e9192" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, !isDark && styles.textLight]}>Financial Reports (PDF / CSV)</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={() => setSubsVisible(true)}>
            <View style={styles.listLeft}>
              <MaterialIcons name="card-membership" size={22} color="#8e9192" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, !isDark && styles.textLight]}>Recurring Bills & Subscriptions</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={handleExportData}>
            <View style={styles.listLeft}>
              <MaterialIcons name="file-download" size={22} color="#8e9192" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, !isDark && styles.textLight]}>Export Backup (JSON)</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={handleImportData}>
            <View style={styles.listLeft}>
              <MaterialIcons name="file-upload" size={22} color="#8e9192" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, !isDark && styles.textLight]}>Import Backup (JSON)</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
            <View style={styles.listLeft}>
              <MaterialIcons name="help-outline" size={22} color="#8e9192" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, !isDark && styles.textLight]}>Help & Support</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#8e9192" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.glassCard, !isDark && styles.glassCardLight, { paddingVertical: 8, borderColor: 'rgba(255, 180, 171, 0.2)', borderWidth: 1 }]}>
          <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={handleClearAllData}>
            <View style={styles.listLeft}>
              <MaterialIcons name="delete-forever" size={22} color="#ffb4ab" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, { color: '#ffb4ab', fontWeight: '600' }]}>Clear All Data (Start Fresh)</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ffb4ab" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.listItem, { borderTopWidth: 1, borderTopColor: 'rgba(255,180,171,0.1)' }]} activeOpacity={0.7} onPress={handleLogout}>
            <View style={styles.listLeft}>
              <MaterialIcons name="logout" size={22} color="#ffb4ab" style={{ marginRight: 14 }} />
              <Text style={[styles.listTitle, { color: '#ffb4ab', fontWeight: '600' }]}>Logout / Lock Vault</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ffb4ab" />
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>WealthFlow Version 4.2.1-stable (Offline Mode)</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editProfileVisible}
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Edit Profile</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={[styles.modalInput, !isDark && styles.modalInputLight]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter name"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />

              <Text style={styles.fieldLabel}>Member Since</Text>
              <TextInput
                style={[styles.modalInput, !isDark && styles.modalInputLight]}
                value={editMember}
                onChangeText={setEditMember}
                placeholder="e.g. June 2026"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={currencyVisible}
        onRequestClose={() => setCurrencyVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCurrencyVisible(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Select Currency</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.modalBody}>
              {['USD', 'EUR', 'GBP', 'INR'].map((code) => {
                const isSelected = currency === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.currencyRow, 
                      isSelected && styles.activeCurrencyRow,
                      !isDark && styles.currencyRowLight
                    ]}
                    onPress={() => handleSelectCurrency(code)}
                  >
                    <Text style={[
                      styles.currencyCodeText, 
                      isSelected && styles.activeCurrencyText,
                      !isDark && styles.textLight
                    ]}>
                      {code} ({getCurrencySymbol(code)})
                    </Text>
                    {isSelected && <MaterialIcons name="check" size={20} color="#a6c8ff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Accounts Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={manageAccountsVisible}
        onRequestClose={() => setManageAccountsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setManageAccountsVisible(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Manage Accounts</Text>
              <TouchableOpacity onPress={handleAddAccountClick}>
                <MaterialIcons name="add" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {accounts.map(acc => (
                <View key={acc.id} style={[styles.manageAccRow, !isDark && styles.manageAccRowLight]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.manageAccName, !isDark && styles.textLight]}>{acc.name}</Text>
                    <Text style={styles.manageAccDetails}>{acc.type} • {acc.details}</Text>
                    <Text style={[styles.manageAccBal, !isDark && styles.textLight]}>
                      ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.manageAccActions}>
                    <TouchableOpacity onPress={() => handleEditAccountClick(acc)} style={styles.actionBtn}>
                      <MaterialIcons name="edit" size={20} color="#8e9192" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteAccount(acc.id)} style={styles.actionBtn}>
                      <MaterialIcons name="delete" size={20} color="#ffb4ab" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Account Form Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={accountFormVisible}
        onRequestClose={() => setAccountFormVisible(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.formCard, !isDark && styles.formCardLight]}>
            <Text style={[styles.formTitle, !isDark && styles.textLight]}>
              {editingAccount ? 'Edit Account' : 'New Account'}
            </Text>

            <Text style={styles.fieldLabel}>Account Name</Text>
            <TextInput
              style={[styles.modalInput, !isDark && styles.modalInputLight]}
              value={accName}
              onChangeText={setAccName}
              placeholder="e.g. Chase Checkings"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.fieldLabel}>Balance</Text>
            <TextInput
              style={[styles.modalInput, !isDark && styles.modalInputLight]}
              value={accBalance}
              onChangeText={setAccBalance}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.fieldLabel}>Card Details / Masked Number</Text>
            <TextInput
              style={[styles.modalInput, !isDark && styles.modalInputLight]}
              value={accDetails}
              onChangeText={setAccDetails}
              placeholder="e.g. •••• 8821 or wallet address"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={styles.fieldLabel}>Account Type</Text>
            <View style={styles.typeOptions}>
              {['bank', 'credit', 'crypto', 'digital'].map((type) => {
                const isSel = accType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOptionPill, isSel && styles.activeTypePill]}
                    onPress={() => setAccType(type as any)}
                  >
                    <Text style={[styles.typeOptionText, isSel && styles.activeTypeText]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity onPress={() => setAccountFormVisible(false)} style={styles.formCancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveAccount} style={styles.formSaveBtn}>
                <Text style={styles.saveBtnTextDark}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} />
      <SubscriptionsModal visible={subsVisible} onClose={() => setSubsVisible(false)} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  containerLight: {
    backgroundColor: '#f2f2f7',
  },
  textLight: {
    color: '#0A0A0A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarBorder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  editBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
  },
  membershipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(166, 200, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  membershipText: {
    color: '#a6c8ff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  glassCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    marginBottom: 16,
  },
  glassCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardActionLink: {
    color: '#a6c8ff',
    fontSize: 13,
    fontWeight: '600',
  },
  accountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  accountBadgeLight: {
    backgroundColor: '#f2f2f7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  accountBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  addAccountBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  settingDesc: {
    fontSize: 11,
    color: '#8e9192',
    marginTop: 2,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 180, 171, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 171, 0.15)',
    borderRadius: 18,
    height: 52,
    marginTop: 10,
    marginBottom: 20,
  },
  logoutText: {
    color: '#ffb4ab',
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 11,
    color: '#8e9192',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalBody: {
    padding: 24,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#8e9192',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  modalInputLight: {
    backgroundColor: '#f2f2f7',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    color: '#0A0A0A',
  },
  saveBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  currencyRowLight: {
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  activeCurrencyRow: {},
  currencyCodeText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  activeCurrencyText: {
    color: '#a6c8ff',
    fontWeight: '700',
  },
  manageAccRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  manageAccRowLight: {
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  manageAccName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  manageAccDetails: {
    fontSize: 11,
    color: '#8e9192',
    marginTop: 2,
  },
  manageAccBal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
  },
  manageAccActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 8,
  },
  formCard: {
    backgroundColor: '#0A0A0A',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  formCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    marginTop: 4,
  },
  typeOptionPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeTypePill: {
    backgroundColor: '#a6c8ff',
    borderColor: '#a6c8ff',
  },
  typeOptionText: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '500',
  },
  activeTypeText: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  formCancelBtn: {
    flex: 1,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  formSaveBtn: {
    flex: 1,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  cancelBtnText: {
    color: '#8e9192',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtnTextDark: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
  }
});
