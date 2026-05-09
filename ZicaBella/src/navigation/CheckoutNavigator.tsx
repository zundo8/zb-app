import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DeliveryAddressScreen from '../screens/checkout/DeliveryAddressScreen';
import OrderReviewScreen from '../screens/checkout/OrderReviewScreen';

// Types moved to types.ts to break circular dependencies
import { CheckoutStackParamList } from './types';

const Stack = createNativeStackNavigator<CheckoutStackParamList>();

export default function CheckoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="DeliveryAddress" component={DeliveryAddressScreen} />
      <Stack.Screen name="OrderReview" component={OrderReviewScreen} />
    </Stack.Navigator>
  );
}
