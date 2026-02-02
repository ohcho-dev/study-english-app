import { TextClassContext } from '@/shared/reusables/ui/text';
import { cn } from '@/shared/reusables/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, View, ViewProps, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

const badgeVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5',
    Platform.select({
      web: 'focus-visible:ring-ring/50 w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        destructive: '',
        outline: '',
        success: '',
        warning: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type BadgeProps = ViewProps &
  React.RefAttributes<View> & {
    asChild?: boolean;
  } & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, style, ...props }: BadgeProps) {
  const colors = useThemeColors();
  const Component = asChild ? Slot.View : View;

  // Get colors based on variant
  const getVariantStyles = (): { bg: ViewStyle; textColor: string } => {
    switch (variant) {
      case 'secondary':
        return {
          bg: { backgroundColor: colors.secondary, borderColor: 'transparent' },
          textColor: colors.secondaryForeground,
        };
      case 'destructive':
        return {
          bg: { backgroundColor: colors.destructive, borderColor: 'transparent' },
          textColor: colors.destructiveForeground,
        };
      case 'success':
        return {
          bg: { backgroundColor: colors.success, borderColor: 'transparent' },
          textColor: colors.successForeground || '#fff',
        };
      case 'warning':
        return {
          bg: { backgroundColor: colors.warning, borderColor: 'transparent' },
          textColor: colors.warningForeground || '#fff',
        };
      case 'outline':
        return {
          bg: { backgroundColor: 'transparent', borderColor: colors.border },
          textColor: colors.foreground,
        };
      default: // 'default' variant
        return {
          bg: { backgroundColor: colors.primary, borderColor: 'transparent' },
          textColor: colors.primaryForeground,
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <TextClassContext.Provider
      value={{
        className: 'text-xs font-medium',
        style: { color: variantStyles.textColor },
      }}
    >
      <Component
        className={cn(badgeVariants({ variant }), className)}
        style={[variantStyles.bg, style]}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
