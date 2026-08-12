import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import {
  floatingTabBarContract,
  getFloatingTabBarHorizontalPadding,
  getNativeFloatingTabBarBottom,
} from '@/features/home/floating-tab-bar-contract';
import {
  createWebFloatingTabBarKeyboardController,
  getNativeKeyboardVisibilityEvents,
  isTouchMobileWebEnvironment,
} from '@/features/home/floating-tab-bar-keyboard';
import { tabRoutes } from '@/features/home/home-content';
import { colors } from '@/theme';

type FloatingTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<string, IconName> = {
  index: 'home-outline',
  check: 'scan-outline',
  news: 'newspaper-outline',
  quiz: 'bulb-outline',
  help: 'help-buoy-outline',
};

export const primaryTabRouteNames = ['index', 'check', 'news', 'quiz', 'help'] as const;
const primaryTabHrefs = {
  index: '/',
  check: '/check',
  news: '/news',
  quiz: '/quiz',
  help: '/help',
} as const;

export function getPrimaryTabRouteName(routeName: string | undefined) {
  if (!routeName) return undefined;
  if (routeName === 'index' || routeName === 'how-it-works') return 'index';
  return primaryTabRouteNames.find((name) => name !== 'index' && (
    routeName === name || routeName.startsWith(`${name}/`)
  ));
}

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas, overflow: 'hidden' },
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Home',
          title: tabRoutes[0].name,
        }}
      />
      <Tabs.Screen
        name="check"
        options={{
          tabBarAccessibilityLabel: 'Check',
          title: tabRoutes[1].name,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          tabBarAccessibilityLabel: 'News',
          title: tabRoutes[2].name,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          tabBarAccessibilityLabel: 'Quiz',
          title: tabRoutes[3].name,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          tabBarAccessibilityLabel: 'Help',
          title: tabRoutes[4].name,
        }}
      />
      <Tabs.Screen
        name="how-it-works"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="share"
        options={{ href: null }}
      />
    </Tabs>
  );
}

export function FloatingTabBar({ descriptors, navigation, state }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisibility();
  const reduceMotionEnabled = useReduceMotionPreference();
  const currentRouteName = state.routes[state.index]?.name;
  const activeRouteName = getPrimaryTabRouteName(currentRouteName);
  const visibleRoutes = primaryTabRouteNames.flatMap((routeName) => {
    const route = state.routes.find((candidate) => candidate.name === routeName);
    return route ? [route] : [];
  });
  const dockBottomStyle = Platform.OS === 'web'
    ? ({ bottom: floatingTabBarContract.webBottom } as unknown as ViewStyle)
    : { bottom: getNativeFloatingTabBarBottom(insets.bottom) };

  return (
    <View
      accessibilityElementsHidden={keyboardVisible}
      importantForAccessibility={keyboardVisible ? 'no-hide-descendants' : 'auto'}
      style={[
        styles.dock,
        webDockGestureLock,
        dockBottomStyle,
        { paddingHorizontal: getFloatingTabBarHorizontalPadding(width) },
        keyboardVisible ? styles.dockKeyboardHidden : styles.dockInteractive,
      ]}
    >
      <View accessibilityLabel="Primary navigation" style={[styles.bar, nativeBarShadow, webBarTreatment]} testID="floating-primary-tabs">
        {visibleRoutes.map((route) => {
          const focused = activeRouteName === route.name;
          const options = descriptors[route.key]?.options;
          const icon = tabIcons[route.name] ?? 'ellipse-outline';
          const accessibilityLabel = options?.tabBarAccessibilityLabel ?? options?.title ?? route.name;
          const isHowItWorksHomeParent = currentRouteName === 'how-it-works' && route.name === 'index';

          const navigate = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if ((!focused || isHowItWorksHomeParent) && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <FloatingTabItem
              accessibilityLabel={accessibilityLabel}
              disabled={keyboardVisible}
              focused={focused}
              href={primaryTabHrefs[route.name as keyof typeof primaryTabHrefs]}
              icon={icon}
              key={route.key}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              onPress={navigate}
              reduceMotionEnabled={reduceMotionEnabled}
              testID={`floating-tab-${route.name}`}
            />
          );
        })}
      </View>
    </View>
  );
}

function FloatingTabItem({
  accessibilityLabel,
  disabled,
  focused,
  href,
  icon,
  onLongPress,
  onPress,
  reduceMotionEnabled,
  testID,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  focused: boolean;
  href: string;
  icon: IconName;
  onLongPress: () => void;
  onPress: () => void;
  reduceMotionEnabled: boolean;
  testID: string;
}) {
  const [activeProgress] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    const toValue = focused ? 1 : 0;
    activeProgress.stopAnimation();

    if (reduceMotionEnabled) {
      activeProgress.setValue(toValue);
      return;
    }

    Animated.timing(activeProgress, {
      toValue,
      duration: floatingTabBarContract.animationDurationMs,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeProgress, focused, reduceMotionEnabled]);

  const animatedIconStyle = reduceMotionEnabled
    ? undefined
    : {
        opacity: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
        transform: [{
          scale: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
        }],
      };
  const animatedIndicatorStyle = reduceMotionEnabled
    ? { opacity: focused ? 1 : 0 }
    : {
        opacity: activeProgress,
        transform: [{
          scaleX: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
        }],
      };
  const webHrefProps = Platform.OS === 'web' ? { href } : {};

  return (
    <InteractiveSurface
      {...webHrefProps}
      aria-selected={focused}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      pressedStyle={reduceMotionEnabled ? styles.tabPressedReduced : styles.tabPressed}
      style={styles.tab}
      testID={testID}
    >
      <Animated.View style={[styles.iconBox, animatedIconStyle]}>
        <Ionicons
          color={focused
            ? floatingTabBarContract.activeIconColor
            : floatingTabBarContract.inactiveIconColor}
          name={icon}
          size={floatingTabBarContract.iconSize}
        />
      </Animated.View>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.activeIndicator, animatedIndicatorStyle]}
      />
    </InteractiveSurface>
  );
}

function useReduceMotionPreference() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return enabled;
}

function useKeyboardVisibility() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const events = getNativeKeyboardVisibilityEvents(
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other',
      );
      const showSubscription = Keyboard.addListener(events.show, () => setVisible(true));
      const hideSubscription = Keyboard.addListener(events.hide, () => setVisible(false));

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }

    const visualViewport = window.visualViewport;
    const touchMobile = isTouchMobileWebEnvironment({
      coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      touchEventSupported: 'ontouchstart' in window,
    });

    return createWebFloatingTabBarKeyboardController({
      touchMobile,
      hasVisualViewport: Boolean(visualViewport),
      getActiveElement: () => document.activeElement,
      getLayoutViewportHeight: () => window.innerHeight,
      getViewportOffsetTop: () => visualViewport?.offsetTop ?? 0,
      getViewportHeight: () => visualViewport?.height ?? window.innerHeight,
      addDocumentListener: (type, listener) => document.addEventListener(type, listener),
      removeDocumentListener: (type, listener) => document.removeEventListener(type, listener),
      addWindowListener: (type, listener) => window.addEventListener(type, listener),
      removeWindowListener: (type, listener) => window.removeEventListener(type, listener),
      addViewportListener: (type, listener) => visualViewport?.addEventListener(type, listener),
      removeViewportListener: (type, listener) => visualViewport?.removeEventListener(type, listener),
      requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (handle) => window.clearTimeout(handle),
      onHiddenChange: setVisible,
    });
  }, []);

  return visible;
}

const webBarTreatment = Platform.select({
  web: {
    boxShadow: '0 8px 24px rgba(0,34,74,0.22)',
  },
  default: {},
}) as ViewStyle;

const webDockGestureLock = Platform.select({
  web: {
    overscrollBehavior: 'none',
    touchAction: 'none',
  },
  default: {},
}) as unknown as ViewStyle;

const nativeBarShadow = Platform.select({
  web: {},
  default: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
}) as ViewStyle;

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    right: 0,
    left: 0,
    zIndex: 40,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  dockKeyboardHidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  dockInteractive: {
    pointerEvents: 'box-none',
  },
  bar: {
    minWidth: 0,
    width: '100%',
    maxWidth: floatingTabBarContract.maximumWidth,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(168,211,242,0.24)',
    borderRadius: 28,
    backgroundColor: floatingTabBarContract.backgroundColor,
  },
  tab: {
    minWidth: 0,
    minHeight: floatingTabBarContract.touchTarget,
    height: floatingTabBarContract.touchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  tabPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },
  tabPressedReduced: {
    opacity: 0.68,
  },
  iconBox: {
    width: floatingTabBarContract.iconSize,
    height: floatingTabBarContract.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 3,
    width: floatingTabBarContract.indicatorWidth,
    height: floatingTabBarContract.indicatorHeight,
    borderRadius: floatingTabBarContract.indicatorRadius,
    backgroundColor: floatingTabBarContract.indicatorColor,
  },
});
