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
  withRepeat, FadeIn, ZoomIn,
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
import { apiGet } from '../api/shopify';
import QuickAddModal from '../components/QuickAddModal';
import { FlatProduct } from '../api/types';
import { callClaudeStream } from '../api/claude';
import { ZICA_AI_CONFIG } from '../constants/aiConfig';

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
  isStreaming?: boolean;
}

// ─── Quick prompts ───────────────────────────────

const QUICK_PROMPTS = [
  { label: 'Style tips', icon: 'sparkles-outline', desc: 'Get customized recommendation for your personal outfit look.' },
  { label: 'Size guide', icon: 'shirt-outline', desc: 'Find your perfect size fit for items in Zica Bella catalogue.' },
  { label: 'Track my order', icon: 'location-outline', desc: 'Check the real-time shipping status and delivery updates.' },
  { label: 'Trending now', icon: 'flame-outline', desc: 'Browse the latest highly in-demand collections and lookbook.' },
];

const ADMIN_QUICK_PROMPTS = [
  { label: "Today's briefing", icon: 'sunny-outline', desc: 'Fetch key metrics, sales timeline status, and active users.' },
  { label: 'Low stock alert', icon: 'alert-circle-outline', desc: 'Analyze products running low in inventory catalog.' },
];

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

// ─── Order Tracker Card ──────────────────────────

const OrderTrackerCard = memo(({ order, navigation }: { order: any; navigation: any }) => {
  const colors = useColors();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const getActiveStep = () => {
    const ds = String(order.deliveryStatus || '').toLowerCase();
    const os = String(order.status || '').toLowerCase();
    
    if (ds === 'delivered' || os === 'delivered') return 4;
    if (ds === 'out_for_delivery') return 3;
    if (ds === 'shipped' || os === 'shipped') return 2;
    if (order.paymentStatus === 'paid' || os === 'approved' || os === 'processing') return 1;
    return 0; // order_placed
  };

  const activeStep = getActiveStep();
  const steps = ['Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];

  return (
    <View style={[
      styles.orderCard,
      {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.5)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      }
    ]}>
      <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.orderCardHeader}>
        <View>
          <Typography size={11} weight="700" color={colors.text}>
            Order #{order.orderNumber}
          </Typography>
          <Typography size={8} weight="500" color={colors.textMuted}>
            {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </Typography>
        </View>
        <View style={[
          styles.badge, 
          { backgroundColor: activeStep === 4 ? '#34C75920' : '#FF950020' }
        ]}>
          <Typography size={8} weight="700" color={activeStep === 4 ? '#34C759' : '#FF9500'}>
            {(order.deliveryStatus || order.status || 'Processing').toUpperCase()}
          </Typography>
        </View>
      </View>

      {/* Visual Stepper */}
      <View style={styles.stepperContainer}>
        <View style={[
          styles.stepperLineBackground,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }
        ]} />
        <View style={[
          styles.stepperLineBackground,
          { 
            backgroundColor: colors.foreground,
            width: `${(activeStep / (steps.length - 1)) * 80}%`,
          }
        ]} />

        {steps.map((step, idx) => {
          const isCompleted = idx <= activeStep;
          const isActive = idx === activeStep;
          
          return (
            <View key={idx} style={styles.stepWrapper}>
              <View style={[
                styles.stepDot,
                {
                  backgroundColor: isCompleted ? colors.foreground : (isDark ? '#2c2c2c' : '#e0e0e0'),
                  borderColor: isActive ? colors.text : 'transparent',
                  borderWidth: isActive ? 1.5 : 0,
                }
              ]}>
                {isCompleted && (
                  <Ionicons name="checkmark" size={8} color={colors.background} />
                )}
              </View>
              <Typography 
                size={7} 
                weight={isActive ? "700" : "500"} 
                color={isActive ? colors.text : colors.textExtraLight}
                style={styles.stepLabel}
                numberOfLines={1}
              >
                {step}
              </Typography>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.trackButton, { backgroundColor: colors.foreground }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
      >
        <Typography size={9} weight="700" color={colors.background}>
          VIEW ORDER TRACKING DETAILS
        </Typography>
        <Ionicons name="arrow-forward" size={10} color={colors.background} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </View>
  );
});

// ─── Message Bubble ──────────────────────────────

const MessageBubble = memo(({ 
  item, 
  onLinkPress, 
  userOrders = [], 
  navigation 
}: { 
  item: Message; 
  onLinkPress: (url: string) => boolean; 
  userOrders?: any[]; 
  navigation: any;
}) => {
  const isUser = item.isUser;
  const colors = useColors();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const mdStyles = React.useMemo(() => buildMarkdownStyles(colors), [colors]);

  const rules = React.useMemo(() => ({
    image: (node: any) => {
      const { src, alt } = node.attributes;
      return (
        <View key={node.key} style={{ marginVertical: 6, alignItems: 'flex-start' }}>
          <Image
            source={{ uri: src }}
            style={{
              width: 140,
              height: 140,
              borderRadius: 12,
              backgroundColor: 'rgba(150,150,150,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(150,150,150,0.15)',
            }}
            contentFit="cover"
            transition={200}
          />
          {alt ? (
            <Typography size={9} weight="600" color={colors.textMuted} style={{ marginTop: 4, width: 140 }} numberOfLines={2}>
              {alt}
            </Typography>
          ) : null}
        </View>
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
  }), [colors, onLinkPress]);

  // Find matching order in user's loaded orders list
  const matchingOrder = React.useMemo(() => {
    if (item.isUser || userOrders.length === 0) return null;
    
    for (const order of userOrders) {
      const orderNum = String(order.orderNumber).toLowerCase();
      const cleanNum = orderNum.replace(/\D/g, ''); 
      
      if (
        item.content.toLowerCase().includes(orderNum) || 
        (cleanNum.length >= 4 && item.content.includes(cleanNum))
      ) {
        return order;
      }
    }
    
    if (
      (item.content.toLowerCase().includes('order status') || 
       item.content.toLowerCase().includes('track') || 
       item.content.toLowerCase().includes('where is my order')) && 
      userOrders.length === 1
    ) {
      return userOrders[0];
    }
    
    return null;
  }, [item.isUser, item.content, userOrders]);

  // Don't render empty AI message bubble during initial load before streaming starts
  if (!isUser && !item.content) {
    return null;
  }

  return (
    <View style={[msgStyles.row, isUser && msgStyles.rowRight]}>
      <View style={[
        msgStyles.bubble,
        isUser 
          ? { 
              backgroundColor: colors.foreground, 
              borderBottomRightRadius: 4,
              shadowColor: colors.foreground,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 3,
            } 
          : { 
              backgroundColor: 'transparent', 
              borderColor: 'transparent',
              borderWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 4,
            },
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
          item.isStreaming ? (
            <Typography 
                size={13} 
                weight={"500"} 
                color={colors.text}
                style={{ lineHeight: 20, letterSpacing: -0.2 }}
            >
              {item.content}
            </Typography>
          ) : (
            <Markdown style={mdStyles} rules={rules} onLinkPress={onLinkPress}>
              {item.content}
            </Markdown>
          )
        )}

        {matchingOrder && (
          <OrderTrackerCard order={matchingOrder} navigation={navigation} />
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
    </View>
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

  // Siri/ChatGPT style pulsing glowing AI orb variables
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.18);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.35, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    pulseOpacity.value = withRepeat(
      withTiming(0.45, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulsingGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  })); 
  const flatListRef = useRef<FlatList>(null);
  const [abortController, setAbortController] = useState<(() => void) | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FlatProduct | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [catalogContext, setCatalogContext] = useState<string>('');
  
  // State for user orders
  const [userOrders, setUserOrders] = useState<any[]>([]);

  // Refs for performance optimizations (avoid recreating handleSend callback on every keystroke)
  const inputRef = useRef(input);
  const isTypingRef = useRef(isTyping);
  const conversationHistoryRef = useRef(conversationHistory);
  const pendingImageRef = useRef(pendingImage);
  const abortControllerRef = useRef(abortController);
  const catalogContextRef = useRef(catalogContext);

  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);
  useEffect(() => { conversationHistoryRef.current = conversationHistory; }, [conversationHistory]);
  useEffect(() => { pendingImageRef.current = pendingImage; }, [pendingImage]);
  useEffect(() => { abortControllerRef.current = abortController; }, [abortController]);
  useEffect(() => { catalogContextRef.current = catalogContext; }, [catalogContext]);

  // Throttled scroll to bottom with intelligent scroll-up detection (fixes scroll lock)
  const isNearBottom = useRef(true);
  const lastScrollTime = useRef(0);
  
  const scrollToEndThrottled = useCallback((animated = true) => {
    if (!isNearBottom.current) return;
    
    const now = Date.now();
    if (now - lastScrollTime.current > 150) {
      flatListRef.current?.scrollToEnd({ animated });
      lastScrollTime.current = now;
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    // Check if user is within 100 pixels of the bottom
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottom.current = distanceFromBottom < 100;
  }, []);

  // Fetch active customer orders for the tracking status cards
  useEffect(() => {
    if (user) {
      apiGet<any>('/orders', { 
        customerId: user.id || '',
        phone: user.phone || '',
        email: user.email || '',
      })
        .then(res => {
          const ordersList = res.orders || res || [];
          setUserOrders(ordersList);
        })
        .catch(err => console.error('[Zica AI] Failed to fetch customer orders:', err));
    }
  }, [user]);

  // Fetch catalog to train Zica AI
  useEffect(() => {
    Promise.all([
      apiGet<any>('/products', { limit: '50' }).catch(() => null),
      apiGet<any>('/collections').catch(() => null)
    ]).then(([productsRes, collectionsRes]) => {
      const extractCatalogProducts = (payload: any): any[] => {
        if (!payload) return [];
        const candidates = payload.products || payload.data?.products || payload.items || payload.data?.items || payload;
        const raw = Array.isArray(candidates) ? candidates : (Array.isArray(candidates?.edges) ? candidates.edges : []);
        return raw.map((item: any) => {
          const node = item?.node || item;
          if (!node) return null;
          
          let price = node.price;
          if (!price && node.variants) {
            const vars = Array.isArray(node.variants) ? node.variants : (Array.isArray(node.variants?.edges) ? node.variants.edges : []);
            const firstVar = vars[0]?.node || vars[0];
            price = firstVar?.price?.amount || firstVar?.price;
          }
          if (!price && node.priceRange?.minVariantPrice) {
            price = node.priceRange.minVariantPrice.amount;
          }

          let featuredImage = node.featuredImage;
          if (typeof featuredImage === 'object') {
            featuredImage = featuredImage?.url || featuredImage?.src;
          }
          if (!featuredImage && node.images) {
            const imgs = Array.isArray(node.images) ? node.images : (Array.isArray(node.images?.edges) ? node.images.edges : []);
            const firstImg = imgs[0]?.node || imgs[0];
            featuredImage = typeof firstImg === 'string' ? firstImg : (firstImg?.url || firstImg?.src);
          }

          const sizesSet = new Set<string>();
          if (node.variants) {
            const vars = Array.isArray(node.variants) ? node.variants : (Array.isArray(node.variants?.edges) ? node.variants.edges : []);
            vars.forEach((v: any) => {
              const vNode = v?.node || v;
              if (!vNode) return;
              const size = vNode.size || vNode.selectedOptions?.find((opt: any) => String(opt?.name || '').toLowerCase() === 'size')?.value;
              if (size) sizesSet.add(size);
            });
          }

          return {
            title: node.title || '',
            handle: node.handle || '',
            price: price || '0',
            featuredImage: featuredImage || '',
            sizes: Array.from(sizesSet),
          };
        }).filter((p: any) => p && p.title && p.handle);
      };

      const extractCatalogCollections = (payload: any): any[] => {
        if (!payload) return [];
        const candidates = payload.collections || payload.data?.collections || payload.items || payload;
        const raw = Array.isArray(candidates) ? candidates : (Array.isArray(candidates?.edges) ? candidates.edges : []);
        return raw.map((item: any) => {
          const node = item?.node || item;
          if (!node) return null;
          return {
            title: node.title || '',
            handle: node.handle || '',
          };
        }).filter((c: any) => c && c.title && c.handle);
      };

      const products = extractCatalogProducts(productsRes);
      const collections = extractCatalogCollections(collectionsRes);
      
      let ctx = `\n\n=== APP CATALOG KNOWLEDGE ===\n`;
      ctx += `You have knowledge of the following products and collections currently available in the Zica Bella app.\n`;
      ctx += `CRITICAL INSTRUCTION: DO NOT provide any external Shopify links (e.g. myshopify.com). If you recommend a product or collection, ONLY use the custom app deep link scheme format:\n`;
      ctx += `- Product Link Format: [Product Name](zica://products/product-handle)\n`;
      ctx += `- Collection Link Format: [Collection Name](zica://collections/collection-handle)\n`;
      ctx += `You MUST include the product image in your response using markdown when recommending a product: ![Product Name](image_url)\n\n`;

      if (collections.length > 0) {
        ctx += `--- COLLECTIONS ---\n`;
        collections.forEach(c => {
          ctx += `- ${c.title} (Handle: ${c.handle})\n`;
        });
        ctx += `\n`;
      }

      if (products.length > 0) {
        ctx += `--- PRODUCTS ---\n`;
        products.forEach(p => {
          const sizes = p.sizes.filter(Boolean).join('/');
          ctx += `- ${p.title} | Price: ₹${p.price} | Handle: ${p.handle} | Image: ${p.featuredImage}${sizes ? ` | Sizes: ${sizes}` : ''}\n`;
        });
      }

      setCatalogContext(ctx);
    });
  }, []);

  // Auto-scroll list when keyboard pops up on iOS
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      flatListRef.current?.scrollToEnd({ animated: true });
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (abortController) {
        abortController();
      }
    };
  }, [abortController]);

  const handleSend = useCallback(async (text?: string) => {
    const currentInput = inputRef.current;
    const currentIsTyping = isTypingRef.current;
    const currentHistory = conversationHistoryRef.current;
    const currentPendingImage = pendingImageRef.current;
    const currentAbortController = abortControllerRef.current;
    const currentCatalogContext = catalogContextRef.current;

    if (!currentInput.trim() && !text && !currentPendingImage) {
      setHistoryVisible(true);
      return;
    }
    const content = (text ?? currentInput).trim();
    if ((!content && !currentPendingImage) || currentIsTyping) return;

    setInput('');
    inputRef.current = '';
    Keyboard.dismiss();
    haptics.buttonTap();

    // Reset scroll lock since the user explicitly sent a message
    isNearBottom.current = true;

    const displayContent = content || 'Analyze this image';
    const userMsg: Message = {
      id: Date.now().toString(),
      content: displayContent,
      isUser: true,
      createdAt: new Date(),
      image: currentPendingImage?.uri,
    };

    // Placeholder for AI streaming response
    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = {
      id: aiMsgId,
      content: '',
      isUser: false,
      createdAt: new Date(),
      toolsUsed: 0,
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, newAiMsg]);
    setIsTyping(true);
    isTypingRef.current = true;

    // Capture and clear pending image before the async call
    const imageToSend = currentPendingImage;
    setPendingImage(null);
    pendingImageRef.current = null;

    // Cancel any previous active streaming API call
    if (currentAbortController) {
      currentAbortController();
    }

    try {
      // Build user content — supports standard image + text structure for Anthropic API
      let currentMsgContent: any = displayContent;
      if (imageToSend) {
        currentMsgContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageToSend.mimeType || 'image/jpeg',
              data: imageToSend.base64,
            },
          },
          {
            type: 'text',
            text: displayContent,
          },
        ];
      }

      // Include the last 10 messages of conversation history in the messages array for context continuity
      const messagesToSend = [
        ...currentHistory.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: currentMsgContent,
        },
      ];

      // Invoke client-side Claude streaming call using direct key
      const abort = callClaudeStream({
        messages: messagesToSend,
        systemPrompt: ZICA_AI_CONFIG.SYSTEM_PROMPT + currentCatalogContext,
        onToken: (token) => {
          setIsTyping(false); // Typing indicator disappears immediately once tokens begin streaming
          isTypingRef.current = false;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, content: msg.content + token, isStreaming: true }
                : msg
            )
          );
          scrollToEndThrottled(true);
        },
        onError: (err) => {
          console.error('[Zica AI] Stream error:', err.message);
          setIsTyping(false);
          isTypingRef.current = false;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, content: `⚠️ ${err.message || 'Something went wrong. Please try again.'}`, isError: true, isStreaming: false }
                : msg
            )
          );
          flatListRef.current?.scrollToEnd({ animated: true });
        },
        onComplete: (fullText) => {
          setIsTyping(false);
          isTypingRef.current = false;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, content: fullText, isStreaming: false }
                : msg
            )
          );
          setConversationHistory(prev => [
            ...prev,
            { role: 'user', content: displayContent },
            { role: 'assistant', content: fullText }
          ]);
          haptics.success();
        },
      });

      setAbortController(() => abort);
      abortControllerRef.current = abort;
    } catch (err: any) {
      setIsTyping(false);
      isTypingRef.current = false;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMsgId
            ? { ...msg, content: '⚠️ Something went wrong. Please try again.', isError: true, isStreaming: false }
            : msg
        )
      );
    }
  }, []);

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
    } else if (url.includes('/orders/')) {
      const orderId = url.split('/orders/')[1]?.split('?')[0]?.split('#')[0];
      if (orderId) {
        targetUrl = 'zica://orders/' + orderId;
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

    if (targetUrl.startsWith('zica://orders/')) {
      const orderId = targetUrl.replace('zica://orders/', '');
      haptics.buttonTap();
      navigation.navigate('OrderDetails', { orderId });
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
        const file = new FileSystem.File(asset.uri);
        const base64Data = await file.base64();
        
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
      {/* Siri/ChatGPT Pulsing AI Liquid Orb */}
      <View style={styles.orbContainer}>
        <Animated.View 
          style={[
            styles.glowOuter,
            { shadowColor: colors.info || '#007AFF' },
            pulsingGlowStyle
          ]}
        />
        <Animated.View 
          entering={ZoomIn.delay(200).duration(800)}
          style={[
            styles.orbCore,
            { 
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)', 
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)',
            }
          ]}
        >
          <BlurView intensity={35} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="sparkles" size={28} color={colors.text} />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(300).duration(800)} style={{ alignItems: 'center', width: '100%', paddingHorizontal: 20 }}>
        <Typography heading weight="800" size={26} color={colors.text} style={styles.onboardingGreeting}>
          How can I help you today?
        </Typography>
        <Typography weight="500" size={11} color={colors.textMuted} style={styles.onboardingSubtitleChatGPT}>
          {isAdmin ? 'System console online. Query active shopify inventory.' : 'Ask Zica to design style fits, track active orders, or browse collections.'}
        </Typography>
      </Animated.View>

      <View style={styles.promptList}>
        {(isAdmin ? ADMIN_QUICK_PROMPTS : QUICK_PROMPTS).map((item, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(500 + idx * 100).duration(600)} style={{ width: '100%' }}>
            <TouchableOpacity
              style={[
                styles.promptCardChatGPT, 
                { 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.65)', 
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                }
              ]}
              activeOpacity={0.75}
              onPress={() => handleSend(item.label)}
            >
              <BlurView intensity={10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
              
              <View style={[styles.promptIconWrapper, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)' }]}>
                <Ionicons name={item.icon as any} size={15} color={colors.text} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Typography size={11} weight="700" color={colors.text}>
                  {item.label}
                </Typography>
                <Typography size={8.5} weight="500" color={colors.textMuted} style={{ marginTop: 2 }} numberOfLines={2}>
                  {item.desc}
                </Typography>
              </View>
              <Ionicons name="arrow-forward-outline" size={12} color={colors.textExtraLight} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} android_disableSound={true}>
          <View style={{ flex: 1 }}>
            {messages.length === 0 ? (
              renderOnboarding()
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <MessageBubble 
                    item={item} 
                    onLinkPress={handleLinkPress} 
                    userOrders={userOrders}
                    navigation={navigation}
                  />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: insets.top + 70 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onContentSizeChange={() => {
                  if (messages.length > 0 && isNearBottom.current) {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }
                }}
                ListFooterComponent={
                  isTyping ? (
                    <Animated.View
                      entering={FadeInDown.duration(300)}
                      style={[msgStyles.row, { paddingHorizontal: 0, paddingBottom: 12, paddingTop: 6 }]}
                    >
                      <View style={[
                        msgStyles.bubble,
                        { 
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.45)', 
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                          borderWidth: 1,
                          borderBottomLeftRadius: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        }
                      ]}>
                        <ActivityIndicator size="small" color={colors.textExtraLight} style={{ marginRight: 8 }} />
                        <Typography size={12} weight="600" color={colors.textMuted} style={{ letterSpacing: -0.1 }}>
                          Zica is thinking...
                        </Typography>
                      </View>
                    </Animated.View>
                  ) : null
                }
              />
            )}
          </View>
        </Pressable>

        <View style={[styles.inputBarWrapper, { paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) }]}>
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
              backgroundColor: isDark ? 'rgba(25, 25, 25, 0.65)' : 'rgba(255, 255, 255, 0.72)',
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
              editable={true}
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
  orderCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
  },
  stepperLineBackground: {
    position: 'absolute',
    top: 9, 
    left: '10%',
    right: '10%',
    height: 2,
    zIndex: 0,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  stepLabel: {
    marginTop: 6,
    textAlign: 'center',
  },
  trackButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  orbContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  glowOuter: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    opacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 28,
    elevation: 8,
  },
  orbCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  onboardingGreeting: {
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  onboardingSubtitleChatGPT: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.5,
    lineHeight: 18,
    maxWidth: 280,
  },
  promptList: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 12,
  },
  promptCardChatGPT: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  promptIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});
