import { cn } from '@/shared/reusables/lib/utils';
import * as SeparatorPrimitive from '@rn-primitives/separator';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  style,
  ...props
}: SeparatorPrimitive.RootProps & React.RefAttributes<SeparatorPrimitive.RootRef>) {
  const colors = useThemeColors();

  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      style={[{ backgroundColor: colors.border }, style]}
      {...props}
    />
  );
}

export { Separator };
