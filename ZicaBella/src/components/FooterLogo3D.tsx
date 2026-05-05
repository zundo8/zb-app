import React, { Suspense, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Center, useGLTF } from '@react-three/drei/native';
import { Image } from 'expo-image';
import type { Group } from 'three';

import { config } from '../constants/config';
import { Typography } from './Typography';
import { useColors } from '../constants/colors';

const LOGO_SVG = require('../assets/ZB-logo-silver.svg');
const SHOPIFY_3D_MODEL_URL = 'https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb';

/** Premium sizing for mobile view - matching web scale */
const WRAP_W = 140;
const WRAP_H = 140;

function LogoMesh({ uri }: { uri: string }) {
  const gltf = useGLTF(uri);
  const group = useRef<Group>(null);

  useFrame((state, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.45;
      group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
    }
  });

  return (
    <Center top>
      <group ref={group}>
        <primitive object={gltf.scene} scale={2.5} />
      </group>
    </Center>
  );
}

function Scene({ uri }: { uri: string }) {
  return (
    <>
      <ambientLight intensity={2.0} />
      <directionalLight position={[10, 10, 10]} intensity={3.5} />
      <directionalLight position={[-10, 5, -10]} intensity={2.5} color="#ffffff" />
      <pointLight position={[0, 0, 8]} intensity={2.0} />
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

function SvgFallback() {
  return (
    <View style={styles.center}>
      <Image source={LOGO_SVG} style={styles.img} contentFit="contain" />
    </View>
  );
}

export default function FooterLogo3D() {
  const colors = useColors();
  const [uri, setUri] = useState<string | null>(null);

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
            setUri(SHOPIFY_3D_MODEL_URL);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setUri(SHOPIFY_3D_MODEL_URL);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!uri) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <ActivityIndicator color={colors.textExtraLight} size="small" />
      </View>
    );
  }

  return (
    <LogoErrorBoundary fallback={<SvgFallback />}>
      <View style={styles.wrap}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 28 }}
          gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true }}
          style={styles.canvas}
          frameloop="always"
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Scene uri={uri} />
        </Canvas>
      </View>
    </LogoErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: WRAP_W,
    height: WRAP_H,
    alignSelf: 'center',
    marginBottom: 0,
  },
  canvas: {
    flex: 1,
  },
  img: {
    width: 80,
    height: 80,
    opacity: 0.8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

