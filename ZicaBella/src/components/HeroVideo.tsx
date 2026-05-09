import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../constants/colors';

const { width, height } = Dimensions.get('window');

interface Props {
  source: string;
  height?: number;
  borderRadius?: number;
}

export default function HeroVideo({ source, height: customHeight, borderRadius }: Props) {
  const colors = useColors();
  
  // Guard against empty strings or invalid URLs that cause AVFoundation errors
  const safeSource = source && source.trim() !== '' && source !== '/' ? source : null;

  const player = useVideoPlayer(safeSource, (player) => {
    if (safeSource) {
      player.loop = true;
      player.muted = true;
    }
  });

  const isFocused = useNavigation().isFocused();

  React.useEffect(() => {
    if (!player) return;
    if (!isFocused) {
      player.pause();
    } else {
      player.play();
    }
  }, [isFocused, player]);

  if (!safeSource) {
    return (
      <View style={[styles.container, { height: customHeight || height, borderRadius: borderRadius || 0, backgroundColor: colors.surface }]} />
    );
  }

  return (
    <View style={[styles.container, { height: customHeight || height, borderRadius: borderRadius || 0, backgroundColor: colors.surface }]}>
      <VideoView
        player={player}
        style={[styles.video, { backgroundColor: colors.background, borderRadius: borderRadius || 0 }]}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
