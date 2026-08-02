import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SERENE_LITHOS_TOKENS } from '../../src/theme/tokens';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.logoText}>Dindle</Text>
        <Text style={styles.versionText}>Version 1.0.0 (Build 1)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Dindle is a private personal mobile reading application designed to provide a calm, distraction-free reading experience inspired by high-end stationery and digital vellum e-readers.
        </Text>
      </View>

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          Dindle is a private personal reading project inspired by modern e-reader applications. It is not affiliated with or endorsed by Amazon.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SERENE_LITHOS_TOKENS.colors.background,
  },
  content: {
    padding: SERENE_LITHOS_TOKENS.spacing.marginMobile,
    alignItems: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginVertical: 24,
  },
  logoText: {
    fontFamily: SERENE_LITHOS_TOKENS.fonts.heading,
    fontSize: 36,
    fontWeight: '700',
    color: SERENE_LITHOS_TOKENS.colors.primaryInk,
  },
  versionText: {
    fontSize: 13,
    color: SERENE_LITHOS_TOKENS.colors.secondaryInk,
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: SERENE_LITHOS_TOKENS.colors.paper,
    padding: 20,
    borderRadius: SERENE_LITHOS_TOKENS.borderRadius.md,
    marginBottom: 20,
    ...SERENE_LITHOS_TOKENS.elevation.soft,
  },
  bodyText: {
    fontFamily: SERENE_LITHOS_TOKENS.fonts.reading,
    fontSize: 15,
    lineHeight: 24,
    color: SERENE_LITHOS_TOKENS.colors.primaryInk,
  },
  disclaimerCard: {
    width: '100%',
    backgroundColor: SERENE_LITHOS_TOKENS.colors.surface,
    padding: 16,
    borderRadius: SERENE_LITHOS_TOKENS.borderRadius.md,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: SERENE_LITHOS_TOKENS.colors.secondaryInk,
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    color: SERENE_LITHOS_TOKENS.colors.secondaryInk,
  },
});
