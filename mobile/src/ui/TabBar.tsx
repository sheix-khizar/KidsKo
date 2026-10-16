import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, fontFamilies } from '../theme';

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
    <View style={[styles.container, { paddingBottom: bottomPadding, height: 68 + bottomPadding }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.pressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
          >
            <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
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
            {isActive && <View style={styles.activeDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 16,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
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
    marginTop: 1,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
