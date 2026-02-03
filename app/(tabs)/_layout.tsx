import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Icon } from '@/components/nativewindui/Icon';
import { useColorScheme } from '@/lib/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      <Tabs
          screenOptions={{
              headerShown: false,
              tabBarStyle: {
                  backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
                  borderTopWidth: 0, 
                  elevation: 0,
                  height: 60 + (Platform.OS === 'android' ? 10 : 0) + insets.bottom,
                  paddingBottom: insets.bottom + 8,
                  paddingTop: 8,
              },
              tabBarActiveTintColor: colorScheme === 'dark' ? 'white' : 'black',
              tabBarInactiveTintColor: '#9ca3af',
              tabBarShowLabel: false,
          }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? "house.fill" : "house"} size={26} color={color} />,
          }}
        />
        
        <Tabs.Screen
          name="analysis"
          options={{
            title: 'Laporan',
            tabBarIcon: ({ color, focused }) => <Icon name="chart.pie.fill" size={26} color={color} />,
          }}
        />


        <Tabs.Screen
          name="split-bill"
          options={{
            title: 'Split Bill', 
            tabBarIcon: ({ color }) => <Icon name="scroll" size={26} color={color} />,
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? "gearshape.fill" : "gearshape"} size={26} color={color} />,
          }}
        />

      </Tabs>
    </View>
  );
}
