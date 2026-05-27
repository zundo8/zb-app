import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  /** Optional name for Sentry context */
  screenName?: string;
  /** Custom fallback component */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary for wrapping major screens.
 * Catches render errors and displays a recovery UI instead of white-screening.
 * Reports to Sentry when available.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to Sentry if available
    try {
      const Sentry = require('@sentry/react-native');
      Sentry.captureException(error, {
        contexts: {
          component: {
            name: this.props.screenName ?? 'Unknown',
          },
        },
        extra: {
          componentStack: errorInfo.componentStack,
        },
      });
    } catch {
      // Sentry unavailable — silently ignore
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#000000" />
          </View>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.message}>
            Please restart the app.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            activeOpacity={0.8}
            accessibilityLabel="Retry loading this screen"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC: Wrap a screen component with an error boundary.
 *
 * Usage:
 *   const SafeHomeScreen = withErrorBoundary(HomeScreen, 'HomeScreen');
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string,
) {
  const ComponentWithBoundary = (props: P) => (
    <ErrorBoundary screenName={screenName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  ComponentWithBoundary.displayName = `withErrorBoundary(${screenName})`;
  return ComponentWithBoundary;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 40,
  },
  retryButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 24,
    backgroundColor: '#000000',
    minWidth: 44,
    minHeight: 44,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
