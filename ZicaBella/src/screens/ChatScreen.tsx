import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Keyboard, Alert, Pressable, Image as RNImage,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Markdown from 'react-native-markdown-display';
import { BlurView } from 'expo-blur';
import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { useUIStore } from '../store/uiStore';
import GlassHeader from '../components/GlassHeader';
import { Typography } from '../components/Typography';
import { haptics } from '../utils/haptics';
import { useAuthStore } from '../store/authStore';
import { ChatHistoryModal } from './ChatHistoryModal';
import { sendZicaAIMessage, ChatMessage as ZicaAIChatMessage } from '../services/zicaAI';
import { apiGet } from '../api/shopify';
import QuickAddModal from '../components/QuickAddModal';
import { FlatProduct } from '../api/types';


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
  { label: 'Style tips', icon: 'sparkles-outline' },
  { label: 'Size guide', icon: 'shirt-outline' },
  { label: 'Track my order', icon: 'location-outline' },
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
  userContext?: any,
  sessionId?: string | null,
  imageBase64?: string | null,
  imageMimeType?: string | null
): Promise<{ response: string; conversationHistory: any[]; toolsUsed: number; sessionId?: string }> {
  const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';

  const payload: any = {
    message,
    conversationHistory: history,
    userContext,
    sessionId,
  };

  if (imageBase64) {
    payload.imageBase64 = imageBase64;
    payload.imageMimeType = imageMimeType || 'image/jpeg';
  }

  const res = await fetch(`${APP_URL}/api/app/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Fallback: try the standalone /api/zica-ai endpoint
    const zicaMessages: ZicaAIChatMessage[] = [
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];
    try {
      const fallbackReply = await sendZicaAIMessage(zicaMessages);
      return {
        response: fallbackReply,
        conversationHistory: [...history, { role: 'user', content: message }, { role: 'assistant', content: fallbackReply }],
        toolsUsed: 0,
      };
    } catch {
      const err = await res.json().catch(() => ({ error: 'Network error' }));
      throw new Error(err.error || `Server error ${res.status}`);
    }
  }

  return res.json();
}

// ─── Markdown Styles ─────────────────────────────

function buildMarkdownStyles(colors: any) {
  return StyleSheet.create({
    body: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    heading1: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 4,
    },
    heading2: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: 4,
    },
    heading3: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
      marginTop: 2,
    },
    strong: {
      fontWeight: '700',
      color: colors.text,
    },
    em: {
      fontStyle: 'italic',
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    list_item: {
      flexDirection: 'row',
      marginVertical: 2,
    },
    bullet_list_icon: {
      color: colors.textMuted,
      fontSize: 13,
      marginRight: 6,
    },
    ordered_list_icon: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginRight: 6,
    },
    table: {
      borderWidth: 1,
      borderColor: 'rgba(150,150,150,0.15)',
      borderRadius: 8,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: 'rgba(150,150,150,0.08)',
    },
    th: {
      padding: 8,
      fontWeight: '700',
      fontSize: 11,
      color: colors.text,
    },
    td: {
      padding: 8,
      fontSize: 11,
      color: colors.text,
      borderTopWidth: 1,
      borderColor: 'rgba(150,150,150,0.1)',
    },
    code_inline: {
      backgroundColor: 'rgba(150,150,150,0.1)',
      color: colors.text,
      fontSize: 12,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fence: {
      backgroundColor: 'rgba(150,150,150,0.08)',
      borderRadius: 8,
      padding: 12,
      marginVertical: 8,
    },
    code_block: {
      color: colors.text,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: '#EF4444',
      backgroundColor: colors.theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(150,150,150,0.05)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      marginVertical: 8,
      opacity: 0.9,
    },
    hr: {
      backgroundColor: 'rgba(150,150,150,0.15)',
      height: 1,
      marginVertical: 12,
    },
    paragraph: {
      marginVertical: 3,
    },
    link: {
      color: colors.info || '#007AFF',
      textDecorationLine: 'underline',
      fontWeight: '600',
    },
  });
}

// ─── Message Bubble ──────────────────────────────

const MessageBubble = memo(({ item, onLinkPress }: { item: Message; onLinkPress: (url: string) => boolean }) => {
  const isUser = item.isUser;
  const colors = useColors();
  const mdStyles = buildMarkdownStyles(colors);

  const rules = {
    image: (node: any) => {
      const { src } = node.attributes;
      return (
        <Image
          key={node.key}
          source={{ uri: src }}
          style={{
            width: '100%',
            height: 220,
            borderRadius: 16,
            marginVertical: 10,
            backgroundColor: 'rgba(150,150,150,0.1)'
          }}
          contentFit="cover"
          transition={250}
        />
      );
    },
    link: (node: any, children: any, parent: any, styles: any) => {
      const { href } = node.attributes;
      return (
        <Text
          key={node.key}
          style={styles.link}
          onPress={() => onLinkPress(href)}
        >
          {children}
        </Text>
      );
    }
  };

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
        {isUser ? (
          <Typography 
              size={13} 
              weight={"500"} 
              color={colors.background}
              style={{ lineHeight: 20, letterSpacing: -0.2 }}
          >
            {item.content}
          </Typography>
        ) : (
          <Markdown style={mdStyles} rules={rules} onLinkPress={onLinkPress}>
            {item.content}
          </Markdown>
        )}
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

const ChatScreen = memo(() => {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.email?.endsWith('@zicabella.com') || false; 
  const flatListRef = useRef<FlatList>(null);

  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FlatProduct | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);

  const handleSend = useCallback(async (text?: string) => {
    if (!input.trim() && !text && !pendingImage) {
      setHistoryVisible(true);
      return;
    }
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || isTyping) return;

    setInput('');
    haptics.buttonTap();

    const displayContent = content || 'Analyze this image';
    const userMsg: Message = {
      id: Date.now().toString(),
      content: displayContent,
      isUser: true,
      createdAt: new Date(),
      image: pendingImage?.uri,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Capture and clear pending image before the async call
    const imageToSend = pendingImage;
    setPendingImage(null);

    try {
      const userContext = user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      } : undefined;

      const data = await callClaudeAPI(
        content,
        conversationHistory,
        userContext,
        currentSessionId,
        imageToSend?.base64 || null,
        imageToSend?.mimeType || null
      );
      
      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }

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
  }, [input, isTyping, conversationHistory, currentSessionId, pendingImage]);

  const handleLinkPress = useCallback((url: string) => {
    let targetUrl = url;
    
    if (url.includes('/products/')) {
      const handle = url.split('/products/')[1]?.split('?')[0]?.split('#')[0];
      if (handle) {
        targetUrl = 'zica://products/' + handle;
      }
    } else if (url.includes('/collections/')) {
      const handle = url.split('/collections/')[1]?.split('?')[0]?.split('#')[0];
      if (handle) {
        targetUrl = 'zica://collections/' + handle;
      }
    } else if (url.includes('/cart/add/')) {
      const handle = url.split('/cart/add/')[1]?.split('?')[0]?.split('#')[0];
      if (handle) {
        targetUrl = 'zica://cart/add/' + handle;
      }
    } else if (url.includes('zica://')) {
      targetUrl = 'zica://' + url.split('zica://')[1];
    }

    if (targetUrl.startsWith('zica://prompt/')) {
      const promptText = decodeURIComponent(targetUrl.replace('zica://prompt/', ''));
      haptics.buttonTap();
      handleSend(promptText);
      return false;
    }

    if (targetUrl.startsWith('zica://products/')) {
      const handle = targetUrl.replace('zica://products/', '');
      haptics.buttonTap();
      navigation.navigate('ProductDetail', { handle });
      return false;
    }
    
    if (targetUrl.startsWith('zica://collections/')) {
      const handle = targetUrl.replace('zica://collections/', '');
      haptics.buttonTap();
      navigation.navigate('Collection', { handle });
      return false;
    }
    
    if (targetUrl.startsWith('zica://cart/add/')) {
      const handle = targetUrl.replace('zica://cart/add/', '');
      haptics.buttonTap();
      setFetchingProduct(true);
      
      apiGet<{ product: FlatProduct | null }>('/products/' + handle)
        .then(data => {
          if (data && data.product) {
            setSelectedProduct(data.product);
            setQuickAddVisible(true);
          } else {
            Alert.alert('Error', 'Product details not found');
          }
        })
        .catch((err) => {
          Alert.alert('Error', err.message || 'Network request failed');
        })
        .finally(() => {
          setFetchingProduct(false);
        });
      return false;
    }

    Linking.openURL(url).catch(() => {});
    return false;
  }, [navigation, handleSend]);

  const setTabBarVisible = useUIStore(s => s.setTabBarVisible);

  const loadSession = async (sessionId: string) => {
    try {
      const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';
      const res = await fetch(`${APP_URL}/api/app/claude/history/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          content: m.content,
          isUser: m.role === 'user',
          createdAt: new Date(m.createdAt),
        }));
        setMessages(loadedMessages);
        
        // Also map to Claude format history
        const claudeHistory = data.messages.map((m: any) => ({
          role: m.role,
          content: m.content
        }));
        setConversationHistory(claudeHistory);
        setCurrentSessionId(sessionId);
        setHistoryVisible(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setTabBarVisible(false);
      // Optional: hide on focus, but we want it hidden as long as we are here
      return () => {
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  const handlePickImage = async () => {
    haptics.buttonTap();
    Alert.alert(
      "Upload Media",
      "Choose a source",
      [
        {
          text: "Camera",
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) return Alert.alert('Permission denied', 'Camera access is required.');
            const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
            processImageResult(result);
          }
        },
        {
          text: "Photo Library",
          onPress: async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) return Alert.alert('Permission denied', 'Library access is required.');
            const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
            processImageResult(result);
          }
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const processImageResult = async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        // Read the image file and encode as base64 using the new File API
        const file = new FileSystem.File(asset.uri);
        const base64Data = await file.base64();
        
        // Detect MIME type from the URI extension
        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpeg';
        const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
        const mimeType = mimeMap[ext] || 'image/jpeg';

        setPendingImage({
          uri: asset.uri,
          base64: base64Data,
          mimeType,
        });
        haptics.success();
      } catch (err) {
        console.error('Failed to encode image:', err);
        Alert.alert('Error', 'Could not process the selected image.');
      }
    }
  };

  const renderOnboarding = () => (
    <View style={styles.onboarding}>
      <Animated.View entering={FadeInUp.delay(200).duration(800)} style={{ alignItems: 'center' }}>
        <Typography heading weight="700" size={36} color={colors.text} style={styles.onboardingTitle}>
          ZICA AI
        </Typography>
        <Typography weight="400" size={10} color={colors.textMuted} style={styles.onboardingSubtitle}>
          {isAdmin ? 'OPERATIONS INTELLIGENCE ENGINE' : 'YOUR PERSONAL STYLE CONCIERGE'}
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
                renderItem={({ item }) => <MessageBubble item={item} onLinkPress={handleLinkPress} />}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: insets.top + 70 }}
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
          {/* Pending image preview inside the absolute container to prevent overlap */}
          {pendingImage && (
            <View style={[
              styles.pendingImageBar, 
              { 
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                overflow: 'hidden',
                marginHorizontal: 0,
                marginBottom: 8,
              }
            ]}>
              <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <Image source={{ uri: pendingImage.uri }} style={styles.pendingImageThumb} contentFit="cover" transition={200} />
              <Typography size={10} weight="500" color={colors.textMuted} style={{ flex: 1, marginLeft: 10 }}>
                Image ready to send
              </Typography>
              <TouchableOpacity onPress={() => setPendingImage(null)} style={styles.pendingImageRemove}>
                <Ionicons name="close-circle" size={22} color={colors.textExtraLight} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[
            styles.inputPill, 
            { 
              borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.08)',
            }
          ]}>
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            
            <View style={styles.attachRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
                <Ionicons name="camera-outline" size={20} color={colors.textExtraLight} />
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
              disabled={isTyping}
              style={[styles.sendButton, {
                backgroundColor: (input.trim() || pendingImage) && !isTyping ? colors.foreground : 'transparent',
              }]}
            >
              <Ionicons 
                name={(input.trim() || pendingImage) ? "arrow-up" : "time-outline"} 
                size={18} 
                color={(input.trim() || pendingImage) ? colors.background : colors.textExtraLight} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ChatHistoryModal 
        visible={historyVisible} 
        onClose={() => setHistoryVisible(false)} 
        onSelectSession={loadSession} 
      />

      <QuickAddModal
        visible={quickAddVisible}
        product={selectedProduct}
        onClose={() => setQuickAddVisible(false)}
      />

      {fetchingProduct && (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      )}
    </View>
  );
});

export default ChatScreen;

// ─── Styles ──────────────────────────────────────

const msgStyles = StyleSheet.create({
  row: { marginBottom: 16, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { 
    maxWidth: width * 0.78, 
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
  typingRow: { paddingHorizontal: 24, paddingBottom: 92, flexDirection: 'row', alignItems: 'center' },
  inputBarWrapper: { 
    paddingHorizontal: 16, 
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  inputPill: {
    flexDirection: 'row', 
    alignItems: 'center',
    borderRadius: 30,
    padding: 4, 
    borderWidth: 1,
    minHeight: 52,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
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
  pendingImageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 0,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  pendingImageThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pendingImageRemove: {
    padding: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});
