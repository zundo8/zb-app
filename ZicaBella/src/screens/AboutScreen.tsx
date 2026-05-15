import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version || '1.0.0';
  const build = Constants.expoConfig?.ios?.buildNumber || '1';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.appName}>Zica Bella</Text>
        <Text style={styles.tagline}>Fashion, curated for you.</Text>
        <Text style={styles.version}>Version {version} ({build})</Text>
        <Text style={styles.copyright}>© 2025 Zica Bella Private Limited{'\n'}All rights reserved.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  appName: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  tagline: { color: '#666', fontSize: 14, marginBottom: 32 },
  version: { color: '#444', fontSize: 13, marginBottom: 8 },
  copyright: { color: '#333', fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
