import { useState, type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface InteractiveSurfaceProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  focusStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  disabledStyle?: StyleProp<ViewStyle>;
}

export function InteractiveSurface({
  children,
  style,
  hoverStyle,
  focusStyle,
  pressedStyle,
  disabledStyle,
  disabled,
  ...props
}: InteractiveSurfaceProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        style,
        hovered && !disabled && hoverStyle,
        focused && !disabled && focusStyle,
        pressed && !disabled && pressedStyle,
        disabled && disabledStyle,
      ]}
    >
      {children}
    </Pressable>
  );
}
