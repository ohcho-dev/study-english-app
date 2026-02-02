import { cn } from '@/shared/reusables/lib/utils';
import { Platform, TextInput, type TextInputProps } from 'react-native';
import { useThemeColors } from '@/shared/hooks/useThemeColors';
import * as React from 'react';

function Input({ className, style, onFocus, onBlur, ...props }: TextInputProps & React.RefAttributes<TextInput>) {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = React.useCallback((e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = React.useCallback((e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  return (
    <TextInput
      className={cn(
        'flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
        props.editable === false &&
        cn(
          'opacity-50',
          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
        ),
        Platform.select({
          web: cn(
            'outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:ring-[3px]'
          ),
        }),
        className
      )}
      style={[
        {
          backgroundColor: colors.background,
          borderColor: isFocused ? colors.ring : colors.input,
          borderWidth: isFocused ? 2 : 1,
          color: colors.foreground,
        },
        style,
      ]}
      placeholderTextColor={colors.mutedForeground}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
}

export { Input };
