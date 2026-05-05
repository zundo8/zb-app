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

/** Premium sizing for mobile view */
const WRAP_W = 160;
const WRAP_H = 160;

function LogoMesh({ uri }: { uri: string }) {
  const gltf = useGLTF(uri);
  const group = useRef<Group>(null);

  useFrame((state, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.35;
      group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.04;
    }
  });

  return (
    <Center top>
      <group ref={group}>
        <primitive object={gltf.scene} scale={2.2} />
      </group>
    </Center>
  );
}

function Scene({ uri }: { uri: string }) {
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 10, 7]} intensity={3.0} />
      <directionalLight position={[-5, 5, -5]} intensity={2.0} color="#e6f0ff" />
      <pointLight position={[0, 0, 5]} intensity={1.5} />
      <pointLight position={[0, -3, 0]} intensity={1.0} color="#ffffff" />
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
  const colors = useColors();
  return (
    <View style={styles.container}>
      <View style={styles.wrap}>
        <Image source={LOGO_SVG} style={styles.img} contentFit="contain" accessibilityLabel="ZICA BELLA" />
      </View>
      <Typography size={12} weight="800" color={colors.text} style={styles.brandName}>ZICA BELLA</Typography>
      <Typography size={7} weight="600" color={colors.textExtraLight} style={styles.estText}>EST. 2024</Typography>
    </View>
  );
}

export default function FooterLogo3D() {
  const colors = useColors();
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

  if (useSvg) return <SvgMark />;

  if (!uri) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <ActivityIndicator color={colors.textExtraLight} size="small" />
      </View>
    );
  }

  return (
    <LogoErrorBoundary fallback={<SvgMark />}>
      <View style={styles.wrap}>
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 32 }}
          gl={{ alpha: true, antialias: true, logarithmicDepthBuffer: true }}
          style={styles.canvas}
          frameloop="always"
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Scene uri={uri} />
        </Canvas>
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
    marginBottom: 4,
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
    bottom: '20%',
    left: '30%',
    right: '30%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
});

