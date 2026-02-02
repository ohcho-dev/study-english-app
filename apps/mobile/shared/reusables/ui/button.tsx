import { TextClassContext } from '@/shared/reusables/ui/text';
import { cn } from '@/shared/reusables/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'shadow-sm shadow-black/5 active:opacity-80',
          Platform.select({ web: 'hover:opacity-90' })
        ),
        destructive: cn(
          'shadow-sm shadow-black/5 active:opacity-80',
          Platform.select({
            web: 'hover:opacity-90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
          })
        ),
        outline: cn(
          'border shadow-sm shadow-black/5 active:opacity-80',
          Platform.select({
            web: 'hover:opacity-90',
          })
        ),
        secondary: cn(
          'shadow-sm shadow-black/5 active:opacity-80',
          Platform.select({ web: 'hover:opacity-80' })
        ),
        ghost: cn(
          'active:opacity-70',
          Platform.select({ web: 'hover:opacity-80' })
        ),
        link: 'active:opacity-70',
      },
      size: {
        default: cn('h-10 px-4 py-2 sm:h-9', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn('h-9 gap-1.5 rounded-md px-3 sm:h-8', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-11 rounded-md px-6 sm:h-10', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-10 w-10 sm:h-9 sm:w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn(
    'text-sm font-medium',
    Platform.select({ web: 'pointer-events-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        default: '',
        destructive: '',
        outline: '',
        secondary: '',
        ghost: '',
        link: cn(
          'underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, style, ...props }: ButtonProps) {
  const colors = useThemeColors();

  // Get background and text colors based on variant
  // 배경이 채워진 버튼 = 흰색/밝은 텍스트
  // 배경이 투명한 버튼 = foreground 색상 텍스트
  const getVariantStyles = (): { bg: ViewStyle; textColor: string; iconColor: string } => {
    switch (variant) {
      case 'destructive':
        return {
          bg: { backgroundColor: colors.destructive },
          textColor: colors.destructiveForeground,
          iconColor: colors.destructiveForeground,
        };
      case 'outline':
        return {
          bg: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
          textColor: colors.foreground,
          iconColor: colors.foreground,
        };
      case 'secondary':
        return {
          bg: { backgroundColor: colors.secondary },
          textColor: colors.secondaryForeground,
          iconColor: colors.secondaryForeground,
        };
      case 'ghost':
        return {
          bg: { backgroundColor: 'transparent' },
          textColor: colors.foreground,
          iconColor: colors.foreground,
        };
      case 'link':
        return {
          bg: { backgroundColor: 'transparent' },
          textColor: colors.primary,
          iconColor: colors.primary,
        };
      default: // 'default' variant - Primary 버튼
        return {
          bg: { backgroundColor: colors.primary },
          textColor: colors.primaryForeground,
          iconColor: colors.primaryForeground,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // NativeWind className이 style prop보다 우선하므로,
  // View로 감싸서 배경색을 적용
  return (
    <TextClassContext.Provider
      value={{
        className: buttonTextVariants({ variant, size }),
        style: { color: variantStyles.textColor },
        iconColor: variantStyles.iconColor,
      }}
    >
      <View style={[variantStyles.bg, { borderRadius: 6, overflow: 'hidden' }]}>
        <Pressable
          className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
          style={(state) => [
            state.pressed && { opacity: 0.8 },
            typeof style === 'function' ? style(state) : style,
          ]}
          role="button"
          {...props}
        />
      </View>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
