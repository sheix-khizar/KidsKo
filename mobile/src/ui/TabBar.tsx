import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
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
  return (
    <View style={[styles.container, { paddingBottom: Platform.OS === 'ios' ? 24 : 10 }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={({ pressed }) => [
              styles.tabItem,
              isActive && styles.activeTabItem,
              pressed && styles.pressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
          >
            <Text style={styles.iconText}>{tab.icon}</Text>
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
    height: 80,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 3,
  },
  activeTabItem: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  iconText: {
    fontSize: 22,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 11,
  },
  activeTabLabel: {
    color: colors.coral,
    fontWeight: '900',
  },
  inactiveTabLabel: {
    color: colors.subtext,
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.coral,
  },
  pressed: {
    opacity: 0.8,
  },
});

