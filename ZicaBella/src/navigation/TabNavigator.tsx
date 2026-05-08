import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';

import { useColors } from '../constants/colors';
import { useThemeStore } from '../store/themeStore';
import { useCartStore } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';
import { TabParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CollectionScreen from '../screens/CollectionScreen';
import CommunityScreen from '../screens/CommunityScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import ReturnRequestScreen from '../screens/ReturnRequestScreen';
import ExchangeSelectProductScreen from '../screens/ExchangeSelectProductScreen';
import PolicyScreen from '../screens/PolicyScreen';
import ShopScreen from '../screens/ShopScreen';
import WishlistScreen from '../screens/WishlistScreen';
import StoryScreen from '../screens/StoryScreen';
import FAQScreen from '../screens/FAQScreen';
import BlogsScreen from '../screens/BlogsScreen';
import CollaborationsScreen from '../screens/CollaborationsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

import { BlurView } from 'expo-blur';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CartDrawer from '../components/CartDrawer';
import BookmarkDrawer from '../components/BookmarkDrawer';
import MenuDrawer from '../components/MenuDrawer';
import { useNavigation } from '@react-navigation/native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

// ─── STACKS FOR EACH TAB ─────────────────────────────────────────────
// This ensures the bottom bar stays visible when navigating deep within a tab.

function HomeStack() {
  return (
    <Stack.Navigator id="HomeStack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen as any} />
      <Stack.Screen name="Community" component={CommunityScreen as any} />
      <Stack.Screen name="Story" component={StoryScreen as any} />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator id="SearchStack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="SearchScreen" component={SearchScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen as any} />
    </Stack.Navigator>
  );
}

function ShopStack() {
  return (
    <Stack.Navigator id="ShopStack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="ShopScreen" component={ShopScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen as any} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator id="ProfileStack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen as any} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen as any} />
      <Stack.Screen name="ReturnRequest" component={ReturnRequestScreen as any} />
      <Stack.Screen name="ExchangeSelectProduct" component={ExchangeSelectProductScreen as any} />
      <Stack.Screen name="Wishlist" component={WishlistScreen as any} />
      <Stack.Screen name="Blogs" component={BlogsScreen as any} />
      <Stack.Screen name="Collaborations" component={CollaborationsScreen as any} />
      <Stack.Screen name="Notifications" component={NotificationsScreen as any} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator id="OrdersStack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen as any} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen as any} />
      <Stack.Screen name="ReturnRequest" component={ReturnRequestScreen as any} />
      <Stack.Screen name="ExchangeSelectProduct" component={ExchangeSelectProductScreen as any} />
    </Stack.Navigator>
  );
}

// ───────────────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: any) {
  const isTabBarVisible = useUIStore(s => s.isTabBarVisible);
  const colors = useColors();
  const theme = useThemeStore(s => s.theme);
  const isDark = theme === 'dark';
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(isTabBarVisible ? 0 : 120, {
      duration: 400,
      easing: Easing.bezier(0.33, 1, 0.68, 1),
    });
  }, [isTabBarVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[
      styles.tabBarContainer, 
      animatedStyle,
    ]}>
      <BlurView 
        intensity={isDark ? 50 : 80} 
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill} 
      />
      <View style={[styles.tabContent, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
        {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const Icon = options?.tabBarIcon;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
             <View style={[styles.iconWrapper, isFocused && styles.activeIconWrapper]}>
               {Icon && typeof Icon === 'function' ? Icon({ 
                 focused: isFocused, 
                 color: isFocused ? colors.text : colors.textExtraLight, 
                 size: 18 
               }) : null}
            </View>
            <Text 
              numberOfLines={1}
              style={[
                styles.tabLabel, 
                { color: isFocused ? colors.text : colors.textExtraLight, opacity: isFocused ? 0.9 : 0.4 }
              ]}
            >
              {options.tabBarLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </Animated.View>
  );
}

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      id="MainTabNavigator"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={18} color={color} />,
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStack}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={18} color={color} />,
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatScreen}
        options={{
          tabBarLabel: 'AI Chat',
          tabBarIcon: ({ color }) => <Ionicons name="sparkles-outline" size={18} color={color} />,
        }}
      />
      <Tab.Screen
        name="ShopTab"
        component={ShopStack}
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color }) => <Ionicons name="storefront-outline" size={18} color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={18} color={color} />,
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={18} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 30,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  activeIconWrapper: {
  },
  tabLabel: {
    fontSize: 6.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});

export default TabNavigator;
