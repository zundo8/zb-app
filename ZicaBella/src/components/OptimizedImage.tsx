import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image, ImageProps } from 'expo-image';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: any;
  shopifyWidth?: number;
}

export default function OptimizedImage({ 
  source, 
  style, 
  shopifyWidth,
  contentFit = 'cover',
  transition = 200,
  ...props 
}: OptimizedImageProps) {

  // Handle Shopify CDN URLs to request specific sizes
  let finalSource = source;
  if (typeof source === 'string' && source.includes('cdn.shopify.com') && shopifyWidth) {
    // Use simple string manipulation instead of new URL() which is not fully supported in RN
    const separator = source.includes('?') ? '&' : '?';
    finalSource = `${source}${separator}width=${shopifyWidth}`;
  }

  // Wrap string sources as uri objects for expo-image
  const imageSource = typeof finalSource === 'string' ? { uri: finalSource } : finalSource;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={imageSource}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        transition={transition}
        cachePolicy="memory-disk"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
});
