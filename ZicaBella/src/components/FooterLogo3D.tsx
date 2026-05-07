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

  useFrame((_state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.5;

      if (touchRotation.current.x !== 0 || touchRotation.current.y !== 0) {
        group.current.rotation.x += touchRotation.current.y * 0.5;
        group.current.rotation.y += touchRotation.current.x * 0.5;
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

type Props = {
  /** Same asset as Next.js `components/StorefrontFooter` model-viewer `src` */
  glbUrl?: string;
};

export default function FooterLogo({ glbUrl }: Props) {
  const url = (glbUrl || config.footerLogo3dGlb).trim();
  const touchRotation = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        touchRotation.current.x = gestureState.vx * 0.1;
        touchRotation.current.y = gestureState.vy * 0.1;
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Canvas
        key={url}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2.5} />
        <directionalLight position={[-10, 5, -5]} intensity={1} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Model glbUrl={url} touchRotation={touchRotation} />
          </Bounds>
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
});
