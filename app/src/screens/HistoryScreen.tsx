/**
 * History Screen - View past classifications
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../services/store';
import type { RootStackParamList, ComparisonResult } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

function HistoryItem({
  item,
  onPress,
}: {
  item: ComparisonResult;
  onPress: () => void;
}) {
  const anthropic = item.classifications.anthropic;
  const zonos = item.classifications.zonos;
  const hsMatch = anthropic?.hsCode6 === zonos?.hsCode6;

  const date = new Date(item.timestamp);
  const formattedDate = date.toLocaleDateString();
  const formattedTime = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity style={styles.historyItem} onPress={onPress}>
      {item.imageUri && (
        <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
      )}

      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.productName || 'Unnamed Product'}
        </Text>

        <View style={styles.itemRow}>
          <Text style={styles.hsCode}>
            HS: {anthropic?.hsCode6 || 'N/A'}
          </Text>
          <View
            style={[
              styles.matchIndicator,
              hsMatch ? styles.matchSuccess : styles.matchWarning,
            ]}
          >
            <Text style={styles.matchIndicatorText}>
              {hsMatch ? '✓' : '≠'}
            </Text>
          </View>
        </View>

        <Text style={styles.timestamp}>
          {formattedDate} at {formattedTime}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { results, clearHistory } = useAppStore((state) => ({
    results: state.results,
    clearHistory: state.clearHistory,
  }));

  if (results.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your classification history will appear here
          </Text>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.scanButtonText}>Scan Your First Product</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryItem
            item={item}
            onPress={() =>
              navigation.navigate('Results', { comparisonId: item.id })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {results.length} classification{results.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666',
  },
  clearText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },
  historyItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  hsCode: {
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  matchIndicator: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchSuccess: {
    backgroundColor: '#E8F5E9',
  },
  matchWarning: {
    backgroundColor: '#FFF3E0',
  },
  matchIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 8,
  },
  separator: {
    height: 8,
  },
});
