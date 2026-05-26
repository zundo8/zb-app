import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { useColors } from '../constants/colors';

export type TrackingEvent = {
  status: string;
  dateTime: string;
  location: string;
  instructions: string;
};

interface TrackingTimelineProps {
  timeline: TrackingEvent[];
  currentStatus: string;
}

export default function TrackingTimeline({ timeline, currentStatus }: TrackingTimelineProps) {
  const colors = useColors();

  if (!timeline || timeline.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Typography size={12} color={colors.textExtraLight} style={styles.emptyText}>
          No tracking updates yet
        </Typography>
      </View>
    );
  }

  // Map Delhivery status codes to internal theme colors
  const getStatusColor = (status: string) => {
    const norm = (status || '').toLowerCase();
    if (norm.includes('delivered')) return colors.success;
    if (norm.includes('out for delivery')) return colors.warning;
    if (norm.includes('rto')) return colors.error;
    return colors.text; // Primary text color
  };

  const activeColor = getStatusColor(currentStatus || timeline[0].status);

  return (
    <View style={styles.container}>
      {timeline.map((event, index) => {
        const isLatest = index === 0;
        const color = isLatest ? activeColor : colors.textMuted;
        
        return (
          <View key={index} style={styles.row}>
            <View style={styles.indicatorContainer}>
              <View 
                style={[
                  styles.circle, 
                  isLatest 
                    ? { backgroundColor: activeColor, borderColor: activeColor } 
                    : { backgroundColor: 'transparent', borderColor: colors.borderExtraLight, borderWidth: 1.5 }
                ]} 
              />
              {index < timeline.length - 1 && (
                <View style={[styles.line, { backgroundColor: colors.borderExtraLight }]} />
              )}
            </View>
            <View style={styles.content}>
              <Typography size={13} weight="700" color={color}>
                {event.status.toUpperCase()}
              </Typography>
              {event.location ? (
                <Typography size={11} color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {event.location}
                </Typography>
              ) : null}
              {event.instructions ? (
                <Typography size={11} color={colors.textExtraLight} style={{ marginTop: 2, fontStyle: 'italic' }}>
                  {event.instructions}
                </Typography>
              ) : null}
              <Typography size={10} color={colors.textExtraLight} style={{ marginTop: 4 }}>
                {new Date(event.dateTime).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  indicatorContainer: {
    alignItems: 'center',
    width: 16,
  },
  circle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  line: {
    width: 1.5,
    flex: 1,
    marginVertical: 4,
  },
  content: {
    flex: 1,
    paddingBottom: 24,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
});
