import { cn } from '@/shared/reusables/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role, type TextStyle } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

const textVariants = cva(
  cn(
    'text-base',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-4xl font-extrabold tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-b pb-2 text-3xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-2xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
        ),
        lead: 'text-xl',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-none',
        muted: 'text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

// Extended context to support both className, style, and iconColor
interface TextClassContextValue {
  className?: string;
  style?: TextStyle;
  iconColor?: string; // 아이콘 색상 (버튼 내부 아이콘용)
}

const TextClassContext = React.createContext<string | TextClassContextValue | undefined>(undefined);

// Hook to get iconColor from context
export const useTextClassContext = () => {
  const context = React.useContext(TextClassContext);
  if (typeof context === 'string') {
    return { className: context, style: undefined, iconColor: undefined };
  }
  return context || { className: undefined, style: undefined, iconColor: undefined };
};

function Text({
  className,
  asChild = false,
  variant = 'default',
  style,
  ...props
}: React.ComponentProps<typeof RNText> &
  TextVariantProps &
  React.RefAttributes<RNText> & {
    asChild?: boolean;
  }) {
  const colors = useThemeColors();
  const textClassContext = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;

  // Parse context - can be string (legacy) or object (new with style)
  let contextClassName: string | undefined;
  let contextStyle: TextStyle | undefined;

  if (typeof textClassContext === 'string') {
    contextClassName = textClassContext;
  } else if (textClassContext) {
    contextClassName = textClassContext.className;
    contextStyle = textClassContext.style;
  }

  // Get color based on variant
  const getVariantColor = (): string => {
    switch (variant) {
      case 'lead':
      case 'muted':
        return colors.mutedForeground;
      default:
        return colors.foreground;
    }
  };

  // Background for code variant
  const getVariantBg = (): TextStyle | undefined => {
    if (variant === 'code') {
      return { backgroundColor: colors.muted };
    }
    if (variant === 'h2') {
      return { borderColor: colors.border };
    }
    return undefined;
  };

  return (
    <Component
      className={cn(textVariants({ variant }), contextClassName, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      style={[
        { color: getVariantColor() },
        getVariantBg(),
        contextStyle,
        style,
      ]}
      {...props}
    />
  );
}

export { Text, TextClassContext };
