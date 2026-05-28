import { useEffect } from 'react';
import { BackHandler, Alert, Platform } from 'react-native';
import { useNavigationState } from '@react-navigation/native';

export function useAndroidBackHandler() {
  const state = useNavigationState(state => state);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backAction = () => {
      if (!state) return false;
      
      const currentTabRoute = state.routes[state.index];
      const isHomeTab = currentTabRoute?.name === 'HomeTab';
      
      // Check if the HomeTab stack is at its root
      let isAtHomeRoot = false;
      if (isHomeTab) {
        const homeStackState = currentTabRoute.state;
        if (!homeStackState || homeStackState.index === 0) {
          isAtHomeRoot = true;
        }
      }

      if (isAtHomeRoot) {
        Alert.alert('Exit App', 'Are you sure you want to exit Zica Bella?', [
          {
            text: 'Cancel',
            onPress: () => null,
            style: 'cancel',
          },
          { text: 'YES', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      }
      
      return false; // Let React Navigation handle deep navigation back action
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [state]);
}
