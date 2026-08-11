import { Image, type ImageSourcePropType, StyleSheet, View, type ViewStyle } from 'react-native';

interface MascotIllustrationProps {
  source: ImageSourcePropType;
  style?: ViewStyle;
}

export function MascotIllustration({ source, style }: MascotIllustrationProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, style]}
    >
      <Image accessible={false} resizeMode="contain" source={source} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
