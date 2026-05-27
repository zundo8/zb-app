import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Accelerometer } from 'expo-sensors';
import { haptics } from '../utils/haptics';

const SHAKE_THRESHOLD = 1.78;
const TIME_BETWEEN_SHAKES = 1000;

export function useShake() {
  const navigation = useNavigation<any>();
  const lastShakeTime = useRef(0);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const subscription = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const totalForce = Math.sqrt(x * x + y * y + z * z);

      if (totalForce > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShakeTime.current > TIME_BETWEEN_SHAKES) {
          lastShakeTime.current = now;
          haptics.cartShake();
          navigation.navigate('CartTab');
        }
      }
    });

    return () => subscription.remove();
  }, [navigation]);
}
