import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getDatabase,
  Account,
  Investment,
  SIP,
  getInvestments,
  addInvestment,
  updateInvestmentPrice,
  buyMoreInvestment,
  sellInvestment,
  getSIPs,
  addSIP,
  pauseSIP,
  deleteSIP
} from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

interface InvestmentsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function InvestmentsModal({ visible, onClose }: InvestmentsModalProps) {
  const { formatAmount } = useCurrency();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'portfolio' | 'sips' | 'calculator'>('portfolio');
  const [loading, setLoading] = useState(true);

  // Data States
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [sips, setSIPs] = useState<SIP[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Modals Visibility
  const [addAssetVisible, setAddAssetVisible] = useState(false);
  const [buyMoreVisible, setBuyMoreVisible] = useState(false);
  const [sellVisible, setSellVisible] = useState(false);
  const [updatePriceVisible, setUpdatePriceVisible] = useState(false);
  const [addSIPVisible, setAddSIPVisible] = useState(false);

  // Selected Asset for operations
  const [selectedAsset, setSelectedAsset] = useState<Investment | null>(null);

  // Form States - Add Asset
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<'mutual_fund' | 'stock' | 'crypto' | 'gold' | 'other'>('mutual_fund');
  const [assetShares, setAssetShares] = useState('');
  const [assetBuyPrice, setAssetBuyPrice] = useState('');
  const [assetCurrentPrice, setAssetCurrentPrice] = useState('');
  const [assetAccount, setAssetAccount] = useState('');

  // Form States - Buy More / Sell
  const [opShares, setOpShares] = useState('');
  const [opPrice, setOpPrice] = useState('');
  const [opAccount, setOpAccount] = useState('');

  // Form States - Update Price
  const [newPrice, setNewPrice] = useState('');

  // Form States - Add SIP
  const [sipName, setSipName] = useState('');
  const [sipAssetId, setSipAssetId] = useState('');
  const [sipAmount, setSipAmount] = useState('');
  const [sipFrequency, setSipFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [sipNextDate, setSipNextDate] = useState('');
  const [sipAccount, setSipAccount] = useState('');

  // Calculator States
  const [calcMonthly, setCalcMonthly] = useState('500');
  const [calcReturn, setCalcReturn] = useState('12');
  const [calcYears, setCalcYears] = useState('10');

  const loadData = async () => {
    try {
      setLoading(true);
      const invs = await getInvestments();
      setInvestments(invs);

      const sipList = await getSIPs();
      setSIPs(sipList);

      const db = await getDatabase();
      const accs = await db.getAllAsync<Account>('SELECT * FROM accounts');
      setAccounts(accs);
      
      if (accs.length > 0) {
        setAssetAccount(accs[0].id);
        setOpAccount(accs[0].id);
        setSipAccount(accs[0].id);
      }
      if (invs.length > 0) {
        setSipAssetId(invs[0].id);
      }
    } catch (e) {
      console.error('Error loading investment details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [visible]);

  // Portfolio aggregates
  const totalInvestedValue = useMemo(() => {
    return investments.reduce((sum, inv) => sum + (inv.shares * inv.buy_price), 0);
  }, [investments]);

  const totalCurrentValue = useMemo(() => {
    return investments.reduce((sum, inv) => sum + (inv.shares * inv.current_price), 0);
  }, [investments]);

  const netReturn = totalCurrentValue - totalInvestedValue;
  const netReturnPercent = totalInvestedValue > 0 ? (netReturn / totalInvestedValue) * 100 : 0;

  // Form Handlers
  const handleAddAsset = async () => {
    if (!assetName.trim() || !assetShares.trim() || !assetBuyPrice.trim() || !assetCurrentPrice.trim()) {
      Alert.alert('Required Fields', 'Please fill in all asset fields.');
      return;
    }
    try {
      const shares = parseFloat(assetShares);
      const buyPrice = parseFloat(assetBuyPrice);
      const currentPrice = parseFloat(assetCurrentPrice);

      await addInvestment(assetName, assetType, shares, buyPrice, currentPrice, assetAccount);
      setAddAssetVisible(false);
      setAssetName('');
      setAssetShares('');
      setAssetBuyPrice('');
      setAssetCurrentPrice('');
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to save new asset.');
    }
  };

  const handleBuyMore = async () => {
    if (!selectedAsset || !opShares.trim() || !opPrice.trim()) {
      Alert.alert('Required Fields', 'Please enter valid shares and price.');
      return;
    }
    try {
      const shares = parseFloat(opShares);
      const price = parseFloat(opPrice);
      await buyMoreInvestment(selectedAsset.id, shares, price, opAccount);
      setBuyMoreVisible(false);
      setOpShares('');
      setOpPrice('');
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to buy additional holdings.');
    }
  };

  const handleSell = async () => {
    if (!selectedAsset || !opShares.trim() || !opPrice.trim()) {
      Alert.alert('Required Fields', 'Please enter valid shares and price.');
      return;
    }
    if (parseFloat(opShares) > selectedAsset.shares) {
      Alert.alert('Invalid Amount', 'You do not own enough shares.');
      return;
    }
    try {
      const shares = parseFloat(opShares);
      const price = parseFloat(opPrice);
      await sellInvestment(selectedAsset.id, shares, price, opAccount);
      setSellVisible(false);
      setOpShares('');
      setOpPrice('');
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to sell holdings.');
    }
  };

  const handleUpdatePrice = async () => {
    if (!selectedAsset || !newPrice.trim()) {
      Alert.alert('Required Fields', 'Please enter a price.');
      return;
    }
    try {
      const price = parseFloat(newPrice);
      await updateInvestmentPrice(selectedAsset.id, price);
      setUpdatePriceVisible(false);
      setNewPrice('');
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to update current asset price.');
    }
  };

  const handleAddSIP = async () => {
    if (!sipName.trim() || !sipAmount.trim() || !sipNextDate.trim() || !sipAssetId) {
      Alert.alert('Required Fields', 'Please fill in all SIP fields.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(sipNextDate)) {
      Alert.alert('Invalid Date', 'Date must be in YYYY-MM-DD format.');
      return;
    }
    try {
      const amt = parseFloat(sipAmount);
      await addSIP(sipName, sipAssetId, amt, sipFrequency, sipNextDate, sipAccount);
      setAddSIPVisible(false);
      setSipName('');
      setSipAmount('');
      setSipNextDate('');
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to add SIP.');
    }
  };

  const handleToggleSIPStatus = async (item: SIP, val: boolean) => {
    try {
      const newStatus = val ? 'active' : 'paused';
      await pauseSIP(item.id, newStatus);
      loadData();
    } catch (e) {
      console.error('Error toggling SIP status:', e);
    }
  };

  const handleDeleteSIP = async (id: string) => {
    Alert.alert(
      'Remove SIP',
      'Are you sure you want to stop this Systematic Investment Plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSIP(id);
              loadData();
            } catch (e) {
              console.error('Error deleting SIP:', e);
            }
          }
        }
      ]
    );
  };

  // Calculator Compound Interest logic
  const calculatorResults = useMemo(() => {
    const P = parseFloat(calcMonthly) || 0;
    const r = (parseFloat(calcReturn) || 0) / 100 / 12;
    const years = parseFloat(calcYears) || 0;
    const n = years * 12;

    if (P <= 0 || r <= 0 || n <= 0) {
      return { totalInvested: P * n, futureValue: P * n, gains: 0 };
    }

    // SIP Future Value formula = P * [((1 + r)^n - 1) / r] * (1 + r)
    const futureValue = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const totalInvested = P * n;
    const gains = Math.max(0, futureValue - totalInvested);

    return {
      totalInvested,
      futureValue,
      gains
    };
  }, [calcMonthly, calcReturn, calcYears]);

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'mutual_fund': return 'analytics';
      case 'stock': return 'trending-up';
      case 'crypto': return 'currency-bitcoin';
      case 'gold': return 'monetization-on';
      default: return 'bubble-chart';
    }
  };

  const getAssetTypeName = (type: string) => {
    switch (type) {
      case 'mutual_fund': return 'Mutual Fund';
      case 'stock': return 'Stock';
      case 'crypto': return 'Cryptocurrency';
      case 'gold': return 'Gold/Commodity';
      default: return 'Asset';
    }
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, !isDark && styles.containerLight]}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Investments & SIPs</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Tab Segmented Bar */}
        <View style={styles.tabBarWrapper}>
          <View style={[styles.tabBarContainer, !isDark && styles.tabToggleContainerLight]}>
            {(['portfolio', 'sips', 'calculator'] as const).map((tab) => {
              const isSel = activeTab === tab;
              const tabLabels = { portfolio: 'Portfolio', sips: 'SIP Tracker', calculator: 'Calculator' };
              const tabIcons = { portfolio: 'pie-chart', sips: 'rotate-right', calculator: 'calculate' };
              
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabBtn,
                    isSel && styles.activeTabBtn,
                    isSel && !isDark && { backgroundColor: '#0A0A0A' }
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <MaterialIcons
                    name={tabIcons[tab] as any}
                    size={15}
                    color={isSel ? (isDark ? '#0A0A0A' : '#ffffff') : '#8e9192'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.tabBtnText,
                    isSel && styles.activeTabBtnText,
                    isSel && !isDark && { color: '#ffffff' }
                  ]}>
                    {tabLabels[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0A0A0A'} style={{ marginVertical: 60 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {activeTab === 'portfolio' && (
              <>
                {/* Aggregated Valuation Card */}
                <View style={[styles.aggregateCard, !isDark && styles.glassCardLight]}>
                  <Text style={[styles.aggTitle, !isDark && styles.textSecondaryLight]}>Net Portfolio Valuation</Text>
                  <Text style={[styles.currentValueText, !isDark && styles.textLight]}>{formatAmount(totalCurrentValue)}</Text>
                  
                  <View style={styles.aggDivider} />

                  <View style={styles.aggDetailsRow}>
                    <View style={styles.aggDetailCol}>
                      <Text style={[styles.aggLabel, !isDark && styles.textSecondaryLight]}>Total Invested</Text>
                      <Text style={[styles.aggVal, !isDark && styles.textLight]}>{formatAmount(totalInvestedValue)}</Text>
                    </View>
                    <View style={styles.aggDetailCol}>
                      <Text style={[styles.aggLabel, !isDark && styles.textSecondaryLight]}>Total Returns</Text>
                      <Text style={[styles.aggVal, { color: netReturn >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                        {netReturn >= 0 ? '+' : ''}{formatAmount(netReturn)} ({netReturnPercent.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Asset List */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>Your Assets</Text>
                  <TouchableOpacity onPress={() => setAddAssetVisible(true)}>
                    <Text style={styles.sectionLink}>+ Add Asset</Text>
                  </TouchableOpacity>
                </View>

                {investments.length === 0 ? (
                  <View style={[styles.emptyStateCard, !isDark && styles.glassCardLight]}>
                    <MaterialIcons name="donut-large" size={44} color="#8e9192" style={{ marginBottom: 12 }} />
                    <Text style={[styles.emptyStateTitle, !isDark && styles.textLight]}>No Assets Logged</Text>
                    <Text style={[styles.emptyStateSub, !isDark && styles.textSecondaryLight]}>Start by adding your mutual funds, crypto, stocks, or commodities.</Text>
                  </View>
                ) : (
                  investments.map((item) => {
                    const investedCost = item.shares * item.buy_price;
                    const currentVal = item.shares * item.current_price;
                    const itemGains = currentVal - investedCost;
                    const itemGainsPercent = investedCost > 0 ? (itemGains / investedCost) * 100 : 0;

                    return (
                      <View key={item.id} style={[styles.assetCard, !isDark && styles.glassCardLight]}>
                        <View style={styles.assetHeader}>
                          <View style={styles.assetHeaderLeft}>
                            <View style={[styles.assetIconBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                              <MaterialIcons name={getAssetIcon(item.type)} size={20} color={isDark ? '#a6c8ff' : '#208aef'} />
                            </View>
                            <View>
                              <Text style={[styles.assetName, !isDark && styles.textLight]}>{item.name}</Text>
                              <Text style={[styles.assetType, !isDark && styles.textSecondaryLight]}>{getAssetTypeName(item.type)}</Text>
                            </View>
                          </View>
                          <Text style={[styles.assetValText, !isDark && styles.textLight]}>{formatAmount(currentVal)}</Text>
                        </View>

                        <View style={styles.assetMetaRow}>
                          <View>
                            <Text style={[styles.metaLabel, !isDark && styles.textSecondaryLight]}>Shares Held</Text>
                            <Text style={[styles.metaVal, !isDark && styles.textLight]}>{item.shares.toFixed(4)}</Text>
                          </View>
                          <View>
                            <Text style={[styles.metaLabel, !isDark && styles.textSecondaryLight]}>Avg Buy Price</Text>
                            <Text style={[styles.metaVal, !isDark && styles.textLight]}>{formatAmount(item.buy_price)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.metaLabel, !isDark && styles.textSecondaryLight]}>Asset Gains</Text>
                            <Text style={[styles.metaVal, { color: itemGains >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                              {itemGains >= 0 ? '+' : ''}{itemGainsPercent.toFixed(1)}%
                            </Text>
                          </View>
                        </View>

                        {/* Quick Asset Actions */}
                        <View style={[styles.assetActions, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => {
                              setSelectedAsset(item);
                              setNewPrice(item.current_price.toString());
                              setUpdatePriceVisible(true);
                            }}
                          >
                            <MaterialIcons name="edit" size={14} color="#8e9192" style={{ marginRight: 4 }} />
                            <Text style={styles.actionBtnText}>Update Price</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => {
                              setSelectedAsset(item);
                              setOpPrice(item.current_price.toString());
                              setBuyMoreVisible(true);
                            }}
                          >
                            <MaterialIcons name="add-circle-outline" size={14} color="#8e9192" style={{ marginRight: 4 }} />
                            <Text style={styles.actionBtnText}>Buy More</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => {
                              setSelectedAsset(item);
                              setOpPrice(item.current_price.toString());
                              setSellVisible(true);
                            }}
                          >
                            <MaterialIcons name="remove-circle-outline" size={14} color="#8e9192" style={{ marginRight: 4 }} />
                            <Text style={styles.actionBtnText}>Sell</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'sips' && (
              <>
                {/* Active SIP Cost Forecast */}
                <View style={[styles.aggregateCard, !isDark && styles.glassCardLight]}>
                  <Text style={[styles.aggTitle, !isDark && styles.textSecondaryLight]}>Systematic Investment Pledge</Text>
                  <Text style={[styles.currentValueText, !isDark && styles.textLight]}>
                    {formatAmount(
                      sips
                        .filter((s) => s.status === 'active')
                        .reduce((sum, s) => {
                          let monthly = s.amount;
                          if (s.frequency === 'weekly') monthly = s.amount * 4.33;
                          else if (s.frequency === 'yearly') monthly = s.amount / 12;
                          return sum + monthly;
                        }, 0),
                      0
                    )}
                    <Text style={{ fontSize: 14, fontWeight: 'normal', color: '#8e9192' }}>/mo</Text>
                  </Text>
                  <View style={styles.aggDivider} />
                  <Text style={[styles.aggLabel, !isDark && styles.textSecondaryLight, { textAlign: 'center', marginBottom: 0 }]}>
                    Pledged across {sips.filter((s) => s.status === 'active').length} active investment plans
                  </Text>
                </View>

                {/* SIP List */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, !isDark && styles.textLight]}>SIP Timelines</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (investments.length === 0) {
                        Alert.alert('No Assets Available', 'Please log an investment asset under the Portfolio tab before setting up a Systematic Investment Plan.');
                        return;
                      }
                      setAddSIPVisible(true);
                    }}
                  >
                    <Text style={sectionLinkStyle(isDark)}>+ Add SIP</Text>
                  </TouchableOpacity>
                </View>

                {sips.length === 0 ? (
                  <View style={[styles.emptyStateCard, !isDark && styles.glassCardLight]}>
                    <MaterialIcons name="rotate-right" size={44} color="#8e9192" style={{ marginBottom: 12 }} />
                    <Text style={[styles.emptyStateTitle, !isDark && styles.textLight]}>No Active SIPs</Text>
                    <Text style={[styles.emptyStateSub, !isDark && styles.textSecondaryLight]}>Set up periodic investment plans to buy assets automatically.</Text>
                  </View>
                ) : (
                  sips.map((item) => {
                    const targetAsset = investments.find((i) => i.id === item.investment_id);
                    const assetName = targetAsset ? targetAsset.name : 'Unknown Asset';
                    const isPaused = item.status === 'paused';
                    const freqLabel = item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1);

                    const formattedNextDate = new Date(item.next_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    return (
                      <View key={item.id} style={[styles.subCard, !isDark && styles.glassCardLight, isPaused && { opacity: 0.6 }]}>
                        <View style={styles.subCardLeft}>
                          <View style={[styles.subIconBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                            <MaterialIcons name="update" size={20} color={isDark ? '#a6c8ff' : '#208aef'} />
                          </View>
                          <View style={styles.subInfo}>
                            <Text style={[styles.subNameText, !isDark && styles.textLight]}>{item.name}</Text>
                            <Text style={[styles.subDescText, !isDark && styles.textSecondaryLight]}>
                              {freqLabel} &bull; Buying {assetName}
                            </Text>
                            <Text style={[styles.subDateText, !isDark && styles.textSecondaryLight]}>
                              Next: {formattedNextDate}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.subCardRight}>
                          <Text style={[styles.subAmountText, !isDark && styles.textLight]}>
                            {formatAmount(item.amount)}
                          </Text>

                          <View style={styles.subActions}>
                            <Switch
                              value={item.status === 'active'}
                              onValueChange={(val) => handleToggleSIPStatus(item, val)}
                              trackColor={{ false: '#767577', true: '#2ecc71' }}
                              thumbColor={Platform.OS === 'ios' ? '#ffffff' : (item.status === 'active' ? '#ffffff' : '#f4f3f4')}
                            />
                            <TouchableOpacity style={styles.subDeleteBtn} onPress={() => handleDeleteSIP(item.id)}>
                              <MaterialIcons name="delete-outline" size={18} color="#8e9192" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'calculator' && (
              <View style={[styles.calculatorCard, !isDark && styles.glassCardLight]}>
                <Text style={[styles.aggTitle, !isDark && styles.textSecondaryLight, { marginBottom: 20 }]}>SIP Wealth Calculator</Text>

                <View style={styles.calcInputGroup}>
                  <View style={styles.calcLabelRow}>
                    <Text style={[styles.calcInputLabel, !isDark && styles.textSecondaryLight]}>Monthly SIP Contribution</Text>
                    <Text style={[styles.calcValueLabel, !isDark && styles.textLight]}>{formatAmount(parseFloat(calcMonthly) || 0, 0)}</Text>
                  </View>
                  <TextInput
                    style={[styles.calcTextInput, !isDark && styles.calcTextInputLight]}
                    keyboardType="numeric"
                    value={calcMonthly}
                    onChangeText={setCalcMonthly}
                  />
                </View>

                <View style={styles.calcInputGroup}>
                  <View style={styles.calcLabelRow}>
                    <Text style={[styles.calcInputLabel, !isDark && styles.textSecondaryLight]}>Expected Return Rate (p.a. %)</Text>
                    <Text style={[styles.calcValueLabel, !isDark && styles.textLight]}>{calcReturn}%</Text>
                  </View>
                  <TextInput
                    style={[styles.calcTextInput, !isDark && styles.calcTextInputLight]}
                    keyboardType="numeric"
                    value={calcReturn}
                    onChangeText={setCalcReturn}
                  />
                </View>

                <View style={styles.calcInputGroup}>
                  <View style={styles.calcLabelRow}>
                    <Text style={[styles.calcInputLabel, !isDark && styles.textSecondaryLight]}>Duration (Years)</Text>
                    <Text style={[styles.calcValueLabel, !isDark && styles.textLight]}>{calcYears} Years</Text>
                  </View>
                  <TextInput
                    style={[styles.calcTextInput, !isDark && styles.calcTextInputLight]}
                    keyboardType="numeric"
                    value={calcYears}
                    onChangeText={setCalcYears}
                  />
                </View>

                <View style={[styles.calcResultsBox, !isDark && styles.calcResultsBoxLight]}>
                  <Text style={[styles.calcResultsTitle, !isDark && styles.textSecondaryLight]}>Wealth Accumulation Projection</Text>
                  <Text style={[styles.calcFutureWealth, !isDark && styles.textLight]}>{formatAmount(calculatorResults.futureValue, 0)}</Text>
                  
                  <View style={styles.aggDivider} />

                  <View style={styles.calcBreakdownRow}>
                    <View>
                      <Text style={[styles.calcBreakdownLabel, !isDark && styles.textSecondaryLight]}>Invested Capital</Text>
                      <Text style={[styles.calcBreakdownVal, !isDark && styles.textLight]}>{formatAmount(calculatorResults.totalInvested, 0)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.calcBreakdownLabel, !isDark && styles.textSecondaryLight]}>Est. Interest Gain</Text>
                      <Text style={[styles.calcBreakdownVal, { color: '#2ecc71' }]}>+{formatAmount(calculatorResults.gains, 0)}</Text>
                    </View>
                  </View>

                  {/* Growth Visualizer Bar */}
                  <View style={styles.calcProgressBarBg}>
                    <View
                      style={[
                        styles.calcProgressBarFill,
                        {
                          width: `${Math.round(
                            (calculatorResults.totalInvested / Math.max(calculatorResults.futureValue, 1)) * 100
                          )}%`
                        }
                      ]}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 9, color: '#8e9192' }}>Capital Invested</Text>
                    <Text style={{ fontSize: 9, color: '#2ecc71' }}>Interest Gain</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Spacer */}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        {/* Add Asset Modal */}
        <Modal animationType="slide" transparent={true} visible={addAssetVisible} onRequestClose={() => setAddAssetVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
              <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Add Investment Asset</Text>
                <TouchableOpacity onPress={() => setAddAssetVisible(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Asset Name</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="e.g. S&P 500 Index, Bitcoin, Apple Stock"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    value={assetName}
                    onChangeText={setAssetName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Asset Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {(['mutual_fund', 'stock', 'crypto', 'gold', 'other'] as const).map((type) => {
                      const isSel = assetType === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.accountOption,
                            !isDark && styles.accountOptionLight,
                            isSel && styles.activeAccountOption,
                            isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                          ]}
                          onPress={() => setAssetType(type)}
                        >
                          <Text style={[
                            styles.accountOptionText,
                            !isDark && styles.textSecondaryLight,
                            isSel && styles.activeAccountOptionText,
                            isSel && !isDark && { color: '#ffffff' }
                          ]}>
                            {getAssetTypeName(type)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Shares / Units Held</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={assetShares}
                    onChangeText={setAssetShares}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Average Purchase Price</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={assetBuyPrice}
                    onChangeText={setAssetBuyPrice}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Current Market Price</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={assetCurrentPrice}
                    onChangeText={setAssetCurrentPrice}
                  />
                </View>

                {accounts.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Funded From Account</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {accounts.map((acc) => {
                        const isSel = assetAccount === acc.id;
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.accountOption,
                              !isDark && styles.accountOptionLight,
                              isSel && styles.activeAccountOption,
                              isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                            ]}
                            onPress={() => setAssetAccount(acc.id)}
                          >
                            <Text style={[
                              styles.accountOptionText,
                              !isDark && styles.textSecondaryLight,
                              isSel && styles.activeAccountOptionText,
                              isSel && !isDark && { color: '#ffffff' }
                            ]}>
                              {acc.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleAddAsset}>
                  <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Log Asset</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Buy More Modal */}
        <Modal animationType="slide" transparent={true} visible={buyMoreVisible} onRequestClose={() => setBuyMoreVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
              <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Buy Additional Holdings</Text>
                <TouchableOpacity onPress={() => setBuyMoreVisible(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={{ color: '#8e9192', fontSize: 13, marginBottom: 20 }}>
                  Adding shares to <Text style={{ color: isDark ? '#ffffff' : '#0A0A0A', fontWeight: 'bold' }}>{selectedAsset?.name}</Text>
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Additional Shares</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={opShares}
                    onChangeText={setOpShares}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Purchase Price Per Share</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={opPrice}
                    onChangeText={setOpPrice}
                  />
                </View>

                {accounts.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Paid From Account</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {accounts.map((acc) => {
                        const isSel = opAccount === acc.id;
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.accountOption,
                              !isDark && styles.accountOptionLight,
                              isSel && styles.activeAccountOption,
                              isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                            ]}
                            onPress={() => setOpAccount(acc.id)}
                          >
                            <Text style={[
                              styles.accountOptionText,
                              !isDark && styles.textSecondaryLight,
                              isSel && styles.activeAccountOptionText,
                              isSel && !isDark && { color: '#ffffff' }
                            ]}>
                              {acc.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleBuyMore}>
                  <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Record Purchase</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Sell Holdings Modal */}
        <Modal animationType="slide" transparent={true} visible={sellVisible} onRequestClose={() => setSellVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
              <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Sell Holdings</Text>
                <TouchableOpacity onPress={() => setSellVisible(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={{ color: '#8e9192', fontSize: 13, marginBottom: 20 }}>
                  Selling shares of <Text style={{ color: isDark ? '#ffffff' : '#0A0A0A', fontWeight: 'bold' }}>{selectedAsset?.name}</Text> (You own {selectedAsset?.shares.toFixed(4)})
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Shares to Sell</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={opShares}
                    onChangeText={setOpShares}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Selling Price Per Share</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={opPrice}
                    onChangeText={setOpPrice}
                  />
                </View>

                {accounts.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Deposit Proceeds to Account</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {accounts.map((acc) => {
                        const isSel = opAccount === acc.id;
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.accountOption,
                              !isDark && styles.accountOptionLight,
                              isSel && styles.activeAccountOption,
                              isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                            ]}
                            onPress={() => setOpAccount(acc.id)}
                          >
                            <Text style={[
                              styles.accountOptionText,
                              !isDark && styles.textSecondaryLight,
                              isSel && styles.activeAccountOptionText,
                              isSel && !isDark && { color: '#ffffff' }
                            ]}>
                              {acc.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#e74c3c' }]} onPress={handleSell}>
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Record Sale</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Update Current Price Modal */}
        <Modal animationType="slide" transparent={true} visible={updatePriceVisible} onRequestClose={() => setUpdatePriceVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
              <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Update Market Price</Text>
                <TouchableOpacity onPress={() => setUpdatePriceVisible(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={{ color: '#8e9192', fontSize: 13, marginBottom: 20 }}>
                  Updating price of <Text style={{ color: isDark ? '#ffffff' : '#0A0A0A', fontWeight: 'bold' }}>{selectedAsset?.name}</Text> (Current: {formatAmount(selectedAsset?.current_price || 0)})
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>New Market Price Per Share</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={newPrice}
                    onChangeText={setNewPrice}
                  />
                </View>

                <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleUpdatePrice}>
                  <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Update Price</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Add SIP Modal */}
        <Modal animationType="slide" transparent={true} visible={addSIPVisible} onRequestClose={() => setAddSIPVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, !isDark && styles.modalContentLight]}>
              <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.modalTitle, !isDark && styles.textLight]}>Set Up Systematic Investment</Text>
                <TouchableOpacity onPress={() => setAddSIPVisible(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>SIP Plan Name</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="e.g. Monthly S&P Accumulation"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    value={sipName}
                    onChangeText={setSipName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Accumulating Asset</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {investments.map((inv) => {
                      const isSel = sipAssetId === inv.id;
                      return (
                        <TouchableOpacity
                          key={inv.id}
                          style={[
                            styles.accountOption,
                            !isDark && styles.accountOptionLight,
                            isSel && styles.activeAccountOption,
                            isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                          ]}
                          onPress={() => setSipAssetId(inv.id)}
                        >
                          <Text style={[
                            styles.accountOptionText,
                            !isDark && styles.textSecondaryLight,
                            isSel && styles.activeAccountOptionText,
                            isSel && !isDark && { color: '#ffffff' }
                          ]}>
                            {inv.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>SIP Amount Per Cycle</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    keyboardType="numeric"
                    value={sipAmount}
                    onChangeText={setSipAmount}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Frequency</Text>
                  <View style={[styles.formatToggle, !isDark && styles.formatToggleLight]}>
                    {(['weekly', 'monthly', 'yearly'] as const).map((freq) => {
                      const isSel = sipFrequency === freq;
                      return (
                        <TouchableOpacity
                          key={freq}
                          style={[
                            styles.formatBtn,
                            isSel && styles.activeFormatBtn,
                            isSel && !isDark && { backgroundColor: '#0A0A0A' }
                          ]}
                          onPress={() => setSipFrequency(freq)}
                        >
                          <Text style={[
                            styles.formatBtnText,
                            isSel && styles.activeFormatBtnText,
                            isSel && !isDark && { color: '#ffffff' }
                          ]}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Next Investment Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder="e.g. 2026-07-15"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                    value={sipNextDate}
                    onChangeText={setSipNextDate}
                  />
                </View>

                {accounts.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, !isDark && styles.textSecondaryLight]}>Pay From Account</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {accounts.map((acc) => {
                        const isSel = sipAccount === acc.id;
                        return (
                          <TouchableOpacity
                            key={acc.id}
                            style={[
                              styles.accountOption,
                              !isDark && styles.accountOptionLight,
                              isSel && styles.activeAccountOption,
                              isSel && !isDark && { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' }
                            ]}
                            onPress={() => setSipAccount(acc.id)}
                          >
                            <Text style={[
                              styles.accountOptionText,
                              !isDark && styles.textSecondaryLight,
                              isSel && styles.activeAccountOptionText,
                              isSel && !isDark && { color: '#ffffff' }
                            ]}>
                              {acc.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={[styles.submitBtn, !isDark && styles.submitBtnLight]} onPress={handleAddSIP}>
                  <Text style={[styles.submitBtnText, !isDark && styles.submitBtnTextLight]}>Start SIP</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </Modal>
  );
}

function sectionLinkStyle(isDark: boolean) {
  return {
    fontSize: 13,
    color: isDark ? '#a6c8ff' : '#208aef',
    fontWeight: '600' as const
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  containerLight: {
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
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
  tabBarWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabToggleContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTabBtn: {
    backgroundColor: '#ffffff',
  },
  tabBtnText: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '600',
  },
  activeTabBtnText: {
    color: '#0A0A0A',
  },
  scrollContent: {
    padding: 20,
  },
  aggregateCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  glassCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  aggTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#8e9192',
    marginBottom: 8,
  },
  currentValueText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  aggDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 16,
  },
  aggDetailsRow: {
    flexDirection: 'row',
  },
  aggDetailCol: {
    flex: 1,
  },
  aggLabel: {
    fontSize: 11,
    color: '#8e9192',
    marginBottom: 4,
  },
  aggVal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60A5FA',
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#8e9192',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  assetCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    marginBottom: 12,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  assetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  assetType: {
    fontSize: 11,
    color: '#8e9192',
    marginTop: 2,
  },
  assetValText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  assetMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  metaLabel: {
    fontSize: 10,
    color: '#8e9192',
    marginBottom: 4,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  assetActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  actionBtnText: {
    fontSize: 10,
    color: '#8e9192',
    fontWeight: '600',
  },
  subCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
  },
  subCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subInfo: {
    flex: 1,
  },
  subNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  subDescText: {
    fontSize: 12,
    color: '#8e9192',
    marginBottom: 2,
  },
  subDateText: {
    fontSize: 10,
    color: '#8e9192',
  },
  subCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  subAmountText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  subActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subDeleteBtn: {
    padding: 4,
  },
  calculatorCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 20,
  },
  calcInputGroup: {
    marginBottom: 16,
  },
  calcLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calcInputLabel: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '600',
  },
  calcValueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  calcTextInput: {
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  calcTextInputLight: {
    backgroundColor: '#F2F2F7',
    borderColor: 'rgba(0,0,0,0.05)',
    color: '#0A0A0A',
  },
  calcResultsBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  calcResultsBoxLight: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderColor: 'rgba(0,0,0,0.04)',
  },
  calcResultsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8e9192',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  calcFutureWealth: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  calcBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calcBreakdownLabel: {
    fontSize: 10,
    color: '#8e9192',
    marginBottom: 2,
  },
  calcBreakdownVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  calcProgressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    marginTop: 14,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  calcProgressBarFill: {
    height: '100%',
    backgroundColor: '#2ecc71',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
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
  formContainer: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  textInputLight: {
    backgroundColor: '#F2F2F7',
    borderColor: 'rgba(0,0,0,0.05)',
    color: '#0A0A0A',
  },
  formatToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 4,
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
  submitBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  submitBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtnTextLight: {
    color: '#ffffff',
  }
});
