import React from 'react';
import { Image, ImageProps } from 'expo-image';

type Priority = 'low' | 'normal' | 'high';

export type FastImageProps = Omit<ImageProps, 'source'> & {
  source: { uri?: string } | number;
  priority?: Priority;
};

/**
 * App-level FastImage facade.
 * - Uses `expo-image` under the hood (Expo-compatible).
 * - Supports a `priority` prop for parity with react-native-fast-image usage patterns.
 */
export default function FastImage({ priority = 'normal', cachePolicy, ...props }: FastImageProps) {
  return (
    <Image
      {...props}
      cachePolicy={cachePolicy ?? (priority === 'high' ? 'memory-disk' : 'disk')}
    />
  );
}

export const FastImagePriority = {
  low: 'low' as const,
  normal: 'normal' as const,
  high: 'high' as const,
};

