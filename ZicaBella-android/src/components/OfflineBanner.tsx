import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineBanner() {
  const colors = useColors();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.error} />
      <Text style={[styles.text, { color: colors.error }]}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});
