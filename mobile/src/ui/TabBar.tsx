import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from './safeArea';
import { colors, typography, fontFamilies } from '../theme';
import { PressScale } from './motion';

export type TabKey = 'chat' | 'call' | 'parents';

type TabBarProps = {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
};

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'call', label: 'Call', icon: '📞' },
  { key: 'parents', label: 'Parents', icon: '🔒' },
];

export function TabBar({ activeTab, onSelectTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          height: 64 + bottomPadding,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <PressScale
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={styles.tabScale}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.label} tab`}
          >
            <View style={styles.tabItem}>
              <View
                style={[
                  styles.iconWrapper,
                  isActive && styles.activeIconWrapper,
                ]}
              >
                <Text style={styles.iconText}>{tab.icon}</Text>
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
                ]}
              >
                {tab.label}
              </Text>
              {isActive ? (
                <View style={styles.activeDot} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
    shadowColor: '#2D3436',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  tabScale: {
    flex: 1,
    height: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  iconWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 16,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  iconText: {
    fontSize: 20,
  },
  tabLabel: {
    ...typography.caption,
    fontFamily: fontFamilies.extraBold,
    fontSize: 12,
  },
  activeTabLabel: {
    color: colors.coralStrong,
  },
  inactiveTabLabel: {
    color: colors.subtext,
  },
  activeDot: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.coralStrong,
    marginTop: 2,
  },
  dotPlaceholder: {
    width: 20,
    height: 3,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
});
