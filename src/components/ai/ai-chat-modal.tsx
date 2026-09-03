import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/services/theme-context';
import { hapticImpactMedium, hapticNotificationSuccess, hapticLight } from '@/services/haptics';
import { sendAIChatMessage, ChatMessage, ToolExecutionRecord } from '@/services/aiChatService';

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIAL_PROMPTS = [
  'How much did I spend this month?',
  'What are my upcoming EMI payments?',
  'What is my highest expense category?',
  'Can I afford to spend ₹5,000 this week?',
];

let messageCounter = 0;
function getNextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}_${messageCounter}`;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Hello! I am your **PocketFlow AI Assistant**. I can help you analyze your spending, check account balances, track EMIs, or give financial advice based on your ledger.',
    timestamp: 0,
  },
];

export function AIChatModal({ visible, onClose }: AIChatModalProps) {
  const { isDark } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [visible, messages]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    hapticImpactMedium();
    setInput('');
    Keyboard.dismiss();

    const userMessage: ChatMessage = {
      id: getNextMessageId('usr'),
      role: 'user',
      content: query,
      timestamp: 0,
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setLoading(true);

    try {
      const response = await sendAIChatMessage(query, updatedHistory);

      const aiMessage: ChatMessage = {
        id: getNextMessageId('ai'),
        role: 'assistant',
        content: response.reply,
        timestamp: 0,
        toolExecutions: response.tool_executions,
        provider: response.provider,
        model: response.model,
      };

      hapticNotificationSuccess();
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: getNextMessageId('err'),
        role: 'assistant',
        content: `Sorry, I encountered an error processing your request: ${err.message || 'Network error'}. Please try again.`,
        timestamp: 0,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleToolExpand = (msgId: string) => {
    hapticLight();
    setExpandedTools((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const clearChat = () => {
    hapticLight();
    setMessages([
      {
        id: getNextMessageId('welcome'),
        role: 'assistant',
        content:
          'Chat history cleared. How can I assist you with your finances today?',
        timestamp: 0,
      },
    ]);
  };

  const renderToolExecutions = (tools: ToolExecutionRecord[] | undefined, msgId: string) => {
    if (!tools || tools.length === 0) return null;
    const isExpanded = !!expandedTools[msgId];

    return (
      <View style={styles.toolSection}>
        <TouchableOpacity
          onPress={() => toggleToolExpand(msgId)}
          style={[
            styles.toolHeaderBtn,
            {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE',
            },
          ]}
        >
          <Ionicons name="flash" size={12} color="#6366F1" />
          <Text style={[styles.toolHeaderBtnText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
            {tools.length} tool{tools.length > 1 ? 's' : ''} executed ({tools.map((t) => t.tool_name).join(', ')})
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={isDark ? '#A5B4FC' : '#4F46E5'}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View
            style={[
              styles.toolDetailsBox,
              {
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            {tools.map((tool, idx) => (
              <View key={idx} style={styles.toolItem}>
                <View style={styles.toolNameRow}>
                  <Text style={[styles.toolName, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                    🔧 {tool.tool_name}
                  </Text>
                  <Text style={{ fontSize: 10, color: tool.success ? '#10B981' : '#EF4444' }}>
                    {tool.success ? '✓ Success' : '✕ Failed'}
                  </Text>
                </View>
                {tool.arguments && Object.keys(tool.arguments).length > 0 && (
                  <Text style={[styles.toolSnippet, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Args: {JSON.stringify(tool.arguments)}
                  </Text>
                )}
                {tool.result && (
                  <Text
                    numberOfLines={3}
                    style={[styles.toolSnippet, { color: isDark ? '#CBD5E1' : '#334155' }]}
                  >
                    Result: {tool.result}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          </View>
        )}

        <View style={{ maxWidth: '82%' }}>
          <View
            style={[
              styles.bubble,
              isUser
                ? styles.bubbleUser
                : [
                    styles.bubbleAssistant,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                    },
                  ],
            ]}
          >
            <Text
              style={[
                styles.messageText,
                {
                  color: isUser ? '#FFFFFF' : isDark ? '#F1F5F9' : '#0F172A',
                },
              ]}
            >
              {item.content}
            </Text>

            {item.model && (
              <Text
                style={[
                  styles.modelBadge,
                  { color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' },
                ]}
              >
                ⚡ {item.model}
              </Text>
            )}
          </View>

          {!isUser && renderToolExecutions(item.toolExecutions, item.id)}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#08080C' : '#F8FAFC' }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <Ionicons name="sparkles" size={18} color="#6366F1" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                PocketFlow AI
              </Text>
              <Text style={[styles.headerSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Financial Copilot & Advisor
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={clearChat} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { marginLeft: 8 }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          {/* Chat Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              loading ? (
                <View style={styles.loadingRow}>
                  <View style={styles.assistantAvatar}>
                    <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                  </View>
                  <View
                    style={[
                      styles.loadingBubble,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                      },
                    ]}
                  >
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={[styles.loadingText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Thinking & querying financial tools...
                    </Text>
                  </View>
                </View>
              ) : null
            }
          />

          {/* Quick Prompt Chips if message count is low */}
          {messages.length <= 2 && (
            <View style={styles.promptsContainer}>
              <Text style={[styles.promptsHeading, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                SUGGESTED QUESTIONS
              </Text>
              <View style={styles.promptsRow}>
                {INITIAL_PROMPTS.map((prompt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleSend(prompt)}
                    style={[
                      styles.promptChip,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Ionicons name="bulb-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text
                      style={[
                        styles.promptChipText,
                        { color: isDark ? '#E2E8F0' : '#334155' },
                      ]}
                    >
                      {prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Input Bar */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: isDark ? '#0D0E15' : '#FFFFFF',
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                },
              ]}
              placeholder="Ask about spending, limits, EMIs..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={() => handleSend()}
            />

            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={!input.trim() || loading}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: input.trim() && !loading ? '#2563EB' : isDark ? '#1E293B' : '#CBD5E1',
                },
              ]}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modelBadge: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '600',
  },
  toolSection: {
    marginTop: 6,
  },
  toolHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  toolHeaderBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  toolDetailsBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  toolItem: {
    gap: 2,
  },
  toolNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolName: {
    fontSize: 11,
    fontWeight: '700',
  },
  toolSnippet: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  promptsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  promptsHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  promptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  promptChipText: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
