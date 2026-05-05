import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../constants/colors';
import { Typography } from '../../components/Typography';
import CheckoutSummaryBar from '../../components/CheckoutSummaryBar';
import { useCartStore } from '../../store/cartStore';
import { useAuth } from '../../hooks/useAuth';
import { haptics } from '../../utils/haptics';

export default function DeliveryAddressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { user } = useAuth();
  const { total, items, shippingAddress, setShippingAddress } = useCartStore();

  const [loadingPincode, setLoadingPincode] = useState(false);
  const [address, setAddress] = useState({
    name: shippingAddress?.name || user?.name || '',
    phone: shippingAddress?.phone || user?.phone || '',
    street: shippingAddress?.street || '',
    city: shippingAddress?.city || '',
    district: shippingAddress?.district || '',
    state: shippingAddress?.state || '',
    zip: shippingAddress?.zip || '',
    country: 'India',
  });

  const MOCK_SAVED_ADDRESSES = [
    {
      id: '1',
      name: user?.name || 'Home',
      phone: user?.phone || '',
      street: '12B Archive Street, South Ex II',
      city: 'New Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      zip: '110049',
      country: 'India'
    }
  ];

  const fetchPincodeDetails = async (pin: string) => {
    if (pin.length !== 6) return;
    setLoadingPincode(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      if (json[0]?.Status === 'Success') {
        const postOffice = json[0].PostOffice[0];
        setAddress(prev => ({
          ...prev,
          city: postOffice.Block || postOffice.Name,
          district: postOffice.District,
          state: postOffice.State,
        }));
        haptics.success();
      } else {
        haptics.error();
      }
    } catch (e) {
      console.error('Pincode fetch error:', e);
    } finally {
      setLoadingPincode(false);
    }
  };

  const handlePincodeChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, '').slice(0, 6);
    setAddress({ ...address, zip: cleaned });
    if (cleaned.length === 6) {
      fetchPincodeDetails(cleaned);
    }
  };

  const selectSavedAddress = (addr: any) => {
    haptics.buttonTap();
    setAddress({
      ...addr,
      name: addr.name || user?.name || '',
      phone: addr.phone || user?.phone || '',
    });
  };

  const isValid = address.name && address.phone && address.street && address.city && address.zip && address.state;

  const states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 
    'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Typography size={7} color={colors.textExtraLight} weight="600" style={styles.stepTag}>STEP 2 OF 5</Typography>
          <Typography size={14} color={colors.text} weight="700">DELIVERY ADDRESS</Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Typography size={22} weight="700" color={colors.text} style={styles.title}>Where should we send your pieces?</Typography>
        
        <View style={styles.form}>
          <View style={styles.field}>
            <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>FULL NAME</Typography>
            <TextInput
              value={address.name}
              onChangeText={(v) => setAddress({...address, name: v})}
              placeholder="Charlotte Moss"
              placeholderTextColor={colors.textExtraLight}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            />
          </View>

          <View style={styles.field}>
            <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>PHONE NUMBER</Typography>
            <TextInput
              value={address.phone}
              onChangeText={(v) => setAddress({...address, phone: v})}
              placeholder="+91 00000 00000"
              placeholderTextColor={colors.textExtraLight}
              keyboardType="phone-pad"
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            />
          </View>

          <View style={styles.field}>
            <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>STREET ADDRESS</Typography>
            <TextInput
              value={address.street}
              onChangeText={(v) => setAddress({...address, street: v})}
              placeholder="House No, Building, Street..."
              placeholderTextColor={colors.textExtraLight}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { width: 140 }]}>
              <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>PINCODE</Typography>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={address.zip}
                  onChangeText={handlePincodeChange}
                  placeholder="110001"
                  placeholderTextColor={colors.textExtraLight}
                  keyboardType="number-pad"
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                />
                {loadingPincode && (
                  <View style={{ position: 'absolute', right: 15, top: 20 }}>
                    <ActivityIndicator size="small" color={colors.text} />
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>CITY / AREA</Typography>
              <TextInput
                value={address.city}
                onChangeText={(v) => setAddress({...address, city: v})}
                placeholder="New Delhi"
                placeholderTextColor={colors.textExtraLight}
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>DISTRICT</Typography>
              <TextInput
                value={address.district}
                onChangeText={(v) => setAddress({...address, district: v})}
                placeholder="Central Delhi"
                placeholderTextColor={colors.textExtraLight}
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.label}>STATE</Typography>
              <TouchableOpacity 
                onPress={() => {
                  Alert.alert(
                    "Select State",
                    "Choose your state",
                    states.map(s => ({ text: s, onPress: () => setAddress({...address, state: s}) })),
                    { cancelable: true }
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderLight, justifyContent: 'center' }]}>
                  <Typography size={10} color={address.state ? colors.text : colors.textExtraLight}>
                    {address.state || 'Select State'}
                  </Typography>
                  <Ionicons name="chevron-down" size={16} color={colors.textExtraLight} style={{ position: 'absolute', right: 20 }} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Saved Addresses Shortcut */}
        <View style={styles.savedSection}>
          <Typography size={7} weight="600" color={colors.textExtraLight} style={{ marginBottom: 12 }}>SAVED ADDRESSES</Typography>
          {MOCK_SAVED_ADDRESSES.map((item) => (
            <TouchableOpacity 
              key={item.id}
              onPress={() => selectSavedAddress(item)}
              style={[
                styles.savedCard, 
                { 
                  backgroundColor: colors.surface, 
                  borderColor: address.zip === item.zip ? colors.text : colors.borderLight 
                }
              ]}
            >
              <Ionicons name="location-outline" size={20} color={colors.text} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Typography size={10} weight="600" color={colors.text}>HOME (PRIMARY)</Typography>
                <Typography size={9} color={colors.textMuted}>{item.street}, {item.city}...</Typography>
              </View>
              {address.zip === item.zip && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Summary Bar */}
      <CheckoutSummaryBar 
        itemCount={items.length}
        total={total()}
        primaryLabel="CONTINUE TO SHIPPING"
        onPrimaryPress={() => {
          if (!isValid) {
            Alert.alert('Missing Info', 'Please fill all address fields.');
            return;
          }
          haptics.buttonTap();
          setShippingAddress(address);
          navigation.navigate('DeliveryMethod');
        }}
        disabled={!isValid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  back: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { alignItems: 'center' },
  stepTag: { letterSpacing: 2, marginBottom: 2 },
  scroll: { paddingHorizontal: 24, paddingTop: 20 },
  title: { letterSpacing: -0.5, marginBottom: 32 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { letterSpacing: 2, marginLeft: 4 },
  input: { height: 60, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 16 },
  savedSection: { marginTop: 40 },
  savedCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 12 },
});
