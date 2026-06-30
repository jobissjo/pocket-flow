import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput,
  TouchableOpacity, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, ChatMessage } from '@/services/db';
import { processAIQuery } from '@/services/ai';
import { useTheme } from '@/services/theme-context';
import { useCurrency } from '@/services/currency';

interface AIAssistantModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AIAssistantModal({ visible, onClose }: AIAssistantModalProps) {
  const { isDark } = useTheme();
  const { formatAmount } = useCurrency();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const suggestionChips = [
    'Where did I spend most?',
    'Show my food expenses',
    'What is my budget status?',
    'Can I afford a laptop for $1,200?'
  ];

  const loadChatHistory = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ChatMessage>(
        'SELECT * FROM ai_chat_history ORDER BY timestamp ASC'
      );
      setMessages(rows);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadChatHistory();
    }
  }, [visible]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    try {
      const db = await getDatabase();
      const userMsgId = 'msg-' + Date.now();
      const userTimestamp = new Date().toISOString();

      // 1. Add user message locally and to DB
      const newUserMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: userTimestamp,
        type: 'text'
      };

      setMessages(prev => [...prev, newUserMsg]);
      setInputText('');
      setIsTyping(true);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      await db.runAsync(
        `INSERT INTO ai_chat_history (id, role, content, timestamp, type, structured_data)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [userMsgId, 'user', text, userTimestamp, 'text', null]
      );

      // 2. Process query offline using our AI Service
      const aiResponse = await processAIQuery(text);

      // Simulate a small delay for typing response (very satisfying UX)
      setTimeout(async () => {
        const aiMsgId = 'msg-' + (Date.now() + 1);
        const aiTimestamp = new Date().toISOString();
        
        const newAiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          content: aiResponse.content,
          timestamp: aiTimestamp,
          type: aiResponse.type,
          structured_data: aiResponse.structured_data
        };

        setIsTyping(false);
        setMessages(prev => [...prev, newAiMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        await db.runAsync(
          `INSERT INTO ai_chat_history (id, role, content, timestamp, type, structured_data)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [aiMsgId, 'assistant', aiResponse.content, aiTimestamp, aiResponse.type, aiResponse.structured_data || null]
        );
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    // Regular text rendering
    if (msg.type !== 'chart' || !msg.structured_data) {
      return (
        <Text style={[
          msg.role === 'user' ? styles.userMsgText : styles.aiMsgText,
          msg.role === 'user' ? (!isDark && styles.userTextLight) : (!isDark && styles.botTextLight)
        ]}>
          {msg.content}
        </Text>
      );
    }

    // Chart / custom component rendering
    try {
      const parsed = JSON.parse(msg.structured_data);
      
      if (parsed.chartType === 'spend_breakdown') {
        return (
          <View style={[styles.chartContainer, !isDark && styles.chartContainerLight]}>
            <Text style={[styles.aiMsgText, !isDark && styles.botTextLight]}>{msg.content}</Text>
            <View style={styles.chartGlowContainer}>
              {parsed.data.map((item: any, idx: number) => {
                const colors = ['#a6c8ff', '#9e77ed', '#ffb4ab', '#fdba74'];
                const barColor = colors[idx % colors.length];
                return (
                  <View key={item.category} style={styles.chartRow}>
                    <View style={styles.chartMeta}>
                      <Text style={[styles.chartCatName, !isDark && styles.textLight]}>{item.category}</Text>
                      <Text style={[styles.chartCatAmt, !isDark && styles.textSecondaryLight]}>{formatAmount(item.amount)}</Text>
                    </View>
                    <View style={styles.chatProgressBarBg}>
                      <View style={[styles.chatProgressBarFill, { width: `${item.percentage}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      }

      if (parsed.chartType === 'budget') {
        return (
          <View style={[styles.chartContainer, !isDark && styles.chartContainerLight]}>
            <Text style={[styles.aiMsgText, !isDark && styles.botTextLight]}>{msg.content}</Text>
            <View style={styles.chartGlowContainer}>
              {parsed.data.map((item: any) => {
                const barColor = item.percent > 90 ? '#ffb4ab' : item.percent > 75 ? '#9e77ed' : '#a6c8ff';
                return (
                  <View key={item.name} style={styles.chartRow}>
                    <View style={styles.chartMeta}>
                      <Text style={[styles.chartCatName, !isDark && styles.textLight]}>{item.name}</Text>
                      <Text style={[styles.chartCatAmt, !isDark && styles.textSecondaryLight]}>
                        {formatAmount(item.spent, 0)} / {formatAmount(item.limit, 0)}
                      </Text>
                    </View>
                    <View style={styles.chatProgressBarBg}>
                      <View style={[styles.chatProgressBarFill, { width: `${item.percent}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      }
    } catch (e) {
      console.error('Failed to parse message structured data:', e);
    }

    return (
      <Text style={[styles.aiMsgText, !isDark && styles.botTextLight]}>
        {msg.content}
      </Text>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Top Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            
            <View style={styles.headerAIProfile}>
              <View style={styles.aiAvatar}>
                <MaterialIcons name="auto-awesome" size={16} color="#0A0A0A" />
              </View>
              <View>
                <Text style={styles.headerTitle}>WealthAI</Text>
                <Text style={styles.headerStatus}>Offline Engine</Text>
              </View>
            </View>

            <View style={{ width: 24 }} />
          </View>

          {/* Chat Log Scroll Area */}
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.chatContainer}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#ffffff" style={{ marginTop: 40 }} />
            ) : (
              messages.map(msg => {
                const isUser = msg.role === 'user';
                return (
                  <View 
                    key={msg.id} 
                    style={[
                      styles.msgBubbleRow, 
                      isUser ? styles.userBubbleRow : styles.aiBubbleRow
                    ]}
                  >
                    {!isUser && (
                      <View style={styles.msgAIAvatar}>
                        <MaterialIcons name="auto-awesome" size={12} color="#ffffff" />
                      </View>
                    )}
                    
                    <View style={styles.bubbleCol}>
                      {!isUser && <Text style={styles.aiNameTag}>WealthAI</Text>}
                      <View style={[
                        styles.msgBubble, 
                        isUser ? styles.userBubble : styles.aiBubble
                      ]}>
                        {renderMessageContent(msg)}
                      </View>
                      <Text style={[styles.timestampText, isUser && { textAlign: 'right' }]}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* Typing Indicator */}
            {isTyping && (
              <View style={[styles.msgBubbleRow, styles.aiBubbleRow]}>
                <View style={styles.msgAIAvatar}>
                  <MaterialIcons name="auto-awesome" size={12} color="#ffffff" />
                </View>
                <View style={styles.bubbleCol}>
                  <Text style={styles.aiNameTag}>WealthAI</Text>
                  <View style={[styles.msgBubble, isDark ? styles.aiBubble : [styles.aiBubble, styles.botBubbleLight], styles.typingBubble]}>
                    <ActivityIndicator size="small" color="#8e9192" />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Suggestion Chips and Input Container */}
          <View style={[styles.bottomBarContainer, !isDark && { backgroundColor: '#F2F2F7' }]}>
            {/* Suggestion Chips list */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.suggestionRow}
            >
              {suggestionChips.map(chip => (
                <TouchableOpacity 
                  key={chip} 
                  style={[styles.suggestionChip, !isDark && styles.suggestionChipLight]}
                  onPress={() => handleSend(chip)}
                >
                  <Text style={[styles.suggestionText, !isDark && styles.suggestionTextLight]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Chat Input Bar */}
            <View style={[styles.inputBar, !isDark && styles.textInputLight]}>
              <TextInput
                style={[styles.textInput, !isDark && styles.textLight]}
                placeholder="Ask WealthAI anything..."
                placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend(inputText)}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !isDark && styles.sendBtnLight]}
                onPress={() => handleSend(inputText)}
              >
                <MaterialIcons name="arrow-upward" size={20} color={isDark ? "#0A0A0A" : "#ffffff"} />
              </TouchableOpacity>
            </View>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  headerLight: {
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  suggestionChipLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  suggestionTextLight: {
    color: '#60646C',
  },
  inputAreaLight: {
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#ffffff',
  },
  textInputLight: {
    backgroundColor: '#F2F2F7',
    color: '#0A0A0A',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  sendBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  botBubbleLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userBubbleLight: {
    backgroundColor: '#0A0A0A',
  },
  userTextLight: {
    color: '#ffffff',
  },
  botTextLight: {
    color: '#0A0A0A',
  },
  chartContainerLight: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerAIProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerStatus: {
    fontSize: 10,
    color: '#a6c8ff',
    fontWeight: '600',
  },
  chatContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexGrow: 1,
  },
  msgBubbleRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userBubbleRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  aiBubbleRow: {
    alignSelf: 'flex-start',
  },
  msgAIAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 18,
  },
  bubbleCol: {
    flexDirection: 'column',
  },
  aiNameTag: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
  },
  msgBubble: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubble: {
    backgroundColor: '#ffffff',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'rgba(28, 28, 30, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomLeftRadius: 4,
  },
  typingBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  userMsgText: {
    color: '#0A0A0A',
    fontSize: 14,
    lineHeight: 20,
  },
  aiMsgText: {
    color: '#e4e2e4',
    fontSize: 14,
    lineHeight: 20,
  },
  timestampText: {
    fontSize: 10,
    color: '#8e9192',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  bottomBarContainer: {
    backgroundColor: '#0A0A0A',
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,
  },
  suggestionRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 10,
  },
  suggestionChip: {
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.7)',
    borderRadius: 24,
    marginHorizontal: 20,
    paddingHorizontal: 8,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 12,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    width: '100%',
  },
  chartGlowContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  chartRow: {
    marginBottom: 10,
  },
  chartMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chartCatName: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  chartCatAmt: {
    fontSize: 12,
    color: '#8e9192',
    fontWeight: '600',
  },
  chatProgressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  chatProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  }
});
