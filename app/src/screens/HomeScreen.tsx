/**
 * Home Screen - Main entry point with glasses connection status
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGlassesConnection } from '../hooks';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    connectionState,
    device,
    isConnected,
    isScanning,
    isConnecting,
    isMockDevice,
    startScanning,
    disconnect,
  } = useGlassesConnection();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
      case 'scanning':
        return '#FFC107';
      case 'error':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return `Connected to ${device?.name || 'glasses'}`;
      case 'connecting':
        return 'Connecting...';
      case 'scanning':
        return 'Scanning for glasses...';
      case 'error':
        return 'Connection error';
      default:
        return 'Not connected';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DutySnap</Text>
        <Text style={styles.subtitle}>
          Customs Classification with Meta Glasses
        </Text>
      </View>

      {/* Connection Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
          />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {isMockDevice && isConnected && (
          <Text style={styles.mockBadge}>Mock Device</Text>
        )}

        {device && isConnected && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoText}>
              Battery: {device.batteryLevel}%
            </Text>
            <Text style={styles.deviceInfoText}>
              Firmware: {device.firmwareVersion}
            </Text>
          </View>
        )}

        {!isConnected && !isScanning && !isConnecting && (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={startScanning}
          >
            <Text style={styles.connectButtonText}>Connect Glasses</Text>
          </TouchableOpacity>
        )}

        {isConnected && (
          <TouchableOpacity
            style={[styles.connectButton, styles.disconnectButton]}
            onPress={disconnect}
          >
            <Text style={styles.connectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={styles.actionButtonText}>📸 Scan Product</Text>
          <Text style={styles.actionButtonSubtext}>
            {isConnected ? 'Use glasses or camera' : 'Use device camera'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.actionButtonText}>📋 View History</Text>
          <Text style={styles.actionButtonSubtext}>
            See previous classifications
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Point your glasses at a product and tap capture to classify it for
          French customs duties.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  mockBadge: {
    backgroundColor: '#E3F2FD',
    color: '#1976D2',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  deviceInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  deviceInfoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  connectButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#757575',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  primaryButton: {
    backgroundColor: '#1976D2',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
