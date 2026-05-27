import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Global navigation reference to allow navigation from non-component logic.
 */
export const navigationRef = createNavigationContainerRef<any>();

/**
 * Safely navigate to a screen from outside a React component.
 */
export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params as any);
  }
}
