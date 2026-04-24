import { Tabs } from 'expo-router';
import React from 'react';

import { useTrackerTheme } from '@/app/context/TrackerContext';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const trackerTheme = useTrackerTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: trackerTheme.colors.accent,
        tabBarInactiveTintColor: trackerTheme.colors.text3,
        tabBarStyle: {
          backgroundColor: trackerTheme.colors.bg,
          borderTopColor: trackerTheme.colors.border,
        },
        headerStyle: {
          backgroundColor: trackerTheme.colors.bg,
        },
        headerTintColor: trackerTheme.colors.text,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Update',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="manual"
        options={{
          title: 'Guide',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="book" color={color} />,
        }}
      />
    </Tabs>
  );
}
