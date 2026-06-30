import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { getDatabase, SavingsGoal } from '@/services/db';
import { useCurrency } from '@/services/currency';
import { useTheme } from '@/services/theme-context';

const { width } = Dimensions.get('window');

// Circular Progress Component
function CircularProgress({ percent, size = 60, strokeWidth = 5, color = '#ffffff' }: { percent: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={styles.svgRotate}>
        {/* Track circle */}
        <Circle
          stroke="rgba(255, 255, 255, 0.05)"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Fill circle */}
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.progressText, { color }]}>{percent}%</Text>
    </View>
  );
}

export default function GoalsScreen() {
  const isFocused = useIsFocused();
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // New Goal Form State
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('Savings');
  const [newGoalContribution, setNewGoalContribution] = useState('');

  const loadGoals = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals');
      setGoals(rows);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadGoals();
    }
  }, [isFocused]);

  const handleAddGoal = async () => {
    if (!newGoalName.trim() || !newGoalTarget.trim()) return;

    try {
      const db = await getDatabase();
      const id = 'goal-' + Date.now();
      const target = parseFloat(newGoalTarget);
      const current = parseFloat(newGoalCurrent || '0');
      const contrib = parseFloat(newGoalContribution || '0');

      await db.runAsync(
        `INSERT INTO savings_goals (id, name, target_amount, current_amount, category, monthly_contribution)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [id, newGoalName, target, current, newGoalCategory, contrib]
      );

      // Reset form
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalCurrent('');
      setNewGoalCategory('Savings');
      setNewGoalContribution('');
      setModalVisible(false);
      
      // Reload
      loadGoals();
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  // Calculate totals
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const aggregatePercent = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
  const totalContribution = goals.reduce((sum, g) => sum + (g.monthly_contribution || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Welcome Section */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, !isDark && styles.textLight]}>Your Goals</Text>
          <Text style={[styles.headerSubtitle, !isDark && styles.textSecondaryLight]}>
            {goals.length > 0 
              ? `You are on track to reach ${goals.filter(g => (g.current_amount/g.target_amount) > 0.5).length} of your ${goals.length} goals early.`
              : 'Add financial milestones to track your progress.'}
          </Text>
        </View>

        {/* AI Recommendation Card */}
        {goals.length > 0 && (
          <View style={styles.aiGlowCard}>
            <View style={styles.aiTag}>
              <MaterialIcons name="auto-awesome" size={14} color="#a6c8ff" />
              <Text style={styles.aiTagText}>AI Recommendation</Text>
            </View>
            <View style={styles.aiCardBody}>
              <View style={styles.aiTextContainer}>
                <Text style={styles.aiTitle}>Optimize Your Journey</Text>
                <Text style={styles.aiDesc}>
                  Increase contributions by {currencySymbol}50 to hit your 'New Car' goal 1 month early.
                </Text>
              </View>
              {Platform.OS === 'web' ? (
                <View style={styles.aiMediaPlaceholder}>
                  <MaterialIcons name="directions-car" size={32} color="#a6c8ff" />
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.aiActionBtn}>
              <Text style={styles.aiActionBtnText}>Apply Adjustment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Goals Bento Grid */}
        <View style={styles.goalsGrid}>
          {loading ? (
            <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0A0A0A"} style={{ marginVertical: 30 }} />
          ) : (
            <>
              {goals.map((g, idx) => {
                const percent = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
                // Colors based on index
                const colors = [isDark ? '#ffffff' : '#0A0A0A', '#a6c8ff', '#9e77ed', '#ffb4ab'];
                const color = colors[idx % colors.length];

                let iconName = 'stars';
                if (g.name.toLowerCase().includes('car')) {
                  iconName = 'directions-car';
                } else if (g.name.toLowerCase().includes('emergency') || g.name.toLowerCase().includes('fund')) {
                  iconName = 'verified-user';
                } else if (g.name.toLowerCase().includes('vacation') || g.name.toLowerCase().includes('travel')) {
                  iconName = 'flight';
                } else if (g.name.toLowerCase().includes('home') || g.name.toLowerCase().includes('house')) {
                  iconName = 'home';
                }

                return (
                  <View key={g.id} style={[styles.goalCard, !isDark && styles.glassCardLight]}>
                    <View style={styles.goalCardHeader}>
                      <View style={[styles.goalIconContainer, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                        <MaterialIcons name={iconName as any} size={24} color={color} />
                      </View>
                      <CircularProgress percent={percent} size={64} color={color} />
                    </View>

                    <View style={styles.goalCardFooter}>
                      <Text style={[styles.goalName, !isDark && styles.textLight]} numberOfLines={1}>{g.name}</Text>
                      <View style={styles.goalProgressRow}>
                        <View>
                          <Text style={[styles.goalSubLabel, !isDark && styles.textSecondaryLight]}>Current Balance</Text>
                          <Text style={[styles.goalValue, !isDark && styles.textLight]}>{formatAmount(g.current_amount, 0)}</Text>
                        </View>
                        <Text style={[styles.goalTarget, !isDark && styles.textSecondaryLight]}>Target: {formatAmount(g.target_amount, 0)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Add New Goal empty state card */}
              <TouchableOpacity 
                style={[styles.addGoalCard, !isDark && styles.glassCardLight]}
                onPress={() => setModalVisible(true)}
              >
                <View style={[styles.addGoalIconBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
                  <MaterialIcons name="add" size={28} color="#8e9192" />
                </View>
                <Text style={[styles.addGoalTitle, !isDark && styles.textLight]}>Add New Goal</Text>
                <Text style={[styles.addGoalSub, !isDark && styles.textSecondaryLight]}>Define a new financial milestone</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Aggregate Performance Stats */}
        {goals.length > 0 && (
          <View style={[styles.aggregateCard, !isDark && styles.glassCardLight]}>
            <Text style={[styles.aggTitle, !isDark && styles.textLight]}>Aggregate Performance</Text>
            
            <View style={styles.aggProgressRow}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${aggregatePercent}%` }]} />
              </View>
              <View style={styles.aggLabels}>
                <Text style={[styles.aggPercent, !isDark && styles.textSecondaryLight]}>Total Progress: {aggregatePercent}%</Text>
                <Text style={[styles.aggRatio, !isDark && styles.textLight]}>
                  {formatAmount(totalCurrent, 0)} / {formatAmount(totalTarget, 0)}
                </Text>
              </View>
            </View>

            <View style={styles.aggDetailsRow}>
              <View style={styles.aggDetailCol}>
                <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>Monthly Contribution</Text>
                <Text style={[styles.aggDetailValue, !isDark && styles.textLight]}>{formatAmount(totalContribution, 0)}</Text>
              </View>
              <View style={[
                styles.aggDetailCol, 
                { borderLeftWidth: 1, borderLeftColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', paddingLeft: 20 }
              ]}>
                <Text style={[styles.aggDetailLabel, !isDark && styles.textSecondaryLight]}>Projected Completion</Text>
                <Text style={[styles.aggDetailValue, !isDark && styles.textLight]}>Dec 2026</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Savings Goal</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Goal Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. New Macbook, House Deposit"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={newGoalName}
                  onChangeText={setNewGoalName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Target Amount ({currencySymbol})</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  value={newGoalTarget}
                  onChangeText={setNewGoalTarget}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Initial Balance ({currencySymbol})</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  value={newGoalCurrent}
                  onChangeText={setNewGoalCurrent}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Monthly Contribution ({currencySymbol})</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  value={newGoalContribution}
                  onChangeText={setNewGoalContribution}
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddGoal}>
                <Text style={styles.submitBtnText}>Create Goal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  containerLight: {
    backgroundColor: '#F2F2F7',
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
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerRow: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: Platform.OS === 'web' ? 'var(--font-display)' : 'normal',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8e9192',
    marginTop: 4,
    lineHeight: 18,
  },
  aiGlowCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(166, 200, 255, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(166, 200, 255, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
  },
  aiTagText: {
    fontSize: 10,
    color: '#a6c8ff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  aiDesc: {
    fontSize: 13,
    color: '#8e9192',
    lineHeight: 18,
  },
  aiMediaPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiActionBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  aiActionBtnText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  goalCard: {
    width: (width - 52) / 2,
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'space-between',
    minHeight: 190,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  goalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgRotate: {
    transform: [{ rotate: '-90deg' }],
  },
  progressText: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
  },
  goalCardFooter: {
    marginTop: 14,
  },
  goalName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  goalProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalSubLabel: {
    fontSize: 10,
    color: '#8e9192',
    marginBottom: 2,
  },
  goalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  goalTarget: {
    fontSize: 10,
    color: '#8e9192',
    marginBottom: 2,
  },
  addGoalCard: {
    width: (width - 52) / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 190,
  },
  addGoalIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  addGoalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  addGoalSub: {
    fontSize: 11,
    color: '#8e9192',
    textAlign: 'center',
  },
  aggregateCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
  },
  aggTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#8e9192',
    marginBottom: 14,
  },
  aggProgressRow: {
    marginBottom: 20,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  aggLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aggPercent: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '500',
  },
  aggRatio: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  aggDetailsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  aggDetailCol: {
    flex: 1,
  },
  aggDetailLabel: {
    fontSize: 11,
    color: '#8e9192',
    marginBottom: 4,
  },
  aggDetailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#131315',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
  submitBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  submitBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  }
});
