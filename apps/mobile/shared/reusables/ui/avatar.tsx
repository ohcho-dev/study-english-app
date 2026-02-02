import { cn } from '@/shared/reusables/lib/utils';
import * as AvatarPrimitive from '@rn-primitives/avatar';
import { useThemeColors } from '@/shared/hooks/useThemeColors';

function Avatar({
  className,
  ...props
}: AvatarPrimitive.RootProps & React.RefAttributes<AvatarPrimitive.RootRef>) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: AvatarPrimitive.ImageProps & React.RefAttributes<AvatarPrimitive.ImageRef>) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full', className)} {...props} />;
}

function AvatarFallback({
  className,
  style,
  ...props
}: AvatarPrimitive.FallbackProps & React.RefAttributes<AvatarPrimitive.FallbackRef>) {
  const colors = useThemeColors();

  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex size-full flex-row items-center justify-center rounded-full',
        className
      )}
      style={[{ backgroundColor: colors.muted }, style]}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
