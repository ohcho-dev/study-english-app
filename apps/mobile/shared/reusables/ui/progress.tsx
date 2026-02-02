import { cn } from '@/shared/reusables/lib/utils';
import * as ProgressPrimitive from '@rn-primitives/progress';
import { Platform, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

function Progress({
  className,
  value,
  indicatorClassName,
  style,
  ...props
}: ProgressPrimitive.RootProps &
  React.RefAttributes<ProgressPrimitive.RootRef> & {
    indicatorClassName?: string;
  }) {
  const colors = useThemeColors();

  // Create a lighter version of primary for the track
  const trackColor = `${colors.primary}33`; // 20% opacity

  return (
    <ProgressPrimitive.Root
      className={cn('relative h-2 w-full overflow-hidden rounded-full', className)}
      style={[{ backgroundColor: trackColor }, style]}
      {...props}>
      <Indicator value={value} className={indicatorClassName} primaryColor={colors.primary} />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

const Indicator = Platform.select({
  web: WebIndicator,
  native: NativeIndicator,
  default: NullIndicator,
});

type IndicatorProps = {
  value: number | undefined | null;
  className?: string;
  primaryColor: string;
};

function WebIndicator({ value, className, primaryColor }: IndicatorProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View
      className={cn('h-full w-full flex-1 transition-all', className)}
      style={{
        backgroundColor: primaryColor,
        transform: `translateX(-${100 - (value ?? 0)}%)`
      }}>
      <ProgressPrimitive.Indicator className={cn('h-full w-full', className)} />
    </View>
  );
}

function NativeIndicator({ value, className, primaryColor }: IndicatorProps) {
  const progress = useDerivedValue(() => value ?? 0);

  const indicator = useAnimatedStyle(() => {
    return {
      width: withSpring(
        `${interpolate(progress.value, [0, 100], [1, 100], Extrapolation.CLAMP)}%`,
        { overshootClamping: true }
      ),
    };
  }, [value]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <ProgressPrimitive.Indicator asChild>
      <Animated.View
        style={[indicator, { backgroundColor: primaryColor }]}
        className={cn('h-full', className)}
      />
    </ProgressPrimitive.Indicator>
  );
}

function NullIndicator(_props: IndicatorProps) {
  return null;
}
