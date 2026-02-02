import { cn } from '@/shared/reusables/lib/utils';
import { View } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

function Skeleton({
  className,
  style,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  const colors = useThemeColors();

  return (
    <View
      className={cn('animate-pulse rounded-md', className)}
      style={[{ backgroundColor: colors.accent }, style]}
      {...props}
    />
  );
}

export { Skeleton };
