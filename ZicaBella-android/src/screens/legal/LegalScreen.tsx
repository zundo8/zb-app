import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Linking
} from 'react-native';
import { useRoute } from '@react-navigation/native';

const PRIVACY_POLICY_URL = 'https://zicabella.com/privacy-policy';
const TERMS_URL = 'https://zicabella.com/terms';

type Tab = 'privacy' | 'terms';

export default function LegalScreen() {
  const route = useRoute<any>();
  const [activeTab, setActiveTab] = useState<Tab>(route.params?.tab || 'privacy');

  const openLink = (url: string) => Linking.openURL(url);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabRow}>
        {(['privacy', 'terms'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'privacy' ? (
          <>
            <Text style={styles.heading}>Privacy Policy</Text>
            <Text style={styles.body}>
              Zica Bella ("we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information when you use our mobile application.{'\n\n'}
              <Text style={styles.subheading}>Information We Collect</Text>{'\n'}
              • Account details (name, email, phone number){'\n'}
              • Order and purchase history{'\n'}
              • Device identifiers and crash/analytics data (non-identifying){'\n'}
              • Location data (only when you request delivery estimation, with your permission){'\n\n'}
              <Text style={styles.subheading}>How We Use Your Information</Text>{'\n'}
              • To process and fulfil your orders{'\n'}
              • To provide customer support{'\n'}
              • To improve app performance via anonymous analytics{'\n'}
              • To send order status notifications{'\n\n'}
              <Text style={styles.subheading}>Third-Party Services</Text>{'\n'}
              We use Shopify for order processing, Sentry for crash reporting, and may use analytics services. These services have their own privacy policies.{'\n\n'}
              <Text style={styles.subheading}>Data Retention & Deletion</Text>{'\n'}
              You may request deletion of your account and associated data at any time from the Profile tab → Delete Account.{'\n\n'}
              <Text style={styles.subheading}>Contact Us</Text>{'\n'}
              privacy@zicabella.com
            </Text>
            <TouchableOpacity onPress={() => openLink(PRIVACY_POLICY_URL)}>
              <Text style={styles.link}>View full Privacy Policy →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Terms of Use</Text>
            <Text style={styles.body}>
              By using the Zica Bella app, you agree to the following terms.{'\n\n'}
              <Text style={styles.subheading}>Use of the App</Text>{'\n'}
              The app is intended for personal, non-commercial use. You must be 13 years or older to use the app.{'\n\n'}
              <Text style={styles.subheading}>Orders & Payments</Text>{'\n'}
              All purchases are processed via Shopify. Prices and availability are subject to change. Zica Bella reserves the right to cancel orders in case of errors.{'\n\n'}
              <Text style={styles.subheading}>Returns & Exchanges</Text>{'\n'}
              Please refer to our Returns & Exchanges policy accessible from the Orders tab.{'\n\n'}
              <Text style={styles.subheading}>Intellectual Property</Text>{'\n'}
              All content, images, and branding in this app are property of Zica Bella Private Limited.{'\n\n'}
              <Text style={styles.subheading}>Limitation of Liability</Text>{'\n'}
              Zica Bella is not liable for losses resulting from app downtime, inaccurate product information, or third-party service failures.{'\n\n'}
              <Text style={styles.subheading}>Contact Us</Text>{'\n'}
              support@zicabella.com
            </Text>
            <TouchableOpacity onPress={() => openLink(TERMS_URL)}>
              <Text style={styles.link}>View full Terms of Use →</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#222' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { color: '#666', fontSize: 14, fontWeight: '500' },
  activeTabText: { color: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  subheading: { color: '#fff', fontWeight: '600' },
  body: { color: '#aaa', fontSize: 14, lineHeight: 22 },
  link: { color: '#fff', marginTop: 20, fontSize: 14, textDecorationLine: 'underline' },
});
