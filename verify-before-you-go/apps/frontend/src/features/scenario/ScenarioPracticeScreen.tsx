import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import {
  floatingTabBarContract,
  getFloatingTabBarHorizontalPadding,
  getNativeFloatingTabBarBottom,
} from '@/features/home/floating-tab-bar-contract';
import { tabRoutes } from '@/features/home/home-content';
import { colors } from '@/theme';

import { ScenarioExercise } from './ScenarioExercise';

const scenarioIllustration = require('../../../assets/prototype/screen07-scenario.jpg');
const gridTexture = require('../../../assets/expo.icon/Assets/grid.png');

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<(typeof tabRoutes)[number]['name'], IconName> = {
  Home: 'home-outline',
  Check: 'scan-outline',
  News: 'newspaper-outline',
  Quiz: 'bulb-outline',
  Help: 'help-buoy-outline',
};

const webTabBarShadow = Platform.select({
  web: { boxShadow: '0 8px 24px rgba(0,34,74,0.22)' },
  default: {},
}) as ViewStyle;

const nativeTabBarShadow = Platform.select({
  web: {},
  default: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
}) as ViewStyle;

const webDockGestureLock = Platform.select({
  web: { overscrollBehavior: 'none', touchAction: 'none' },
  default: {},
}) as unknown as ViewStyle;

export function ScenarioPracticeScreen() {
  return (
    <PrototypeTabScreen
      contentStyle={styles.screenContent}
      overlay={<ScenarioFloatingTabBar />}
      testID="mil-scenario-practice"
    >
      <StatusBar style="dark" />
      <ScenarioExercise
        backIcon={<Ionicons color={colors.body} name="chevron-back" size={20} />}
        ctaIcon={<Ionicons color={colors.paper} name="layers-outline" size={18} />}
        gridTextureSource={gridTexture}
        illustrationSource={scenarioIllustration}
        infoIcon={<Ionicons color={colors.blue} name="information-circle-outline" size={18} />}
        onBack={() => router.replace('/check')}
        onCta={() => router.replace('/check')}
      />
    </PrototypeTabScreen>
  );
}

function ScenarioFloatingTabBar() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomStyle = Platform.OS === 'web'
    ? ({ bottom: floatingTabBarContract.webBottom } as unknown as ViewStyle)
    : { bottom: getNativeFloatingTabBarBottom(insets.bottom) };

  return (
    <View
      accessibilityLabel="Primary navigation"
      style={[
        styles.tabDock,
        webDockGestureLock,
        bottomStyle,
        { paddingHorizontal: getFloatingTabBarHorizontalPadding(width) },
      ]}
    >
      <View style={[styles.tabBar, nativeTabBarShadow, webTabBarShadow]}>
        {tabRoutes.map((route) => {
          const active = route.name === 'Check';
          return (
            <InteractiveSurface
              accessibilityLabel={route.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={route.name}
              onPress={() => router.replace(route.href)}
              pressedStyle={styles.tabPressed}
              style={styles.tabItem}
            >
              <View style={styles.tabIconBox}>
                <Ionicons
                  color={active ? floatingTabBarContract.activeIconColor : floatingTabBarContract.inactiveIconColor}
                  name={tabIcons[route.name]}
                  size={floatingTabBarContract.iconSize}
                />
              </View>
              {active ? <View accessibilityElementsHidden style={styles.tabIndicator} /> : null}
            </InteractiveSurface>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 6, paddingBottom: 104 },
  tabDock: { position: 'absolute', right: 0, left: 0, zIndex: 40, minWidth: 0, width: '100%', maxWidth: '100%', alignItems: 'center' },
  tabBar: { minWidth: 0, width: '100%', maxWidth: floatingTabBarContract.maximumWidth, height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3, borderWidth: 1, borderColor: 'rgba(168,211,242,0.24)', borderRadius: 28, backgroundColor: floatingTabBarContract.backgroundColor },
  tabItem: { minWidth: 0, minHeight: 48, height: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
  tabIconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  tabIndicator: { position: 'absolute', bottom: 3, width: 18, height: 3, borderRadius: 2, backgroundColor: colors.sky },
  tabPressed: { opacity: 0.68 },
});
