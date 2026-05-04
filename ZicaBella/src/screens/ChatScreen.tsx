import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import { useColors } from '../constants/colors';
import { useUIStore } from '../store/uiStore';
import GlassHeader from '../components/GlassHeader';
import { Typography } from '../components/Typography';
import { haptics } from '../utils/haptics';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  createdAt: Date;
  toolsUsed?: number;
  isError?: boolean;
}

// ─── Quick prompts (customer-facing) ─────────────

const QUICK_PROMPTS = [
  { label: 'Size guide', icon: 'shirt-outline' },
  { label: 'Track my order', icon: 'location-outline' },
  { label: 'Return policy', icon: 'refresh-outline' },
  { label: 'Trending now', icon: 'flame-outline' },
  { label: 'Payment options', icon: 'card-outline' },
  { label: 'Fabric quality', icon: 'diamond-outline' },
];

// ─── Admin quick prompts ─────────────────────────

const ADMIN_QUICK_PROMPTS = [
  { label: "Today's briefing", icon: 'sunny-outline' },
  { label: 'Low stock alert', icon: 'alert-circle-outline' },
  { label: 'Orders update', icon: 'cart-outline' },
  { label: 'Production status', icon: 'build-outline' },
];

// ─── Claude API call ─────────────────────────────

async function callClaudeAPI(
  message: string,
  history: { role: string; content: string }[],
  userContext?: any
): Promise<{ response: string; conversationHistory: any[]; toolsUsed: number }> {
  const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';

  const res = await fetch(`${APP_URL}/api/app/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationHistory: history, userContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  return res.json();
}

// ─── Message Bubble ──────────────────────────────

const MessageBubble = memo(({ item }: { item: Message }) => {
  const isUser = item.isUser;
  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(20)}
      style={[msgStyles.row, isUser && msgStyles.rowRight]}
    >
      <View style={[
        msgStyles.bubble,
        isUser ? msgStyles.userBubble : msgStyles.aiBubble,
        !isUser && msgStyles.aiBubbleDecoration,
        item.isError && msgStyles.errorBubble,
      ]}>
        <Text style={[msgStyles.text, { color: '#FFF' }]}>
          {item.content}
        </Text>
        <View style={msgStyles.metaRow}>
          {item.toolsUsed ? (
            <Typography size={7} weight="700" color="rgba(138, 110, 255, 0.5)" style={{ letterSpacing: 1 }}>
              ⚡ {item.toolsUsed} TOOL{item.toolsUsed > 1 ? 'S' : ''}
            </Typography>
          ) : null}
          <Typography size={8} weight="300" color="rgba(255,255,255,0.3)" style={msgStyles.time}>
            {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </View>
      </View>
    </Animated.View>
  );
});

// ─── Main Screen ─────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.email?.endsWith('@zicabella.com') || false; 
  const flatListRef = useRef<FlatList>(null);

  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);
  const isTabBarVisible = useUIStore(s => s.isTabBarVisible);
  const inputTranslateY = useSharedValue(0);

  useEffect(() => {
    inputTranslateY.value = withTiming(isTabBarVisible ? 0 : 70, {
      duration: 300,
      easing: Easing.bezier(0.33, 1, 0.68, 1),
    });
  }, [isTabBarVisible]);

  const inputAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: inputTranslateY.value }],
  }));

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;

    Keyboard.dismiss();
    setInput('');
    haptics.buttonTap();

    const userMsg: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const userContext = user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      } : undefined;

      const data = await callClaudeAPI(content, conversationHistory, userContext);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        isUser: false,
        createdAt: new Date(),
        toolsUsed: data.toolsUsed || 0,
      };

      setMessages(prev => [...prev, aiMsg]);
      setConversationHistory(data.conversationHistory || []);
      haptics.success();
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        content: `⚠️ ${err.message || 'Could not reach Zica AI. Please try again.'}`,
        isUser: false,
        createdAt: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, conversationHistory]);

  const quickPrompts = isAdmin
    ? [...ADMIN_QUICK_PROMPTS, ...QUICK_PROMPTS.slice(0, 2)]
    : QUICK_PROMPTS;

  const renderOnboarding = () => (
    <View style={styles.onboarding}>
      <Animated.View entering={FadeInUp.delay(200).duration(800)}>
        <Typography heading weight="700" size={32} color="#FFF" style={styles.onboardingTitle}>
          ZICA AI
        </Typography>
        <Typography weight="300" size={12} color="rgba(255,255,255,0.4)" style={styles.onboardingSubtitle}>
          {isAdmin ? 'OPERATIONS INTELLIGENCE ENGINE' : 'YOUR ARCHIVAL STYLE CONCIERGE'}
        </Typography>
        <View style={styles.statusDot}>
          <View style={styles.dotGreen} />
          <Typography weight="700" size={8} color="rgba(255,255,255,0.25)" style={{ letterSpacing: 3 }}>
            ONLINE · POWERED BY CLAUDE
          </Typography>
        </View>
      </Animated.View>

      <View style={styles.promptGrid}>
        {quickPrompts.map((item, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(400 + idx * 100).duration(600)}>
            <TouchableOpacity
              style={styles.promptCard}
              activeOpacity={0.7}
              onPress={() => handleSend(item.label)}
            >
              <Ionicons name={item.icon as any} size={18} color="rgba(255,255,255,0.6)" />
              <Typography size={10} weight="400" color="#FFF">{item.label}</Typography>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: '#000' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <GlassHeader title="ZICA AI" showBack />

      {messages.length === 0 ? (
        renderOnboarding()
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 150, paddingTop: insets.top + 70 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          scrollEventThrottle={16}
        />
      )}

      {isTyping && (
        <View style={styles.typingRow}>
          <View style={styles.typingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
          <Typography size={9} weight="700" color="rgba(255,255,255,0.3)" style={{ letterSpacing: 1 }}>
            ZICA AI IS THINKING...
          </Typography>
        </View>
      )}

      <Animated.View style={[
        styles.inputBarWrapper,
        { paddingBottom: insets.bottom + 90 },
        inputAnimatedStyle,
      ]}>
        <View style={styles.inputPill}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={isAdmin ? 'Command Zica AI...' : 'Ask anything...'}
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            multiline
            maxLength={1000}
            editable={!isTyping}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!input.trim() || isTyping}
            style={[styles.sendButton, {
              backgroundColor: input.trim() && !isTyping ? '#FFF' : 'rgba(255,255,255,0.05)',
            }]}
            activeOpacity={0.8}
          >
            {isTyping ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="arrow-up" size={18} color={input.trim() ? '#000' : 'rgba(255,255,255,0.2)'} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────

const msgStyles = StyleSheet.create({
  row: { marginBottom: 12, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: width * 0.8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  userBubble: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.03)', borderBottomLeftRadius: 4 },
  aiBubbleDecoration: { borderLeftWidth: 2, borderLeftColor: 'rgba(138, 110, 255, 0.4)' },
  errorBubble: { borderLeftColor: 'rgba(255, 59, 48, 0.4)' },
  text: { fontSize: 15, lineHeight: 22, fontWeight: '300', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  time: { textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  onboarding: { flex: 1, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },
  onboardingTitle: { textAlign: 'center', letterSpacing: 12, marginBottom: 8, textShadowColor: 'rgba(255,255,255,0.1)', textShadowRadius: 10 },
  onboardingSubtitle: { textAlign: 'center', letterSpacing: 4, marginBottom: 16 },
  statusDot: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 48 },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  promptCard: {
    width: (width - 64 - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typingRow: { paddingHorizontal: 24, paddingBottom: 150, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(138, 110, 255, 0.4)' },
  dot1: { opacity: 0.6 },
  dot2: { opacity: 0.4 },
  dot3: { opacity: 0.2 },
  inputBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16 },
  inputPill: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 32,
    padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, color: '#FFF', fontSize: 16, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 120, fontWeight: '300' },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 2, marginRight: 2 },
});
