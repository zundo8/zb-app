import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../constants/colors';
import { FlatCollection } from '../api/types';

interface Props {
  collection: FlatCollection;
}

export default function CollectionTile({ collection }: Props) {
  const navigation = useNavigation<any>();
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface }]}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Collection', { handle: collection.handle })}
    >
      {collection.image ? (
        <Image
          source={{ uri: collection.image }}
          style={styles.image}
          contentFit="cover"
          transition={300}
          placeholder={require('../../assets/load-image-2.jpg')}
        />
      ) : (
        <Image 
          source={require('../../assets/load-image-2.jpg')} 
          style={styles.image}
          contentFit="cover"
        />
      )}
      <View style={styles.overlay}>
        <Text style={styles.title} numberOfLines={2}>
          {collection.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  title: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

