import { Text, TextClassContext } from '@/shared/reusables/ui/text';
import { cn } from '@/shared/reusables/lib/utils';
import { View, type ViewProps } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

function Card({ className, style, ...props }: ViewProps & React.RefAttributes<View>) {
  const colors = useThemeColors();

  return (
    <TextClassContext.Provider value={{ style: { color: colors.cardForeground } }}>
      <View
        className={cn(
          'flex flex-col gap-6 rounded-xl border py-6 shadow-sm shadow-black/5',
          className
        )}
        style={[
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          style,
        ]}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />;
}

function CardTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      role="heading"
      aria-level={3}
      className={cn('font-semibold leading-none', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  const colors = useThemeColors();

  return (
    <Text
      className={cn('text-sm', className)}
      style={[{ color: colors.mutedForeground }, style]}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return <View className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return <View className={cn('flex flex-row items-center px-6', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
