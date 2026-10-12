import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { catalog } from '@/data/catalog';
import { pendingApprovals, pendingRewardRequests } from '@/domain/selectors';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { fonts, palette } from '@/theme/tokens';

function TabIcon({ emoji, focused, badge }: { emoji: string; focused: boolean; badge?: number }) {
  return (
    <View>
      <Text style={[styles.icon, { opacity: focused ? 1 : 0.55, transform: [{ scale: focused ? 1.08 : 1 }] }]}>{emoji}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ParentTabs() {
  const t = useT();
  const state = useFamily();
  const waiting = pendingApprovals(state, catalog).length + pendingRewardRequests(state).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.inkSoft,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.line, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: palette.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('parent.tabs.overview'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" focused={focused} badge={waiting} />,
        }}
      />
      <Tabs.Screen
        name="children"
        options={{ title: t('parent.tabs.children'), tabBarIcon: ({ focused }) => <TabIcon emoji="🧒" focused={focused} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: t('parent.tabs.library'), tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} /> }}
      />
      <Tabs.Screen
        name="rewards"
        options={{ title: t('parent.tabs.rewards'), tabBarIcon: ({ focused }) => <TabIcon emoji="🎁" focused={focused} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: t('parent.tabs.more'), tabBarIcon: ({ focused }) => <TabIcon emoji="✨" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 22, lineHeight: 26 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.spark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.bodyBlack, fontSize: 11 },
});
