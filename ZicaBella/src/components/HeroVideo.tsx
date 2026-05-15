import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../constants/colors';

const { width, height } = Dimensions.get('window');

interface Props {
  source: string;
  height?: number;
  borderRadius?: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export default function HeroVideo({ 
  source, 
  height: customHeight, 
  borderRadius,
  isMuted = true,
  onToggleMute
}: Props) {
  const colors = useColors();
  const [showIcon, setShowIcon] = React.useState(false);
  const timerRef = React.useRef<any>(null);
  
  // Guard against empty strings or invalid URLs that cause AVFoundation errors
  const safeSource = source && source.trim() !== '' && source !== '/' ? source : null;

  const player = useVideoPlayer(safeSource, (player) => {
    if (safeSource) {
      player.loop = true;
      player.muted = isMuted;
    }
  });

  const isFocused = useNavigation().isFocused();

  React.useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
    
    // Show icon briefly when muted state changes
    setShowIcon(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowIcon(false), 2000);
  }, [isMuted, player]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
      <View style={[styles.container, { height: customHeight || height, borderRadius: borderRadius || 0, backgroundColor: colors.surface }]}>
        <Image 
          source={require('../../assets/load-image-4.jpg')} 
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <TouchableOpacity 
      activeOpacity={0.95}
      onPress={onToggleMute}
      style={[styles.container, { height: customHeight || height, borderRadius: borderRadius || 0, backgroundColor: colors.surface }]}
    >
      <VideoView
        player={player}
        style={[styles.video, { backgroundColor: colors.background, borderRadius: borderRadius || 0 }]}
        nativeControls={false}
        contentFit="cover"
      />
      
      {/* Minimal Floating Mute/Unmute Icon */}
      {showIcon && (
        <View style={styles.muteIconWrapper}>
          <Ionicons 
            name={isMuted ? "volume-mute-outline" : "volume-medium-outline"} 
            size={16} 
            color="#FFF" 
            style={{ opacity: 0.9, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }}
          />
        </View>
      )}
    </TouchableOpacity>
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
  muteIconWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
