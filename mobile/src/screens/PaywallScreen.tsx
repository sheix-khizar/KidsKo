import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import {
  getCurrentOffering,
  getMonthlyPackage,
  getAnnualPackage,
  purchasePackage,
} from '../services/billing';
import { colors, radii, spacing, typography, fontFamilies, gradients, shadows } from '../theme';
import { LinearGradient } from '../ui/LinearGradient';
import { PressScale, FadeSlideIn, Bounce } from '../ui/motion';
import { useSafeAreaInsets } from '../ui/safeArea';

type Props = { onBack: () => void; onPurchased: () => void };

export default function PaywallScreen({ onBack, onPurchased }: Props) {
  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const current = await getCurrentOffering();
      setOffering(current);
      setLoading(false);
    })();
  }, []);

  const handleUpgrade = async () => {
    const targetPackage =
      selectedPlan === 'yearly'
        ? getAnnualPackage(offering)
        : getMonthlyPackage(offering);

    if (!targetPackage) {
      if (__DEV__) {
        Alert.alert(
          'Sandbox Mode',
          `Simulating ${selectedPlan === 'yearly' ? 'Annual ($199/yr)' : 'Monthly ($19.99/mo)'} purchase for dev testing.`
        );
        onPurchased();
        return;
      }
      Alert.alert(
        'Package Unavailable',
        'The selected subscription package could not be loaded. Please try again.'
      );
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
  const monthlyPriceText =
    monthlyPackage?.product?.priceString || '$19.99/month';

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24) + 12,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        },
      ]}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <PressScale onPress={onBack}>
          <View style={styles.backBtn}>
            <Text style={styles.backBtnText}>✕ Close</Text>
          </View>
        </PressScale>
      </View>

      {/* Header with Mascot Badge */}
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <Bounce>
            <LinearGradient
              colors={gradients.primary.colors}
              start={gradients.primary.start}
              end={gradients.primary.end}
              style={styles.mascotBadge}
            >
              <Text style={styles.mascotEmoji}>🦉</Text>
            </LinearGradient>
          </Bounce>
          <Text style={styles.title}>Unlock Kidsko Premium</Text>
          <Text style={styles.subtitle}>
            Supercharge your child's learning with expanded Voice, Video & Chat guidance
          </Text>
        </View>
      </FadeSlideIn>

      {/* Plan Selection Cards */}
      <FadeSlideIn delay={60}>
        <View style={styles.plansContainer}>
          {/* Yearly Card (Recommended) */}
          <PressScale
            onPress={() => setSelectedPlan('yearly')}
            style={styles.planCardScale}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedPlan === 'yearly' }}
            accessibilityLabel="Annual Plan, $199 per year, best value"
          >
            <View
              style={[
                styles.planCard,
                selectedPlan === 'yearly' && styles.selectedPlanCard,
              ]}
            >
              <LinearGradient
                colors={gradients.primary.colors}
                start={gradients.primary.start}
                end={gradients.primary.end}
                style={styles.ribbon}
              >
                <Text style={styles.ribbonText}>SAVE 17% • BEST VALUE</Text>
              </LinearGradient>
              <View style={styles.planHeader}>
                <View style={styles.planTitleCol}>
                  <Text style={styles.planTitle}>Annual Plan</Text>
                  <Text style={styles.planPriceDetail}>
                    $16.58 / month (billed yearly)
                  </Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text
                    style={[
                      styles.planPrice,
                      selectedPlan === 'yearly' && styles.selectedPlanPrice,
                    ]}
                  >
                    {yearlyPriceText}
                  </Text>
                </View>
              </View>
            </View>
          </PressScale>

          {/* Monthly Card */}
          <PressScale
            onPress={() => setSelectedPlan('monthly')}
            style={styles.planCardScale}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedPlan === 'monthly' }}
            accessibilityLabel="Monthly Plan, $19.99 per month"
          >
            <View
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.selectedPlanCard,
              ]}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleCol}>
                  <Text style={styles.planTitle}>Monthly Plan</Text>
                  <Text style={styles.planPriceDetail}>
                    Flexible month-to-month subscription
                  </Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text
                    style={[
                      styles.planPrice,
                      selectedPlan === 'monthly' && styles.selectedPlanPrice,
                    ]}
                  >
                    {monthlyPriceText}
                  </Text>
                </View>
              </View>
            </View>
          </PressScale>
        </View>
      </FadeSlideIn>

      {/* Features List */}
      <FadeSlideIn delay={120}>
        <View style={styles.featuresCard}>
          <Text style={styles.featuresHeading}>
            Everything included with Premium:
          </Text>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>
              100 Voice & Video minutes / week (vs. 10 free)
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>
              200 text chat messages / week (vs. 30 free)
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>
              15 homework photo uploads / week (vs. 3 free)
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>
              Shared pooled family allowance across all children
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.featureText}>
              Detailed parent progress reports & transcripts
            </Text>
          </View>
        </View>
      </FadeSlideIn>

      {/* Trust Line */}
      <View style={styles.trustLineContainer}>
        <Text style={styles.trustLine}>
          🔒 No ads. Kids' data stays private.
        </Text>
      </View>

      {/* Action CTA with Gradient */}
      <FadeSlideIn delay={180}>
        <PressScale
          onPress={handleUpgrade}
          disabled={purchasing}
          style={styles.ctaScale}
          accessibilityRole="button"
          accessibilityLabel={
            selectedPlan === 'yearly'
              ? 'Start Annual Plan'
              : 'Start Monthly Plan'
          }
        >
          <LinearGradient
            colors={gradients.primary.colors}
            start={gradients.primary.start}
            end={gradients.primary.end}
            style={[styles.buttonGradient, purchasing && styles.buttonDisabled]}
          >
            {purchasing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {selectedPlan === 'yearly'
                  ? 'Start Annual Plan ($199/yr) 🚀'
                  : 'Start Monthly Plan ($19.99/mo) 🚀'}
              </Text>
            )}
          </LinearGradient>
        </PressScale>
      </FadeSlideIn>

      {/* Cancel / Dismiss */}
      <PressScale onPress={onBack}>
        <View style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Not now, stay on free plan</Text>
        </View>
      </PressScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
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
    marginBottom: spacing.sm,
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
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  mascotBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...shadows.glow(colors.coral, 16, 6),
  },
  mascotEmoji: {
    fontSize: 36,
  },
  title: {
    ...typography.heading,
    fontSize: 24,
    fontFamily: fontFamilies.black,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...typography.body,
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  plansContainer: {
    gap: 12,
    marginBottom: spacing.lg,
  },
  planCardScale: {
    width: '100%',
  },
  planCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.card,
  },
  selectedPlanCard: {
    borderColor: colors.coralStrong,
    backgroundColor: colors.cardBgMuted,
  },
  ribbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: radii.md,
  },
  ribbonText: {
    color: colors.white,
    fontFamily: fontFamilies.black,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  planTitleCol: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  planPriceDetail: {
    ...typography.caption,
    fontSize: 12,
    color: colors.subtext,
    marginTop: 2,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 16,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  selectedPlanPrice: {
    color: colors.coralStrong,
    fontSize: 18,
    fontFamily: fontFamilies.black,
  },
  featuresCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  featuresHeading: {
    ...typography.subheading,
    fontSize: 14,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  checkIcon: {
    fontSize: 14,
    color: colors.green,
    fontFamily: fontFamilies.black,
  },
  featureText: {
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  trustLineContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trustLine: {
    ...typography.caption,
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  ctaScale: {
    width: '100%',
    marginBottom: 8,
  },
  buttonGradient: {
    borderRadius: radii.pill,
    height: 52,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    ...shadows.button,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.label,
    color: colors.white,
    fontFamily: fontFamilies.black,
    fontSize: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    ...typography.caption,
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
});
