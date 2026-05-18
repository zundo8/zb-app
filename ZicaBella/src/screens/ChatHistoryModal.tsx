import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../constants/colors';
import { Typography } from '../components/Typography';
import { useAuthStore } from '../store/authStore';

interface Session {
  id: string;
  title: string | null;
  createdAt: string;
  _count: { messages: number };
}

interface ChatHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onStartNewChat: () => void;
}

export const ChatHistoryModal = ({ visible, onClose, onSelectSession, onStartNewChat }: ChatHistoryModalProps) => {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useAuthStore(s => s.user);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      loadSessions();
    }
  }, [visible, user?.id]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.zicabella.com';
      const res = await fetch(`${APP_URL}/api/app/claude/history?userId=${user?.id}`);
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={[styles.sessionCard, { backgroundColor: colors.surface, borderColor: 'rgba(150,150,150,0.1)' }]}
      onPress={() => onSelectSession(item.id)}
    >
      <View style={styles.cardHeader}>
        <Ionicons name="chatbubbles-outline" size={16} color={colors.textMuted} />
        <Typography size={14} weight="600" color={colors.text} style={{ flex: 1, marginLeft: 8 }} numberOfLines={1}>
          {item.title || 'New Conversation'}
        </Typography>
      </View>
      <View style={styles.cardFooter}>
        <Typography size={10} color={colors.textExtraLight}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Typography>
        <Typography size={10} color={colors.textExtraLight}>
          {item._count.messages} messages
        </Typography>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Typography size={20} weight="700" color={colors.text}>Chat History</Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity 
              onPress={() => {
                onStartNewChat();
                onClose();
              }} 
              style={styles.closeBtn}
              accessibilityLabel="Start a new chat"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeBtn}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.textMuted} />
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.center}>
                <Typography color={colors.textMuted}>No chat history found.</Typography>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)'
  },
  closeBtn: { padding: 4 },
  listContainer: { padding: 16, gap: 12 },
  sessionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
});
