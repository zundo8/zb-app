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
  const lastRotation = useRef({ x: 0, y: 0 });

  useFrame((_state, delta) => {
    if (group.current) {
      // Gentle base rotation
      group.current.rotation.y += delta * 0.4;

      // Add touch-driven rotation
      group.current.rotation.x += touchRotation.current.y * 0.05;
      group.current.rotation.y += touchRotation.current.x * 0.05;

      // Decay touch influence for "inertia"
      touchRotation.current.x *= 0.92;
      touchRotation.current.y *= 0.92;
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <primitive 
          object={scene} 
          scale={2.2} 
          position={[0, 0, 0]} 
          rotation={[0, 0, 0]}
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
  const lastPos = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastPos.current = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
      },
      onPanResponderMove: (evt, gestureState) => {
        // Use velocity and displacement for a responsive "flick" feel
        touchRotation.current.x = gestureState.vx * 0.5;
        touchRotation.current.y = gestureState.vy * 0.5;
      },
      onPanResponderRelease: () => {
        // Inertia takes over via useFrame decay
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
        <ambientLight intensity={1.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />
        <directionalLight position={[0, 5, 5]} intensity={1.5} />
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
