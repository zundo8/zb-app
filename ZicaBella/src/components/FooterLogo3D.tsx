import React, { Suspense, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Center, useGLTF } from '@react-three/drei/native';
import { Image } from 'expo-image';
import type { Group } from 'three';

import { config } from '../constants/config';

const LOGO_SVG = require('../assets/ZB-logo-silver.svg');

/** Premium sizing for mobile view (80px matches visual prominence of 56px on web) */
const WRAP_W = 80;
const WRAP_H = 80;

function LogoMesh({ uri }: { uri: string }) {
  const gltf = useGLTF(uri);
  const group = useRef<Group>(null);

  useFrame((state, dt) => {
    if (group.current) {
      // Smooth auto-rotate matching web's model-viewer
      group.current.rotation.y += dt * 0.45;
      // Subtle float 
      group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.08;
    }
  });

  return (
    <Center top>
      <group ref={group}>
        <primitive object={gltf.scene} scale={1.35} />
      </group>
    </Center>
  );
}

function Scene({ uri }: { uri: string }) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={2.5} />
      <directionalLight position={[-5, 5, -5]} intensity={1.2} color="#c8d4ee" />
      <pointLight position={[0, -2, 5]} intensity={0.5} />
      <Suspense fallback={null}>
        <LogoMesh uri={uri} />
      </Suspense>
    </>
  );
}

class LogoErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { err: boolean }
> {
  state = { err: false };

  static getDerivedStateFromError() {
    return { err: true };
  }

  render() {
    if (this.state.err) return this.props.fallback;
    return this.props.children;
  }
}

function SvgMark() {
  return (
    <View style={styles.wrap}>
      <Image source={LOGO_SVG} style={styles.img} contentFit="contain" accessibilityLabel="ZICA BELLA" />
    </View>
  );
}

export default function FooterLogo3D() {
  const [uri, setUri] = useState<string | null>(null);
  const [useSvg, setUseSvg] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${config.appUrl}/api/app/config`);
        const json = await res.json();
        
        if (!cancelled) {
          if (json.config?.media?.footerLogo3dUrl) {
            setUri(json.config.media.footerLogo3dUrl);
          } else {
            setUseSvg(true);
          }
        }
      } catch (err) {
        if (!cancelled) setUseSvg(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (useSvg || !uri) {
    if (!useSvg && !uri) {
      return (
        <View style={[styles.wrap, styles.center]}>
          <ActivityIndicator color="rgba(255,255,255,0.35)" size="small" />
        </View>
      );
    }
    return <SvgMark />;
  }

  return (
    <LogoErrorBoundary fallback={<SvgMark />}>
      <View style={styles.wrap}>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 32 }}
          gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true }}
          style={styles.canvas}
          frameloop="demand"
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Scene uri={uri} />
        </Canvas>
        {/* Subtle shadow ring beneath */}
        <View style={styles.shadow} />
      </View>
    </LogoErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: WRAP_W,
    height: WRAP_H,
    alignSelf: 'center',
    marginBottom: 8,
  },
  canvas: {
    flex: 1,
    zIndex: 2,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shadow: {
    position: 'absolute',
    bottom: '15%',
    left: '25%',
    right: '25%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#FFF',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 1,
  },
});

