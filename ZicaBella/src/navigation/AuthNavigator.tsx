import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordNavigator from './ForgotPasswordNavigator';
import PrivacyAndTermsScreen from '../screens/auth/PrivacyAndTermsScreen';

// Types moved to types.ts to break circular dependencies
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPasswordFlow" component={ForgotPasswordNavigator} />
      <Stack.Screen name="PrivacyAndTerms" component={PrivacyAndTermsScreen} options={{ presentation: 'formSheet' }} />
    </Stack.Navigator>
  );
}
