import React, { Suspense, useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Bounds, Float } from '@react-three/drei';
import { config } from '../constants/config';

function Model({
  glbUrl,
  touchRotation,
}: {
  glbUrl: string;
  touchRotation: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const { scene } = useGLTF(glbUrl);
  const group = useRef<any>(null);
  const currentRotation = useRef({ x: 0, y: 0 });

  useFrame((_state, delta) => {
    if (group.current) {
      // 1. Base auto-rotation (gentle)
      group.current.rotation.y += delta * 0.3;

      // 2. Smoothly interpolate the touch rotation (LERP)
      // This makes the movement feel "feather light" and fluid
      currentRotation.current.x += (touchRotation.current.x - currentRotation.current.x) * 0.15;
      currentRotation.current.y += (touchRotation.current.y - currentRotation.current.y) * 0.15;

      // 3. Apply the rotation
      group.current.rotation.x += currentRotation.current.y;
      group.current.rotation.y += currentRotation.current.x;

      // 4. Decay the touch target (Inertia)
      touchRotation.current.x *= 0.95;
      touchRotation.current.y *= 0.95;
    }
  });

  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={0.6} floatIntensity={0.6}>
        <primitive 
          object={scene} 
          scale={2.3} 
          position={[0, 0, 0]} 
        />
      </Float>
    </group>
  );
}

type Props = {
  /** Same asset as Next.js `components/StorefrontFooter` model-viewer `src` */
  glbUrl?: string;
};

export default function FooterLogo({ glbUrl }: Props) {
  const url = (glbUrl || config.footerLogo3dGlb).trim();
  const touchRotation = useRef({ x: 0, y: 0 });
  const lastGesture = useRef({ dx: 0, dy: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastGesture.current = { dx: 0, dy: 0 };
      },
      onPanResponderMove: (_evt, gestureState) => {
        // High-sensitivity displacement tracking
        const sensitivity = 0.02;
        const dx = (gestureState.dx - lastGesture.current.dx) * sensitivity;
        const dy = (gestureState.dy - lastGesture.current.dy) * sensitivity;
        
        // Accumulate displacement for the next frame
        touchRotation.current.x = dx;
        touchRotation.current.y = dy;
        
        lastGesture.current = { dx: gestureState.dx, dy: gestureState.dy };
      },
      onPanResponderRelease: (_evt, gestureState) => {
        // Boosted flick velocity for satisfying inertia
        const flickBoost = 0.25;
        touchRotation.current.x = gestureState.vx * flickBoost;
        touchRotation.current.y = gestureState.vy * flickBoost;
      }
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Canvas
        key={url}
        camera={{ position: [0, 0, 6], fov: 40 }}
        gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true }}
      >
        <ambientLight intensity={1.8} />
        <spotLight position={[10, 15, 10]} angle={0.2} penumbra={1} intensity={3} />
        <pointLight position={[-10, -5, -10]} intensity={2} color="#ffffff" />
        <directionalLight position={[0, 10, 5]} intensity={2.5} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.1}>
            <Model glbUrl={url} touchRotation={touchRotation} />
          </Bounds>
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
});
