import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Keyboard, Alert, Pressable, Image as RNImage,
  Linking, InteractionManager,
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
import { ScrollView } from 'react-native-gesture-handler';

// ─── Types & Parsing ──────────────────────────────

interface ZicaDetectedEntity {
  type: 'product' | 'collection';
  handle: string;
  title: string;
}

const PRIORITY_COLLECTIONS = ['acid-tees'];
const thumbnailImageUrlCache = new Map<string, string>();
const thumbnailFetchCache = new Map<string, Promise<string | null>>();

function cleanZicaHandle(rawHandle: string | undefined): string {
  if (!rawHandle) return '';
  try {
    return decodeURIComponent(rawHandle);
  } catch {
    return rawHandle;
  }
}

function normalizeZicaHandle(rawPath: string | undefined): string {
  const firstSegment = String(rawPath || '')
    .replace(/^\/+/, '')
    .split('/')[0]
    ?.trim()
    .replace(/[)\].,;:!]+$/g, '');

  return cleanZicaHandle(firstSegment);
}

function titleFromHandle(handle: string): string {
  return handle
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractZicaLinkTarget(url: string): Pick<ZicaDetectedEntity, 'type' | 'handle'> | null {
  const withoutQuery = String(url || '')
    .trim()
    .replace(/^<|>$/g, '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/+$/, '');
  const lowerUrl = withoutQuery.toLowerCase();

  const markers: Array<{ type: ZicaDetectedEntity['type']; marker: string }> = [
    { type: 'product', marker: 'zicabella://product/' },
    { type: 'product', marker: 'zicabella://products/' },
    { type: 'product', marker: 'zica://products/' },
    { type: 'product', marker: '/products/' },
    { type: 'collection', marker: 'zicabella://collection/' },
    { type: 'collection', marker: 'zicabella://collections/' },
    { type: 'collection', marker: 'zica://collections/' },
    { type: 'collection', marker: '/collections/' },
  ];

  for (const { type, marker } of markers) {
    const markerIndex = lowerUrl.indexOf(marker);
    if (markerIndex === -1) continue;

    const handle = normalizeZicaHandle(withoutQuery.slice(markerIndex + marker.length));
    if (handle) return { type, handle };
  }

  return null;
}

function getCollectionPriority(handle: string): number {
  return PRIORITY_COLLECTIONS.indexOf(handle);
}

function sortDetectedEntities(entities: ZicaDetectedEntity[]): ZicaDetectedEntity[] {
  return [...entities].sort((a, b) => {
    const aIdx = a.type === 'collection' ? getCollectionPriority(a.handle) : -1;
    const bIdx = b.type === 'collection' ? getCollectionPriority(b.handle) : -1;
    if (aIdx !== -1 && bIdx === -1) return -1;
    if (bIdx !== -1 && aIdx === -1) return 1;
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    return 0;
  });
}

function sortCollectionHandles(handles: string[]): string[] {
  return [...handles].sort((a, b) => {
    const aIdx = getCollectionPriority(a);
    const bIdx = getCollectionPriority(b);
    if (aIdx !== -1 && bIdx === -1) return -1;
    if (bIdx !== -1 && aIdx === -1) return 1;
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    return 0;
  });
}

export function parseZicaLinks(text: string): ZicaDetectedEntity[] {
  const entities: ZicaDetectedEntity[] = [];
  const seen = new Set<string>();

  const addEntity = (target: Pick<ZicaDetectedEntity, 'type' | 'handle'> | null, title?: string) => {
    if (!target?.handle) return;
    const key = `${target.type}:${target.handle}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({
      ...target,
      title: title?.trim() || titleFromHandle(target.handle),
    });
  };

  const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownRegex.exec(text)) !== null) {
    addEntity(extractZicaLinkTarget(match[2]), match[1]);
  }

  const plainUrlRegex = /(?:zicabella:\/\/(?:product|products|collection|collections)\/[^\s)\]]+|zica:\/\/(?:products|collections)\/[^\s)\]]+|https?:\/\/(?:www\.)?zicabella\.com\/(?:products|collections)\/[^\s)\]]+|\/(?:products|collections)\/[^\s)\]]+)/gi;
  while ((match = plainUrlRegex.exec(text)) !== null) {
    const target = extractZicaLinkTarget(match[0]);
    addEntity(target, target?.handle ? titleFromHandle(target.handle) : undefined);
  }

  return sortDetectedEntities(entities);
}

function navigateToCollectionScreen(navigation: any, handle: string) {
  const routeNames = navigation.getState?.()?.routeNames || [];
  if (routeNames.includes('Collection')) {
    navigation.navigate('Collection', { handle });
    return;
  }

  const parent = navigation.getParent?.();
  const parentRouteNames = parent?.getState?.()?.routeNames || [];
  if (parentRouteNames.includes('Collection')) {
    parent.navigate('Collection', { handle });
    return;
  }

  navigation.navigate('HomeTab', {
    screen: 'Collection',
    params: { handle },
  });
}

function navigateToZicaEntity(navigation: any, entity: Pick<ZicaDetectedEntity, 'type' | 'handle'>) {
  if (!entity.handle) return;

  if (entity.type === 'product') {
    navigation.navigate('ProductDetail', { handle: entity.handle });
    return;
  }

  navigateToCollectionScreen(navigation, entity.handle);
}

async function fetchThumbnailImage(entity: ZicaDetectedEntity): Promise<string | null> {
  const cachedUrl = thumbnailImageUrlCache.get(entity.handle);
  if (cachedUrl) return cachedUrl;

  const fetchKey = `${entity.type}:${entity.handle}`;
  const pendingFetch = thumbnailFetchCache.get(fetchKey);
  if (pendingFetch) return pendingFetch;

  const fetchPromise = (async () => {
    try {
      if (entity.type === 'product') {
        const res = await apiGet<{ product: any }>('/products/' + entity.handle);
        const url = res?.product?.featuredImage || (res?.product?.images && res.product.images[0]?.src);
        if (url) {
          thumbnailImageUrlCache.set(entity.handle, url);
          return url;
        }
      } else {
        const res = await apiGet<any>('/collections/' + entity.handle).catch(() => null);
        const url = res?.collection?.image?.url || res?.collection?.image?.src || res?.collection?.image;
        if (url) {
          thumbnailImageUrlCache.set(entity.handle, url);
          return url;
        }
      }
    } catch {
      // Keep the thumbnail fallback silent.
    }

    return null;
  })();

  thumbnailFetchCache.set(fetchKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    thumbnailFetchCache.delete(fetchKey);
  }
}

const ZicaProductThumbnail = memo(({
  entity,
  imageUrl,
  loading = false,
}: {
  entity: ZicaDetectedEntity;
  imageUrl?: string | null;
  loading?: boolean;
}) => {
  const navigation = useNavigation<any>();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const colors = useColors();

  const handlePress = useCallback(() => {
    haptics.buttonTap();
    navigateToZicaEntity(navigation, entity);
  }, [entity.handle, entity.type, navigation]);

  return (
    <TouchableOpacity 
      style={[
        {
          width: 150,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.05)',
          padding: 8,
          marginRight: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(150,150,150,0.1)' }}>
        {loading ? (
           <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#333' : '#ddd', opacity: 0.5 }]} />
        ) : imageUrl ? (
           <Image source={{ uri: imageUrl }} style={{ width: 56, height: 56 }} contentFit="cover" />
        ) : (
           <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
             <Ionicons name={entity.type === 'product' ? 'shirt-outline' : 'albums-outline'} size={24} color={colors.textMuted} />
           </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Typography size={10} weight="600" color={colors.text} numberOfLines={2}>
          {entity.title}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => (
  prev.entity.type === next.entity.type
  && prev.entity.handle === next.entity.handle
  && prev.entity.title === next.entity.title
  && prev.imageUrl === next.imageUrl
  && prev.loading === next.loading
));

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
  { label: 'Style tips', icon: 'sparkles-outline' },
  { label: 'Size guide', icon: 'shirt-outline' },
  { label: 'Track order', icon: 'location-outline' },
  { label: 'Trending now', icon: 'flame-outline' },
];

const ADMIN_QUICK_PROMPTS = [
  { label: "Today's briefing", icon: 'sunny-outline' },
  { label: 'Low stock alert', icon: 'alert-circle-outline' },
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

// ─── Markdown Parsing & Performance Optimization ───

interface MarkdownChunk {
  id: string;
  type: 'code' | 'markdown';
  content: string;
}

function parseTextIntoChunks(text: string): MarkdownChunk[] {
  if (!text) return [];
  
  const chunks: MarkdownChunk[] = [];
  const parts = text.split('```');
  
  parts.forEach((part, index) => {
    const isCode = index % 2 === 1;
    if (isCode) {
      chunks.push({
        id: `code-${index}`,
        type: 'code',
        content: part,
      });
    } else {
      const paragraphs = part.split(/\n\n+/);
      paragraphs.forEach((para, paraIndex) => {
        const trimmed = para.trim();
        if (trimmed) {
          chunks.push({
            id: `md-${index}-${paraIndex}`,
            type: 'markdown',
            content: trimmed,
          });
        }
      });
    }
  });
  
  return chunks;
}

const ChunkedMarkdownRenderer = memo(({ 
  content, 
  mdStyles, 
  rules, 
  onLinkPress,
  shouldProgressive = false
}: {
  content: string;
  mdStyles: any;
  rules: any;
  onLinkPress: (url: string) => boolean;
  shouldProgressive?: boolean;
}) => {
  const chunks = React.useMemo(() => parseTextIntoChunks(content), [content]);
  const [visibleCount, setVisibleCount] = useState(shouldProgressive ? 4 : chunks.length);

  useEffect(() => {
    if (shouldProgressive && visibleCount < chunks.length) {
      const nextCount = Math.min(chunks.length, visibleCount + 4);
      const timer = setTimeout(() => {
        setVisibleCount(nextCount);
      }, 32);
      return () => clearTimeout(timer);
    }
  }, [visibleCount, chunks.length, shouldProgressive]);

  return (
    <View style={{ width: '100%' }}>
      {chunks.slice(0, visibleCount).map((chunk) => {
        if (chunk.type === 'code') {
          return (
            <View key={chunk.id} style={mdStyles.fence}>
              <Typography 
                size={11} 
                color={mdStyles.code_block.color} 
                style={{ fontFamily: mdStyles.code_block.fontFamily, lineHeight: 16 }}
              >
                {chunk.content.trim()}
              </Typography>
            </View>
          );
        }
        return (
          <Markdown 
            key={chunk.id} 
            style={mdStyles} 
            rules={rules} 
            onLinkPress={onLinkPress}
          >
            {chunk.content}
          </Markdown>
        );
      })}
    </View>
  );
});

// ─── Message Bubble ──────────────────────────────

const MessageBubble = memo(({ 
  item, 
  onLinkPress, 
  userOrders = [], 
  isLatest = false
}: { 
  item: Message; 
  onLinkPress: (url: string) => boolean; 
  userOrders?: any[]; 
  isLatest?: boolean;
}) => {
  const isUser = item.isUser;
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const mdStyles = React.useMemo(() => buildMarkdownStyles(colors), [colors]);
  const handleZicaLinkPress = useCallback((href: string) => {
    const target = extractZicaLinkTarget(href);
    if (target) {
      haptics.buttonTap();
      navigateToZicaEntity(navigation, target);
      return false;
    }

    return onLinkPress(href);
  }, [navigation, onLinkPress]);

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
        <TouchableOpacity
          key={node.key}
          activeOpacity={0.7}
          onPress={() => handleZicaLinkPress(href)}
        >
          <Text style={styles.link}>{children}</Text>
        </TouchableOpacity>
      );
    }
  }), [colors, handleZicaLinkPress]);

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

  const detectedEntities = React.useMemo(() => parseZicaLinks(item.content), [item.content]);
  const thumbnailEntities = React.useMemo(() => sortDetectedEntities(detectedEntities), [detectedEntities]);
  const thumbnailEntityKey = React.useMemo(
    () => thumbnailEntities.map(entity => `${entity.type}:${entity.handle}`).join('|'),
    [thumbnailEntities]
  );
  const [thumbnailImages, setThumbnailImages] = useState<Record<string, string>>({});
  const [loadingThumbnailHandles, setLoadingThumbnailHandles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (item.isStreaming || isUser || thumbnailEntities.length === 0) return;

    const cachedImages: Record<string, string> = {};
    const entitiesToFetch = thumbnailEntities.filter(entity => {
      const cachedUrl = thumbnailImageUrlCache.get(entity.handle);
      if (cachedUrl) {
        cachedImages[entity.handle] = cachedUrl;
        return false;
      }
      return true;
    });

    if (Object.keys(cachedImages).length > 0) {
      setThumbnailImages(prev => ({ ...prev, ...cachedImages }));
    }

    if (entitiesToFetch.length === 0) return;

    let isMounted = true;
    const loadingMap = entitiesToFetch.reduce<Record<string, boolean>>((acc, entity) => {
      acc[entity.handle] = true;
      return acc;
    }, {});
    setLoadingThumbnailHandles(prev => ({ ...prev, ...loadingMap }));

    const task = InteractionManager.runAfterInteractions(() => {
      Promise.allSettled(entitiesToFetch.map(fetchThumbnailImage)).then((results) => {
        if (!isMounted) return;

        const resolvedImages: Record<string, string> = {};
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            resolvedImages[entitiesToFetch[index].handle] = result.value;
          }
        });

        if (Object.keys(resolvedImages).length > 0) {
          setThumbnailImages(prev => ({ ...prev, ...resolvedImages }));
        }

        setLoadingThumbnailHandles(prev => {
          const next = { ...prev };
          entitiesToFetch.forEach(entity => {
            delete next[entity.handle];
          });
          return next;
        });
      });
    });

    return () => {
      isMounted = false;
      task.cancel?.();
    };
  }, [isUser, item.isStreaming, thumbnailEntities, thumbnailEntityKey]);

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
              {item.content.length > 3000 ? '... ' + item.content.slice(-3000) : item.content}
            </Typography>
          ) : (
            <ChunkedMarkdownRenderer 
              content={item.content} 
              mdStyles={mdStyles} 
              rules={rules} 
              onLinkPress={handleZicaLinkPress} 
              shouldProgressive={isLatest}
            />
          )
        )}

        {thumbnailEntities.length > 0 && !item.isStreaming && !isUser && (
          <View style={{ marginTop: 12, marginLeft: -8, marginRight: -8, paddingBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {thumbnailEntities.map((ent, idx) => (
                <ZicaProductThumbnail
                  key={`${ent.type}-${ent.handle}-${idx}`}
                  entity={ent}
                  imageUrl={thumbnailImages[ent.handle] || thumbnailImageUrlCache.get(ent.handle) || null}
                  loading={Boolean(loadingThumbnailHandles[ent.handle])}
                />
              ))}
            </ScrollView>
          </View>
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
}, (prev, next) => (
  prev.item.id === next.item.id
  && prev.item.content === next.item.content
  && prev.item.isUser === next.item.isUser
  && prev.item.isStreaming === next.item.isStreaming
  && prev.item.isError === next.item.isError
  && prev.item.image === next.item.image
  && prev.item.toolsUsed === next.item.toolsUsed
  && prev.item.createdAt.getTime() === next.item.createdAt.getTime()
  && prev.onLinkPress === next.onLinkPress
  && prev.userOrders === next.userOrders
  && prev.isLatest === next.isLatest
));

// ─── Input Bar Component ─────────────────────────

interface InputBarProps {
  onSend: (text: string, image?: { uri: string; base64: string; mimeType: string } | null) => void;
  isTyping: boolean;
}

const InputBar = memo(({ onSend, isTyping }: InputBarProps) => {
  const colors = useColors();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [localInput, setLocalInput] = useState('');
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

  const handleSubmit = () => {
    if (!localInput.trim() && !pendingImage) {
      onSend('');
      return;
    }
    onSend(localInput, pendingImage);
    setLocalInput('');
    setPendingImage(null);
  };

  const hasContent = localInput.trim() || pendingImage;

  return (
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
          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          backgroundColor: 'transparent',
        }
      ]}>
        
        
        <View style={styles.attachRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
            <Ionicons name="camera-outline" size={20} color={colors.textExtraLight} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={localInput}
          onChangeText={setLocalInput}
          placeholder="Message..."
          placeholderTextColor={colors.textExtraLight}
          style={[styles.input, { color: colors.text, fontSize: 16 }]}
          multiline
          maxLength={20000}
          editable={true}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isTyping}
          style={[styles.sendButton, {
            backgroundColor: hasContent && !isTyping ? colors.foreground : 'transparent',
          }]}
        >
          <Ionicons 
            name={hasContent ? "arrow-up" : "time-outline"} 
            size={18} 
            color={hasContent ? colors.background : colors.textExtraLight} 
          />
        </TouchableOpacity>
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
  const [messages, setMessagesState] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.email?.endsWith('@zicabella.com') || false; 

  const flatListRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<(() => void) | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<any[]>([]);
  const catalogContextRef = useRef('');
  const userOrdersContextRef = useRef('');

  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FlatProduct | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  
  // State for user orders
  const [userOrders, setUserOrders] = useState<any[]>([]);

  // Refs for performance optimizations (avoid recreating handleSend callback)
  const isTypingRef = useRef(isTyping);

  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);

  const setMessages = useCallback((updater: React.SetStateAction<Message[]>) => {
    const nextMessages = typeof updater === 'function'
      ? (updater as (prev: Message[]) => Message[])(messagesRef.current)
      : updater;
    messagesRef.current = nextMessages;
    setMessagesState(nextMessages);
  }, []);

  // Throttled scroll to bottom with intelligent scroll-up detection (fixes scroll lock)
  const isNearBottom = useRef(true);
  const lastScrollTime = useRef(0);

  // Streaming token batching — accumulates tokens and flushes at 100ms intervals
  const tokenBuffer = useRef('');
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
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

  // Sync user orders to Zica AI context
  useEffect(() => {
    if (userOrders && userOrders.length > 0) {
      const topOrders = userOrders.slice(0, 3);
      let ctx = `\n\n=== USER ORDERS KNOWLEDGE ===\n`;
      ctx += `When the user asks "where is my order" or asks about their order tracking, show their latest 3 orders from the list below and ask which order they are referring to. Tell the user in details about the order, the delivery process, and shipping. DO NOT say anything about manufacturing, only delivery and shipping.\n\n`;
      topOrders.forEach((order) => {
        ctx += `Order #${order.orderNumber} (ID: ${order.id})\n`;
        ctx += `- Date: ${new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}\n`;
        ctx += `- Status: ${order.status || 'Processing'}\n`;
        ctx += `- Delivery Status: ${order.deliveryStatus || 'Pending'}\n\n`;
      });
      userOrdersContextRef.current = ctx;
    } else {
      userOrdersContextRef.current = '';
    }
  }, [userOrders]);

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
      ctx += `- Product Link Format: [Product Name](zicabella://product/product-handle)\n`;
      ctx += `- Collection Link Format: [Collection Name](zicabella://collection/collection-handle)\n`;
      ctx += `When the user asks about tees, t-shirts, graphic tees, acid wash, printed tops, casual wear, or any related category, always lead your response by referencing the Acid Tees collection first: [Acid Tees Collection](zicabella://collection/acid-tees). Then proceed with other relevant suggestions.\n`;
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

      catalogContextRef.current = ctx;
    });
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.();
    };
  }, []);

  const handleSend = useCallback(async (text?: string, imageToSend?: { uri: string; base64: string; mimeType: string } | null) => {
    const currentIsTyping = isTypingRef.current;
    const currentHistory = conversationHistoryRef.current;
    const currentAbortController = abortControllerRef.current;
    const currentCatalogContext = catalogContextRef.current;
    const currentUserOrdersContext = userOrdersContextRef.current;

    if (!text && !imageToSend) {
      setHistoryVisible(true);
      return;
    }
    const content = (text ?? '').trim();
    if ((!content && !imageToSend) || currentIsTyping) return;

    haptics.buttonTap();

    // Reset scroll lock since the user explicitly sent a message
    isNearBottom.current = true;

    const displayContent = content || 'Analyze this image';
    const userMsg: Message = {
      id: Date.now().toString(),
      content: displayContent,
      isUser: true,
      createdAt: new Date(),
      image: imageToSend?.uri,
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
      tokenBuffer.current = '';
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = setInterval(() => {
        if (tokenBuffer.current.length > 0) {
          const chunk = tokenBuffer.current;
          tokenBuffer.current = '';
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, content: msg.content + chunk, isStreaming: true }
                : msg
            )
          );
          scrollToEndThrottled(false);
        }
      }, 100);

      const abort = callClaudeStream({
        messages: messagesToSend,
        systemPrompt: ZICA_AI_CONFIG.SYSTEM_PROMPT + currentCatalogContext + currentUserOrdersContext,
        onToken: (token) => {
          if (isTypingRef.current) {
            setIsTyping(false);
            isTypingRef.current = false;
          }
          tokenBuffer.current += token;
        },
        onError: (err) => {
          console.error('[Zica AI] Stream error:', err.message);
          if (flushIntervalRef.current) { clearInterval(flushIntervalRef.current); flushIntervalRef.current = null; }
          tokenBuffer.current = '';
          setIsTyping(false);
          isTypingRef.current = false;
          abortControllerRef.current = null;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMsgId
                ? { ...msg, content: `⚠️ ${err.message || 'Something went wrong. Please try again.'}`, isError: true, isStreaming: false }
                : msg
            )
          );
          scrollToEndThrottled(false);
        },
        onComplete: (fullText) => {
          // Stop batching and flush any remaining tokens
          if (flushIntervalRef.current) { clearInterval(flushIntervalRef.current); flushIntervalRef.current = null; }
          tokenBuffer.current = '';
          setIsTyping(false);
          isTypingRef.current = false;
          abortControllerRef.current = null;

          requestAnimationFrame(() => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === aiMsgId
                  ? { ...msg, content: fullText, isStreaming: false }
                  : msg
              )
            );
            conversationHistoryRef.current = [
              ...conversationHistoryRef.current,
              { role: 'user', content: displayContent },
              { role: 'assistant', content: fullText }
            ];
            haptics.success();

            // Write to Cache
            const detected = parseZicaLinks(fullText);
            const detectedProducts = detected.filter(d => d.type === 'product').map(d => d.handle);
            const detectedCollections = sortCollectionHandles(detected.filter(d => d.type === 'collection').map(d => d.handle));
            const newSessionId = currentSessionIdRef.current || Math.random().toString(36).substring(7);
            currentSessionIdRef.current = newSessionId;

            const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';
            fetch(`${APP_URL}/api/zica-ai/cache`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {})
              },
              body: JSON.stringify({
                sessionId: newSessionId,
                turnIndex: currentHistory.length + 1,
                userMessage: displayContent,
                aiResponse: fullText,
                detectedProducts,
                detectedCollections,
                responseTokens: Math.round(fullText.length / 4), // estimation
              })
            }).catch(() => {});
          });
        },
      });

      abortControllerRef.current = abort;
    } catch (err: any) {
      setIsTyping(false);
      isTypingRef.current = false;
      abortControllerRef.current = null;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMsgId
            ? { ...msg, content: '⚠️ Something went wrong. Please try again.', isError: true, isStreaming: false }
            : msg
        )
      );
    }
  }, [scrollToEndThrottled, setMessages]);

  const handleLinkPress = useCallback((url: string) => {
    const zicaTarget = extractZicaLinkTarget(url);
    if (zicaTarget) {
      haptics.buttonTap();
      navigateToZicaEntity(navigation, zicaTarget);
      return false;
    }

    let targetUrl = url;
    
    if (url.includes('/products/') || url.includes('zicabella://product/')) {
      const handle = url.split('/').pop()?.split('?')[0]?.split('#')[0];
      if (handle) {
        targetUrl = 'zica://products/' + handle;
      }
    } else if (url.includes('/collections/') || url.includes('zicabella://collection/')) {
      const handle = url.split('/').pop()?.split('?')[0]?.split('#')[0];
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
      navigateToCollectionScreen(navigation, handle);
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
        conversationHistoryRef.current = claudeHistory;
        currentSessionIdRef.current = sessionId;
        setHistoryVisible(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startNewChat = useCallback(() => {
    setMessages([]);
    conversationHistoryRef.current = [];
    currentSessionIdRef.current = null;
    haptics.success();
  }, [setMessages]);

  useFocusEffect(
    useCallback(() => {
      setTabBarVisible(false);
      return () => {
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => (
    <MessageBubble
      item={item}
      onLinkPress={handleLinkPress}
      userOrders={userOrders}
      isLatest={index === messages.length - 1}
    />
  ), [handleLinkPress, messages.length, userOrders]);

  const handleContentSizeChange = useCallback(() => {
    if (messagesRef.current.length > 0 && isNearBottom.current) {
      scrollToEndThrottled(false);
    }
  }, [scrollToEndThrottled]);

  const renderOnboarding = () => (
    <View style={styles.onboarding}>
      <Animated.View 
        entering={FadeInUp.delay(200).duration(800)} 
        style={styles.onboardingHeader}
      >
        <View style={[
          styles.minimalIconBg, 
          { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }
        ]}>
          <Ionicons name="sparkles" size={24} color={colors.text} />
        </View>
        <Typography heading weight="700" size={24} color={colors.text} style={styles.onboardingGreeting}>
          How can I help you?
        </Typography>
        <Typography weight="500" size={11} color={colors.textMuted} style={styles.onboardingSubtitleChatGPT}>
          {isAdmin ? 'System console active.' : 'Ask Zica for styling advice or order updates.'}
        </Typography>
      </Animated.View>

      <View style={styles.promptListMinimal}>
        {(isAdmin ? ADMIN_QUICK_PROMPTS : QUICK_PROMPTS).map((item, idx) => (
          <Animated.View 
            key={idx} 
            entering={FadeInDown.delay(300 + idx * 80).duration(600)} 
            style={styles.promptItemWrapper}
          >
            <TouchableOpacity
              style={[
                styles.promptCapsuleMinimal, 
                { 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                }
              ]}
              activeOpacity={0.7}
              onPress={() => handleSend(item.label)}
            >
              <BlurView intensity={10} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
              <Ionicons name={item.icon as any} size={15} color={colors.text} style={{ marginRight: 8, opacity: 0.8 }} />
              <Typography size={12} weight="600" color={colors.text}>
                {item.label}
              </Typography>
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
        <View style={{ flex: 1 }}>
          {messages.length === 0 ? (
            <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} android_disableSound={true}>
              {renderOnboarding()}
            </Pressable>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: insets.top + 70 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              removeClippedSubviews={false}
                initialNumToRender={15}
                maxToRenderPerBatch={8}
                updateCellsBatchingPeriod={100}
                windowSize={5}
                onScroll={handleScroll}
                scrollEventThrottle={32}
                onContentSizeChange={handleContentSizeChange}
                ListFooterComponent={
                  isTyping ? (
                    <Animated.View
                      entering={FadeIn.duration(300)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 4 }}
                    >
                      <ActivityIndicator size="small" color={colors.textExtraLight} />
                      <Typography size={11} weight="500" color={colors.textMuted} style={{ marginLeft: 6, opacity: 0.7 }}>
                        Thinking…
                      </Typography>
                    </Animated.View>
                  ) : null
                }
              />
          )}
        </View>

        <InputBar onSend={handleSend} isTyping={isTyping} />
      </KeyboardAvoidingView>

      <ChatHistoryModal 
        visible={historyVisible} 
        onClose={() => setHistoryVisible(false)} 
        onSelectSession={loadSession} 
        onStartNewChat={startNewChat}
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
  onboarding: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  minimalIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  onboardingHeader: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  onboardingGreeting: {
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  onboardingSubtitleChatGPT: {
    textAlign: 'center',
    opacity: 0.5,
    lineHeight: 18,
    maxWidth: 260,
  },
  promptListMinimal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 16,
  },
  promptItemWrapper: {
    // Sized dynamically
  },
  promptCapsuleMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputBarWrapper: { 
    paddingHorizontal: 16, 
    paddingTop: 10,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  inputPill: {
    flexDirection: 'row', 
    alignItems: 'center',
    borderRadius: 20,
    padding: 4, 
    borderWidth: 1,
    minHeight: 40,
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
