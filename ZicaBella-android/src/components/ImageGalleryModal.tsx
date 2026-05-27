import React, { useEffect } from 'react';
import { 
  View, 
  Modal, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  StatusBar 
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Media } from '../api/types';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  media: Media[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageGalleryModal({ visible, media, initialIndex, onClose }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [visible, initialIndex, savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ] as any,
  }));

  const item = media[initialIndex];
  if (!item) return null;

  const imageUrl = item.image?.url || (item as any).url || (item as any).src;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar hidden />
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>

        <GestureHandlerRootView style={styles.gestureRoot}>
          <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
            <Animated.View style={[styles.imageWrapper, animatedStyle]}>
              <Image 
                source={{ uri: imageUrl }} 
                style={styles.image} 
                contentFit="contain"
              />
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gestureRoot: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
