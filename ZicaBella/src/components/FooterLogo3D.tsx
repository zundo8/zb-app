import React, { Suspense, useRef } from 'react';
import { View, StyleSheet, PanResponder, Image } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Bounds, Float } from '@react-three/drei';

const GLB_URL = 'https://cdn.shopify.com/3d/models/e024b09e83a75c03/Zicabella-silver-logo.glb';

function Model({ touchRotation }: { touchRotation: React.MutableRefObject<{ x: number, y: number }> }) {
  const { scene } = useGLTF(GLB_URL);
  const group = useRef<any>(null);

  useFrame((_state, delta) => {
    if (group.current) {
      // Auto-rotate slowly
      group.current.rotation.y += delta * 0.5;

      // Apply touch rotation
      if (touchRotation.current.x !== 0 || touchRotation.current.y !== 0) {
        group.current.rotation.x += touchRotation.current.y * 0.5;
        group.current.rotation.y += touchRotation.current.x * 0.5;

        // Dampen the touch rotation so it stops spinning after letting go
        touchRotation.current.x *= 0.9;
        touchRotation.current.y *= 0.9;
      }
    }
  });

  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <primitive object={scene} scale={2} position={[0, -0.2, 0]} />
      </Float>
    </group>
  );
}

export default function FooterLogo() {
  const touchRotation = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        // Map pixel drag to rotation delta
        touchRotation.current.x = gestureState.vx * 0.1;
        touchRotation.current.y = gestureState.vy * 0.1;
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/**
       * Static background image rendered OUTSIDE <Canvas> as an absolute-positioned
       * sibling. expo-image / native RN components must NEVER go inside <Canvas>
       * because R3F only accepts Three.js scene objects there.
       */}
      <Image
        source={require('../../assets/zica-bella-logo_8.png')}
        style={styles.fallbackImage}
        resizeMode="contain"
      />
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2.5} />
        <directionalLight position={[-10, 5, -5]} intensity={1} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Model touchRotation={touchRotation} />
          </Bounds>
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  fallbackImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
});
