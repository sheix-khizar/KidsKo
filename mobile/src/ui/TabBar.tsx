import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';

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

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
  },
  activeIconWrapper: {
    backgroundColor: '#FFEAEA',
  },
  iconText: {
    fontSize: 20,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 12,
  },
  activeTabLabel: {
    color: colors.coralStrong,
  },
  inactiveTabLabel: {
    color: colors.subtext,
  },
  pressed: {
    opacity: 0.8,
  },
});
