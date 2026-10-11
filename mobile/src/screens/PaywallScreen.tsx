import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { getCurrentOffering, getMonthlyPackage, getAnnualPackage, purchasePackage } from '../services/billing';
import { colors, radii, spacing, typography } from '../theme';

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
        Alert.alert('Sandbox Mode', `Simulating ${selectedPlan === 'yearly' ? 'Annual ($199/yr)' : 'Monthly ($19.99/mo)'} purchase for dev testing.`);
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
        <ActivityIndicator size="large" color={colors.coralStrong} />
      </View>
    );
  }

  const yearlyPackage = getAnnualPackage(offering);
  const monthlyPackage = getMonthlyPackage(offering);

  const yearlyPriceText = yearlyPackage?.product?.priceString || '$199/year';
  const monthlyPriceText = monthlyPackage?.product?.priceString || '$19.99/month';

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
        >
          <Text style={styles.backBtnText}>✕ Close</Text>
        </Pressable>
      </View>

      {/* Header with Mascot Badge */}
      <View style={styles.header}>
        <View style={styles.mascotBadge}>
          <Text style={styles.mascotEmoji}>🦉</Text>
        </View>
        <Text style={styles.title}>Unlock Kidsko Premium</Text>
        <Text style={styles.subtitle}>
          Supercharge your child's learning with expanded Voice, Video & Chat guidance
        </Text>
      </View>

      {/* Plan Selection Cards */}
      <View style={styles.plansContainer}>
        {/* Yearly Card (Recommended) */}
        <Pressable
          style={[styles.planCard, selectedPlan === 'yearly' && styles.selectedPlanCard]}
          onPress={() => setSelectedPlan('yearly')}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'yearly' }}
          accessibilityLabel="Annual Plan, $199 per year, best value"
        >
          <View style={styles.ribbon}>
            <Text style={styles.ribbonText}>SAVE 17% • BEST VALUE</Text>
          </View>
          <View style={styles.planHeader}>
            <View style={styles.planTitleCol}>
              <Text style={styles.planTitle}>Annual Plan</Text>
              <Text style={styles.planPriceDetail}>$16.58 / month (billed yearly)</Text>
            </View>
            <View style={styles.planPriceCol}>
              <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.selectedPlanPrice]}>
                {yearlyPriceText}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Monthly Card */}
        <Pressable
          style={[styles.planCard, selectedPlan === 'monthly' && styles.selectedPlanCard]}
          onPress={() => setSelectedPlan('monthly')}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'monthly' }}
          accessibilityLabel="Monthly Plan, $19.99 per month"
        >
          <View style={styles.planHeader}>
            <View style={styles.planTitleCol}>
              <Text style={styles.planTitle}>Monthly Plan</Text>
              <Text style={styles.planPriceDetail}>Flexible month-to-month subscription</Text>
            </View>
            <View style={styles.planPriceCol}>
              <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.selectedPlanPrice]}>
                {monthlyPriceText}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Features List */}
      <View style={styles.featuresCard}>
        <Text style={styles.featuresHeading}>Everything included with Premium:</Text>
        <View style={styles.featureItem}>
          <Text style={styles.checkIcon}>✓</Text>
          <Text style={styles.featureText}>100 Voice & Video minutes / week (vs. 10 free)</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.checkIcon}>✓</Text>
          <Text style={styles.featureText}>200 text chat messages / week (vs. 30 free)</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.checkIcon}>✓</Text>
          <Text style={styles.featureText}>15 homework photo uploads / week (vs. 3 free)</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.checkIcon}>✓</Text>
          <Text style={styles.featureText}>Shared pooled family allowance across all children</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.checkIcon}>✓</Text>
          <Text style={styles.featureText}>Detailed parent progress reports & transcripts</Text>
        </View>
      </View>

      {/* Trust Line */}
      <View style={styles.trustLineContainer}>
        <Text style={styles.trustLine}>🔒 No ads. Kids' data stays private.</Text>
      </View>

      {/* Action CTA */}
      <Pressable
        style={[styles.button, purchasing && styles.buttonDisabled]}
        onPress={handleUpgrade}
        disabled={purchasing}
        accessibilityRole="button"
        accessibilityLabel={selectedPlan === 'yearly' ? 'Start Annual Plan' : 'Start Monthly Plan'}
      >
        {purchasing ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>
            {selectedPlan === 'yearly' ? 'Start Annual Plan ($199/yr)' : 'Start Monthly Plan ($19.99/mo)'}
          </Text>
        )}
      </Pressable>

      {/* Cancel / Dismiss */}
      <Pressable
        onPress={onBack}
        style={styles.cancelBtn}
        accessibilityRole="button"
        accessibilityLabel="Stay on free plan"
      >
        <Text style={styles.cancelText}>Not now, stay on free plan</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: 54,
    paddingBottom: 40,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(45, 52, 54, 0.08)',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  mascotBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  mascotEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.subtext,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  plansContainer: {
    marginBottom: spacing.lg,
    gap: 14,
  },
  planCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  selectedPlanCard: {
    borderColor: colors.coralStrong,
    backgroundColor: '#FFFBF9',
    shadowColor: colors.coralStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  ribbon: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: colors.sun,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#E6CF53',
  },
  ribbonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  planPriceDetail: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 3,
    fontWeight: '500',
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  selectedPlanPrice: {
    color: colors.coralStrong,
  },
  featuresCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  featuresHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.green,
    marginTop: 1,
  },
  featureText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  trustLineContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trustLine: {
    fontSize: 13,
    color: colors.subtext,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.coralStrong,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: colors.coralStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    textAlign: 'center',
    color: colors.subtext,
    fontWeight: '700',
    fontSize: 13,
  },
});
