import React, { Suspense, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Bounds } from '@react-three/drei';
import { useFocusEffect } from '@react-navigation/native';
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
  const velocity = useRef({ x: 0, y: 0 });

  useFrame((_state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.2;
      velocity.current.x += (touchRotation.current.x - velocity.current.x) * 0.2;
      velocity.current.y += (touchRotation.current.y - velocity.current.y) * 0.2;
      group.current.rotation.y += velocity.current.x;
      group.current.rotation.x += velocity.current.y;
      touchRotation.current.x *= 0.98;
      touchRotation.current.y *= 0.98;
    }
  });

  return (
    <group ref={group}>
      <primitive 
        object={scene} 
        scale={2.4} 
        position={[0, 0, 0]} 
      />
    </group>
  );
}

type Props = {
  glbUrl?: string;
};

export default function FooterLogo({ glbUrl }: Props) {
  const url = (glbUrl || config.footerLogo3dGlb).trim();
  const touchRotation = useRef({ x: 0, y: 0 });
  const lastGesture = useRef({ dx: 0, dy: 0 });
  const [renderKey, setRenderKey] = useState(0);

  // Force re-initialization of Canvas when screen gains focus
  // This prevents the GL context from disappearing after navigation
  useFocusEffect(
    useCallback(() => {
      setRenderKey(prev => prev + 1);
      return () => {};
    }, [])
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastGesture.current = { dx: 0, dy: 0 };
      },
      onPanResponderMove: (_evt, gestureState) => {
        const sensitivity = 0.025;
        const dx = (gestureState.dx - lastGesture.current.dx) * sensitivity;
        const dy = (gestureState.dy - lastGesture.current.dy) * sensitivity;
        touchRotation.current.x = dx;
        touchRotation.current.y = dy;
        lastGesture.current = { dx: gestureState.dx, dy: gestureState.dy };
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const flickBoost = 0.3;
        touchRotation.current.x = gestureState.vx * flickBoost;
        touchRotation.current.y = gestureState.vy * flickBoost;
      }
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Canvas
        key={`${url}-${renderKey}`}
        camera={{ position: [0, 0, 6], fov: 40 }}
        gl={{ 
          alpha: true, 
          antialias: true, 
          logarithmicDepthBuffer: true,
          powerPreference: "high-performance" 
        }}
      >
        <ambientLight intensity={2} />
        <spotLight position={[10, 20, 10]} angle={0.2} penumbra={1} intensity={4} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={3} color="#ffffff" />
        <directionalLight position={[0, 10, 5]} intensity={3} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1}>
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
