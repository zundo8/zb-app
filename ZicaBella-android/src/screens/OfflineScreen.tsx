import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';
import { useUIStore } from '../store/uiStore';

export default function OfflineScreen() {
  const colors = useColors();
  const setOffline = useUIStore(s => s.setOffline);

  const handleRetry = () => {
    // Force a re-check — NetInfo listener will update state
    setOffline(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textLight} />
      </View>
      <Text style={[styles.brand, { color: colors.textLight }]}>ZICA BELLA</Text>
      <Text style={[styles.title, { color: colors.text }]}>No Connection</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Please check your internet connection and try again.</Text>
      <TouchableOpacity 
        style={[styles.retryButton, { backgroundColor: colors.foreground }]} 
        onPress={handleRetry} 
        activeOpacity={0.85}
      >
        <Text style={[styles.retryText, { color: colors.background }]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconContainer: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 10, fontWeight: '700', letterSpacing: 4, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 13, fontWeight: '300', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  retryButton: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  retryText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
});
