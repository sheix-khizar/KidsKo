import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { getCurrentOffering, getMonthlyPackage, getAnnualPackage, purchasePackage } from '../services/billing';

type Props = { onBack: () => void; onPurchased: () => void };

export default function PaywallScreen({ onBack, onPurchased }: Props) {
  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');

  useEffect(() => {
    (async () => {
      const current = await getCurrentOffering();
      setOffering(current);
      setLoading(false);
    })();
  }, []);

  const handleUpgrade = async () => {
    const targetPackage = selectedPlan === 'yearly' ? getAnnualPackage(offering) : getMonthlyPackage(offering);

    if (!targetPackage) {
      if (__DEV__) {
        Alert.alert('Sandbox Mode', `Simulating ${selectedPlan === 'yearly' ? 'Yearly ($79.99/yr)' : 'Monthly ($9.99/mo)'} purchase for dev testing.`);
        onPurchased();
        return;
      }
      Alert.alert('Package Unavailable', 'The selected subscription package could not be loaded. Please try again.');
      return;
    }

    setPurchasing(true);
    try {
      await purchasePackage(targetPackage);
      onPurchased();
    } catch (err: any) {
      if (!err.userCancelled) {
        Alert.alert('Purchase failed', err.message || 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  const yearlyPackage = getAnnualPackage(offering);
  const monthlyPackage = getMonthlyPackage(offering);

  const yearlyPriceText = yearlyPackage?.product?.priceString || '$79.99/year';
  const monthlyPriceText = monthlyPackage?.product?.priceString || '$9.99/month';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Unlock Kidsko Premium 🦉</Text>
      <Text style={styles.subtitle}>Supercharge your child's learning with unlimited guidance</Text>

      {/* Plan Selection Toggle Cards */}
      <View style={styles.plansContainer}>
        {/* Yearly Card (Recommended) */}
        <Pressable
          style={[styles.planCard, selectedPlan === 'yearly' && styles.selectedPlanCard]}
          onPress={() => setSelectedPlan('yearly')}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>33% OFF • BEST VALUE</Text>
          </View>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planTitle}>Annual Plan</Text>
              <Text style={styles.planPriceDetail}>$6.66 / month (billed yearly)</Text>
            </View>
            <Text style={styles.planPrice}>{yearlyPriceText}</Text>
          </View>
        </Pressable>

        {/* Monthly Card */}
        <Pressable
          style={[styles.planCard, selectedPlan === 'monthly' && styles.selectedPlanCard]}
          onPress={() => setSelectedPlan('monthly')}
        >
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planTitle}>Monthly Plan</Text>
              <Text style={styles.planPriceDetail}>Flexible month-to-month</Text>
            </View>
            <Text style={styles.planPrice}>{monthlyPriceText}</Text>
          </View>
        </Pressable>
      </View>

      {/* Features List */}
      <View style={styles.featuresContainer}>
        <Text style={styles.featureItem}>✓ 2,000 text chat messages / month</Text>
        <Text style={styles.featureItem}>✓ 25 live voice call minutes / week (~108 min/mo)</Text>
        <Text style={styles.featureItem}>✓ 20 homework photo helps / week</Text>
        <Text style={styles.featureItem}>✓ Detailed parent progress reports & transcripts</Text>
      </View>

      {/* Action Buttons */}
      <Pressable style={styles.button} onPress={handleUpgrade} disabled={purchasing}>
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {selectedPlan === 'yearly' ? 'Start Annual Plan ($79.99/yr)' : 'Start Monthly Plan ($9.99/mo)'}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={onBack} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Not now, stay on free plan</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  plansContainer: {
    marginBottom: 20,
    gap: 12,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  selectedPlanCard: {
    borderColor: '#1a73e8',
    backgroundColor: '#f0f7ff',
  },
  badge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  planPriceDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1a73e8',
  },
  featuresContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  featureItem: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 17,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 10,
  },
  cancelText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 14,
  },
});
