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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { getDatabase, ChatMessage } from '@/services/db';
import { processAIQuery } from '@/services/ai';
import { useTheme } from '@/services/theme-context';

export default function AssistantScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { isDark } = useTheme();
  
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChatHistory();
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    try {
      const db = await getDatabase();
      // eslint-disable-next-line react-hooks/purity
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
          msg.role === 'user' && !isDark && { color: '#ffffff' },
          msg.role !== 'user' && !isDark && styles.textLight
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
          <View style={styles.chartContainer}>
            <Text style={[styles.aiMsgText, !isDark && styles.textLight]}>{msg.content}</Text>
            <View style={[styles.chartGlowContainer, !isDark && styles.chartGlowContainerLight]}>
              {parsed.data.map((item: any, idx: number) => {
                const colors = ['#a6c8ff', '#9e77ed', '#ffb4ab', '#fdba74'];
                const barColor = colors[idx % colors.length];
                return (
                  <View key={item.category} style={styles.chartRow}>
                    <View style={styles.chartMeta}>
                      <Text style={[styles.chartCatName, !isDark && styles.textLight]}>{item.category}</Text>
                      <Text style={[styles.chartCatAmt, !isDark && styles.textSecondaryLight]}>${item.amount.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.chatProgressBarBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
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
          <View style={styles.chartContainer}>
            <Text style={[styles.aiMsgText, !isDark && styles.textLight]}>{msg.content}</Text>
            <View style={[styles.chartGlowContainer, !isDark && styles.chartGlowContainerLight]}>
              {parsed.data.map((item: any) => {
                const barColor = item.percent > 90 ? '#ffb4ab' : item.percent > 75 ? '#9e77ed' : '#a6c8ff';
                return (
                  <View key={item.name} style={styles.chartRow}>
                    <View style={styles.chartMeta}>
                      <Text style={[styles.chartCatName, !isDark && styles.textLight]}>{item.name}</Text>
                      <Text style={[styles.chartCatAmt, !isDark && styles.textSecondaryLight]}>${item.spent.toFixed(0)} / ${item.limit}</Text>
                    </View>
                    <View style={[styles.chatProgressBarBg, !isDark && { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
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
      <Text style={[styles.aiMsgText, !isDark && styles.textLight]}>
        {msg.content}
      </Text>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ffffff' : '#0A0A0A'} />
          </TouchableOpacity>
          
          <View style={styles.headerAIProfile}>
            <View style={[styles.aiAvatar, !isDark && { backgroundColor: '#0A0A0A' }]}>
              <MaterialIcons name="auto-awesome" size={16} color={isDark ? '#0A0A0A' : '#ffffff'} />
            </View>
            <View>
              <Text style={[styles.headerTitle, !isDark && styles.textLight]}>WealthAI</Text>
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
            <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0A0A0A'} style={{ marginTop: 40 }} />
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
                    <View style={[styles.msgAIAvatar, !isDark && { backgroundColor: 'rgba(0, 0, 0, 0.05)' }]}>
                      <MaterialIcons name="auto-awesome" size={12} color={isDark ? '#ffffff' : '#0A0A0A'} />
                    </View>
                  )}
                  
                  <View style={styles.bubbleCol}>
                    {!isUser && <Text style={[styles.aiNameTag, !isDark && styles.textSecondaryLight]}>WealthAI</Text>}
                    <View style={[
                      styles.msgBubble, 
                      isUser 
                        ? (isDark ? styles.userBubble : styles.userBubbleLight) 
                        : (isDark ? styles.aiBubble : styles.aiBubbleLight)
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
              <View style={[styles.msgAIAvatar, !isDark && { backgroundColor: 'rgba(0, 0, 0, 0.05)' }]}>
                <MaterialIcons name="auto-awesome" size={12} color={isDark ? '#ffffff' : '#0A0A0A'} />
              </View>
              <View style={styles.bubbleCol}>
                <Text style={[styles.aiNameTag, !isDark && styles.textSecondaryLight]}>WealthAI</Text>
                <View style={[
                  styles.msgBubble, 
                  isDark ? styles.aiBubble : styles.aiBubbleLight, 
                  styles.typingBubble
                ]}>
                  <ActivityIndicator size="small" color="#8e9192" />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion Chips and Input Container */}
        <View style={[styles.bottomBarContainer, { backgroundColor: 'transparent' }]}>
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
          <View style={[styles.inputBar, !isDark && styles.inputBarLight]}>
            <TextInput
              style={[styles.textInput, !isDark && styles.textInputLight]}
              placeholder="Ask WealthAI anything..."
              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)'}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  textLight: {
    color: '#0A0A0A',
  },
  textSecondaryLight: {
    color: '#60646C',
  },
  aiBubbleLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  userBubbleLight: {
    backgroundColor: '#208aef',
    borderBottomRightRadius: 4,
  },
  suggestionChipLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  suggestionTextLight: {
    color: '#0A0A0A',
  },
  inputBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  textInputLight: {
    color: '#0A0A0A',
  },
  sendBtnLight: {
    backgroundColor: '#0A0A0A',
  },
  chartGlowContainerLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
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
