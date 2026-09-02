import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getCurrentOffering, purchasePackage } from '../services/billing';

type Props = { onBack: () => void; onPurchased: () => void };

export default function PaywallScreen({ onBack, onPurchased }: Props) {
  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    (async () => {
      const current = await getCurrentOffering();
      setOffering(current);
      setLoading(false);
    })();
  }, []);

  const handleUpgrade = async () => {
    if (!offering?.availablePackages?.[0]) {
      if (__DEV__) {
        Alert.alert('Sandbox Mode', 'Simulating purchase successful for dev testing.');
        onPurchased();
        return;
      }
      Alert.alert('Offerings Unavailable', 'Subscription products could not be loaded. Please try again later.');
      return;
    }
    setPurchasing(true);
    try {
      await purchasePackage(offering.availablePackages[0]);
      onPurchased();
    } catch (err: any) {
      if (!err.userCancelled) Alert.alert('Purchase failed', err.message || 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loading} size="large" color="#1a73e8" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Kidsko Premium 🦉</Text>
      <Text style={styles.price}>$9.99/month</Text>
      <Text style={styles.feature}>✓ 2,000 messages/month</Text>
      <Text style={styles.feature}>✓ Higher homework scan limit</Text>
      <Text style={styles.feature}>✓ Weekly progress reports</Text>
      <Pressable style={styles.button} onPress={handleUpgrade} disabled={purchasing}>
        <Text style={styles.buttonText}>{purchasing ? 'Processing...' : 'Start Premium'}</Text>
      </Pressable>
      <Pressable onPress={onBack}>
        <Text style={styles.cancel}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8, color: '#111' },
  price: { fontSize: 32, fontWeight: '900', color: '#1a73e8', textAlign: 'center', marginBottom: 20 },
  feature: { fontSize: 16, marginBottom: 8, textAlign: 'center', color: '#374151' },
  button: { backgroundColor: '#1a73e8', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  cancel: { textAlign: 'center', color: '#9ca3af', marginTop: 16, fontWeight: '600' },
});
