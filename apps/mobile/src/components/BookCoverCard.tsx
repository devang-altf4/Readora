import React from 'react';
import { StyleSheet, Text, View, Image, DimensionValue } from 'react-native';

interface BookCoverCardProps {
  title: string;
  author?: string | null;
  coverUri?: string | null;
  width?: DimensionValue;
  height?: number;
  progressPct?: number;
  isNew?: boolean;
}

// Curated literary color palettes derived deterministically from the book title
const LITERARY_PALETTES = [
  { bg: '#1E293B', accent: '#38BDF8', spine: 'rgba(0,0,0,0.3)', text: '#F8FAFC' }, // Deep Slate Navy
  { bg: '#311B92', accent: '#A78BFA', spine: 'rgba(0,0,0,0.3)', text: '#F5F3FF' }, // Royal Indigo
  { bg: '#064E3B', accent: '#34D399', spine: 'rgba(0,0,0,0.3)', text: '#ECFDF5' }, // Emerald Forest
  { bg: '#881337', accent: '#FB7185', spine: 'rgba(0,0,0,0.3)', text: '#FFF1F2' }, // Burgundy Rose
  { bg: '#78350F', accent: '#FBBF24', spine: 'rgba(0,0,0,0.3)', text: '#FEF3C7' }, // Warm Amber Chestnut
  { bg: '#18181B', accent: '#E4E4E7', spine: 'rgba(0,0,0,0.3)', text: '#FAFAFA' }, // Charcoal Obsidian
  { bg: '#0F766E', accent: '#2DD4BF', spine: 'rgba(0,0,0,0.3)', text: '#F0FDFA' }, // Deep Teal
];

function getPaletteForTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % LITERARY_PALETTES.length;
  return LITERARY_PALETTES[index];
}

export function BookCoverCard({
  title,
  author,
  coverUri,
  width = '100%',
  height = 190,
  progressPct = 0,
  isNew = false,
}: BookCoverCardProps) {
  if (coverUri) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
        {progressPct > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{progressPct}%</Text>
          </View>
        )}
        {isNew && (
          <View style={styles.newBadgeContainer}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>
    );
  }

  const palette = getPaletteForTitle(title);

  return (
    <View style={[styles.container, styles.hardcoverContainer, { width, height, backgroundColor: palette.bg }]}>
      {/* 3D Book Spine Left Overlay */}
      <View style={[styles.spineOverlay, { backgroundColor: palette.spine }]} />
      <View style={styles.spineHighlight} />

      {/* Decorative Outer Border Box */}
      <View style={[styles.coverInnerFrame, { borderColor: `${palette.accent}40` }]}>
        {/* Book Emblem Header */}
        <View style={styles.headerEmblemRow}>
          <Text style={[styles.emblemIcon, { color: palette.accent }]}>📖</Text>
          <Text style={[styles.emblemText, { color: `${palette.text}AA` }]}>READORA EDITION</Text>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.coverTitleText, { color: palette.text }]} numberOfLines={3}>
            {title}
          </Text>
        </View>

        {/* Author Footer */}
        <View style={styles.authorSection}>
          <View style={[styles.dividerLine, { backgroundColor: `${palette.accent}60` }]} />
          <Text style={[styles.coverAuthorText, { color: palette.accent }]} numberOfLines={1}>
            {author || 'READORA SMART BOOK'}
          </Text>
        </View>
      </View>

      {/* Status Badges */}
      {progressPct > 0 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{progressPct}%</Text>
        </View>
      )}
      {isNew && (
        <View style={styles.newBadgeContainer}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  hardcoverContainer: {
    padding: 10,
    justifyContent: 'space-between',
  },
  spineOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
    zIndex: 2,
  },
  spineHighlight: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  coverInnerFrame: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    paddingLeft: 16,
    justifyContent: 'space-between',
  },
  headerEmblemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emblemIcon: {
    fontSize: 10,
  },
  emblemText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  titleSection: {
    marginVertical: 4,
  },
  coverTitleText: {
    fontFamily: 'Playfair Display',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'left',
  },
  authorSection: {
    marginTop: 4,
    gap: 4,
  },
  dividerLine: {
    height: 1,
    width: 24,
  },
  coverAuthorText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  newBadgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 3,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
