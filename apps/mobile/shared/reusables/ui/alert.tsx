import { Icon } from '@/shared/reusables/ui/icon';
import { Text, TextClassContext } from '@/shared/reusables/ui/text';
import { cn } from '@/shared/reusables/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

function Alert({
  className,
  variant,
  children,
  icon,
  iconClassName,
  style,
  ...props
}: ViewProps &
  React.RefAttributes<View> & {
    icon: LucideIcon;
    variant?: 'default' | 'destructive';
    iconClassName?: string;
  }) {
  const colors = useThemeColors();

  const bgColor = colors.card;
  const borderColor = colors.border;
  const iconColor = variant === 'destructive' ? colors.destructive : colors.foreground;
  const textColor = variant === 'destructive' ? colors.destructive : colors.foreground;

  return (
    <TextClassContext.Provider
      value={{
        className: 'text-sm',
        style: { color: textColor },
      }}>
      <View
        role="alert"
        className={cn(
          'relative w-full rounded-lg border px-4 pb-2 pt-3.5',
          className
        )}
        style={[
          { backgroundColor: bgColor, borderColor: borderColor },
          style,
        ]}
        {...props}>
        <View className="absolute left-3.5 top-3">
          <Icon
            as={icon}
            className={cn('size-4', iconClassName)}
            style={{ color: iconColor }}
          />
        </View>
        {children}
      </View>
    </TextClassContext.Provider>
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      className={cn('mb-1 ml-0.5 min-h-4 pl-6 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  const colors = useThemeColors();

  return (
    <Text
      className={cn(
        'ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed',
        className
      )}
      style={[{ color: colors.mutedForeground }, style]}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
