import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Keyboard, Alert, Pressable, Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
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
  image?: string;
}

// ─── Quick prompts ───────────────────────────────

const QUICK_PROMPTS = [
  { label: 'Size guide', icon: 'shirt-outline' },
  { label: 'Track my order', icon: 'location-outline' },
  { label: 'Return policy', icon: 'refresh-outline' },
  { label: 'Trending now', icon: 'flame-outline' },
];

const ADMIN_QUICK_PROMPTS = [
  { label: "Today's briefing", icon: 'sunny-outline' },
  { label: 'Low stock alert', icon: 'alert-circle-outline' },
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
  const colors = useColors();
  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(20)}
      style={[msgStyles.row, isUser && msgStyles.rowRight]}
    >
      <View style={[
        msgStyles.bubble,
        isUser ? { backgroundColor: colors.foreground } : { backgroundColor: colors.surface },
        isUser ? msgStyles.userBubble : msgStyles.aiBubble,
        item.isError && msgStyles.errorBubble,
      ]}>
        {item.image && (
          <Image 
            source={{ uri: item.image }} 
            style={msgStyles.imageContent} 
            contentFit="cover"
            transition={300}
          />
        )}
        <Typography 
            size={13} 
            weight={isUser ? "500" : "400"} 
            color={isUser ? colors.background : colors.text}
            style={{ lineHeight: 20, letterSpacing: -0.2 }}
        >
          {item.content}
        </Typography>
        <View style={msgStyles.metaRow}>
          {item.toolsUsed ? (
            <Typography size={6} weight="800" color={isUser ? colors.background : colors.info} style={{ letterSpacing: 1, opacity: 0.8 }}>
              ⚡ {item.toolsUsed} TOOL{item.toolsUsed > 1 ? 'S' : ''}
            </Typography>
          ) : null}
          <Typography size={7} weight="500" color={isUser ? colors.background : colors.textExtraLight} style={[msgStyles.time, { opacity: 0.5 }]}>
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

  useFocusEffect(
    useCallback(() => {
      setTabBarVisible(false);
      // Optional: hide on focus, but we want it hidden as long as we are here
      return () => {
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;

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

  const handlePickImage = async (mode: 'camera' | 'library') => {
    haptics.buttonTap();
    const permission = mode === 'camera' 
      ? await ImagePicker.requestCameraPermissionsAsync() 
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission denied', `Access to ${mode === 'camera' ? 'camera' : 'library'} is required.`);
      return;
    }

    const result = mode === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });

    if (!result.canceled && result.assets[0]) {
      // In a real app, upload result.assets[0].uri to storage and get URL
      // For now, we simulate sending an image message
      const imgMsg: Message = {
          id: Date.now().toString(),
          content: "Shared an image.",
          isUser: true,
          createdAt: new Date(),
          image: result.assets[0].uri
      };
      setMessages(prev => [...prev, imgMsg]);
      haptics.success();
    }
  };

  const renderOnboarding = () => (
    <View style={styles.onboarding}>
      <Animated.View entering={FadeInUp.delay(200).duration(800)} style={{ alignItems: 'center' }}>
        <Typography heading weight="700" size={36} color={colors.text} style={styles.onboardingTitle}>
          ZICA AI
        </Typography>
        <Typography weight="400" size={10} color={colors.textMuted} style={styles.onboardingSubtitle}>
          {isAdmin ? 'OPERATIONS INTELLIGENCE ENGINE' : 'YOUR ARCHIVAL STYLE CONCIERGE'}
        </Typography>
        <View style={styles.statusDot}>
          <View style={styles.dotGreen} />
          <Typography weight="800" size={7} color={colors.textExtraLight} style={{ letterSpacing: 2 }}>
            ONLINE
          </Typography>
        </View>
      </Animated.View>

      <View style={styles.promptGrid}>
        {(isAdmin ? ADMIN_QUICK_PROMPTS : QUICK_PROMPTS).map((item, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(400 + idx * 100).duration(600)}>
            <TouchableOpacity
              style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: 'rgba(150,150,150,0.1)' }]}
              activeOpacity={0.7}
              onPress={() => handleSend(item.label)}
            >
              <Ionicons name={item.icon as any} size={14} color={colors.textMuted} />
              <Typography size={9} weight="600" color={colors.text}>{item.label.toUpperCase()}</Typography>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="ZICA AI" showBack />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {messages.length === 0 ? (
              renderOnboarding()
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <MessageBubble item={item} />}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: insets.top + 70 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={true}
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />
            )}

            {isTyping && (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={colors.textExtraLight} style={{ marginRight: 8 }} />
                <Typography size={8} weight="700" color={colors.textExtraLight} style={{ letterSpacing: 1 }}>
                  ZICA AI IS THINKING...
                </Typography>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.inputBarWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={[styles.inputPill, { backgroundColor: colors.surface, borderColor: 'rgba(150,150,150,0.1)' }]}>
          <View style={styles.attachRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => handlePickImage('camera')}>
              <Ionicons name="camera-outline" size={20} color={colors.textExtraLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={() => handlePickImage('library')}>
              <Ionicons name="image-outline" size={20} color={colors.textExtraLight} />
            </TouchableOpacity>
          </View>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message..."
              placeholderTextColor={colors.textExtraLight}
              style={[styles.input, { color: colors.text }]}
              multiline
              maxLength={1000}
              editable={!isTyping}
            />

            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={!input.trim() || isTyping}
              style={[styles.sendButton, {
                backgroundColor: input.trim() && !isTyping ? colors.foreground : 'rgba(150,150,150,0.05)',
              }]}
            >
              <Ionicons name="arrow-up" size={16} color={input.trim() ? colors.background : colors.textExtraLight} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────

const msgStyles = StyleSheet.create({
  row: { marginBottom: 16, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { 
    maxWidth: width * 0.75, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.05)',
  },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },
  errorBubble: { borderColor: 'rgba(255, 59, 48, 0.2)' },
  imageContent: {
    width: width * 0.65,
    height: width * 0.85,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  time: { marginLeft: 12 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  onboarding: { flex: 1, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },
  onboardingTitle: { letterSpacing: 10, marginBottom: 8 },
  onboardingSubtitle: { letterSpacing: 3, marginBottom: 16, opacity: 0.6 },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 60 },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  promptCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  typingRow: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  inputBarWrapper: { paddingHorizontal: 16, paddingTop: 10 },
  inputPill: {
    flexDirection: 'row', 
    alignItems: 'center',
    borderRadius: 30,
    padding: 4, 
    borderWidth: 1,
    minHeight: 52,
  },
  attachRow: { flexDirection: 'row', paddingLeft: 8 },
  attachBtn: { padding: 6 },
  input: { 
    flex: 1, 
    fontSize: 14, 
    paddingHorizontal: 12, 
    maxHeight: 100, 
    fontWeight: '500',
  },
  sendButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 2,
  },
});

