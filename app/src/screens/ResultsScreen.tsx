/**
 * Results Screen - Display classification and duty results
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppStore } from '../services/store';
import type { RootStackParamList, ClassificationResult, DutyCalculation } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Results'>;
type ResultsRouteProp = RouteProp<RootStackParamList, 'Results'>;

function ClassificationCard({
  title,
  result,
  isPrimary,
}: {
  title: string;
  result?: ClassificationResult;
  isPrimary?: boolean;
}) {
  if (!result) return null;

  const hasError = !!result.error;

  return (
    <View style={[styles.card, isPrimary && styles.primaryCard]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, isPrimary && styles.primaryText]}>
          {title}
        </Text>
        {!hasError && (
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {(result.confidence * 100).toFixed(0)}% confident
            </Text>
          </View>
        )}
      </View>

      {hasError ? (
        <Text style={styles.errorText}>{result.error}</Text>
      ) : (
        <>
          <View style={styles.hsCodeContainer}>
            <Text style={styles.hsCodeLabel}>HS Code</Text>
            <Text style={[styles.hsCode, isPrimary && styles.primaryText]}>
              {result.hsCode6?.slice(0, 4)}.{result.hsCode6?.slice(4, 6)}
              {result.hsCode8 && `.${result.hsCode.slice(6, 8)}`}
            </Text>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {result.description}
          </Text>

          {result.reasoning && (
            <View style={styles.reasoningContainer}>
              <Text style={styles.reasoningLabel}>Reasoning:</Text>
              <Text style={styles.reasoningText}>{result.reasoning}</Text>
            </View>
          )}

          <Text style={styles.latency}>
            Response time: {result.latencyMs}ms
          </Text>
        </>
      )}
    </View>
  );
}

function DutyCard({
  title,
  duty,
  productValue,
}: {
  title: string;
  duty?: DutyCalculation;
  productValue?: number;
}) {
  if (!duty) return null;

  const hasError = !!duty.error;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title} - Duty Calculation</Text>

      {hasError ? (
        <Text style={styles.errorText}>{duty.error}</Text>
      ) : (
        <>
          <View style={styles.dutyRow}>
            <Text style={styles.dutyLabel}>Product Value</Text>
            <Text style={styles.dutyValue}>
              €{productValue?.toFixed(2) || '0.00'}
            </Text>
          </View>

          <View style={styles.dutyRow}>
            <Text style={styles.dutyLabel}>
              Customs Duty ({duty.duties.rate})
            </Text>
            <Text style={styles.dutyValue}>
              €{duty.duties.amount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.dutyRow}>
            <Text style={styles.dutyLabel}>VAT ({duty.vat.rate})</Text>
            <Text style={styles.dutyValue}>€{duty.vat.amount.toFixed(2)}</Text>
          </View>

          <View style={[styles.dutyRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Landed Cost</Text>
            <Text style={styles.totalValue}>
              €{duty.totalLandedCost.toFixed(2)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

export function ResultsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResultsRouteProp>();
  const { comparisonId } = route.params;

  const result = useAppStore((state) =>
    state.results.find((r) => r.id === comparisonId)
  );

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Result not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const anthropic = result.classifications.anthropic;
  const zonos = result.classifications.zonos;
  const hsMatch =
    anthropic?.hsCode6 && zonos?.hsCode6
      ? anthropic.hsCode6 === zonos.hsCode6
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product Image */}
        {result.imageUri && (
          <Image
            source={{ uri: result.imageUri }}
            style={styles.productImage}
            resizeMode="cover"
          />
        )}

        {/* Match Status */}
        {hsMatch !== null && (
          <View
            style={[
              styles.matchBanner,
              hsMatch ? styles.matchSuccess : styles.matchWarning,
            ]}
          >
            <Text style={styles.matchText}>
              {hsMatch
                ? '✓ Classifications match (HS6)'
                : '⚠ Classifications differ'}
            </Text>
          </View>
        )}

        {/* Classification Results */}
        <Text style={styles.sectionTitle}>Classification Results</Text>

        <ClassificationCard
          title="Anthropic Claude"
          result={anthropic}
          isPrimary
        />

        <ClassificationCard title="Zonos (Baseline)" result={zonos} />

        {/* Duty Calculations */}
        {result.dutyCalculations && result.productValue && (
          <>
            <Text style={styles.sectionTitle}>French Import Duties</Text>

            <DutyCard
              title="Based on Anthropic"
              duty={result.dutyCalculations.anthropic}
              productValue={result.productValue}
            />

            <DutyCard
              title="Based on Zonos"
              duty={result.dutyCalculations.zonos}
              productValue={result.productValue}
            />
          </>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.actionButtonText}>Scan Another Product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  productImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 16,
  },
  matchBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  matchSuccess: {
    backgroundColor: '#E8F5E9',
  },
  matchWarning: {
    backgroundColor: '#FFF3E0',
  },
  matchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  primaryCard: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  primaryText: {
    color: '#1976D2',
  },
  confidenceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  hsCodeContainer: {
    marginBottom: 8,
  },
  hsCodeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  hsCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  reasoningContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  reasoningLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  reasoningText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  latency: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  dutyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dutyLabel: {
    fontSize: 14,
    color: '#666',
  },
  dutyValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#1976D2',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#1976D2',
  },
});
