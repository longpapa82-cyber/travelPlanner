/**
 * V178 (Issue 3): native LicensesScreen replacing the previous external
 * https://mytravel-planner.com/licenses.html browser hop. Mirrors the
 * Privacy/Terms pattern (NativeStackScreen with i18n content), so the
 * "open source licenses" button stays fully in-app — no Custom Tabs, no
 * Linking.openURL, no expo-web-browser dependency. Each package's GitHub
 * URL still opens with Linking on tap (true external nav, intentional).
 */
import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { useTheme } from '../../contexts/ThemeContext';
import { ProfileStackParamList } from '../../types';
import { LICENSE_SECTIONS, LICENSE_SUMMARY } from '../../constants/licenses';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Licenses'>;

const LicensesScreen: React.FC<Props> = () => {
  const { t } = useTranslation('legal');
  const { theme, isDark } = useTheme();

  const buildNumber =
    Platform.OS === 'android'
      ? Constants.expoConfig?.android?.versionCode
      : Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = `${Constants.expoConfig?.version ?? '1.0.0'}${
    buildNumber ? ` (${buildNumber})` : ''
  }`;

  const surfaceColor = isDark ? '#1e293b' : '#FFFFFF';
  const dividerColor = isDark ? '#334155' : '#F3F4F6';
  const subTextColor = isDark ? '#94a3b8' : '#6B7280';

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {
      // best-effort — taps to open the source repo are external by design
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('licenses.title')}
      </Text>
      <Text style={[styles.subtitle, { color: subTextColor }]}>
        {t('licenses.subtitle')}
      </Text>

      <View
        style={[
          styles.notice,
          { backgroundColor: isDark ? '#1e3a5f' : '#EFF6FF' },
        ]}
      >
        <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 13, lineHeight: 20 }}>
          {t('licenses.notice')}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          {t('licenses.summary')}
        </Text>
        {LICENSE_SUMMARY.map((row, i) => (
          <View
            key={row.spdx}
            style={[
              styles.summaryRow,
              i < LICENSE_SUMMARY.length - 1 && { borderBottomWidth: 1, borderBottomColor: dividerColor },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontSize: 14 }}>{row.spdx}</Text>
            <Text style={{ color: '#3B82F6', fontSize: 14, fontWeight: '600' }}>
              {t('licenses.packages', { count: row.count })}
            </Text>
          </View>
        ))}
      </View>

      {LICENSE_SECTIONS.map((section) => (
        <View key={section.title} style={[styles.card, { backgroundColor: surfaceColor }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            {section.title}
          </Text>
          {section.packages.map((pkg, idx) => (
            <View
              key={pkg.name}
              style={[
                styles.pkg,
                idx < section.packages.length - 1 && { borderBottomWidth: 1, borderBottomColor: dividerColor },
              ]}
            >
              <Text style={[styles.pkgName, { color: theme.colors.text }]}>{pkg.name}</Text>
              <Text style={{ color: subTextColor, fontSize: 12, marginTop: 2 }}>
                {pkg.license}
                {pkg.attribution ? ` — ${pkg.attribution}` : ''}
              </Text>
              <TouchableOpacity onPress={() => openExternal(pkg.url)} accessibilityRole="link">
                <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 4 }}>
                  {pkg.url.replace(/^https?:\/\//, '')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}

      <Text style={[styles.footer, { color: subTextColor }]}>
        {t('licenses.footer')}
      </Text>
      {/* V178: surface versionCode so QA can confirm which build is actually
          running on the test device — the V177 "license still external"
          report turned out to be a build-not-yet-installed artifact. */}
      <Text style={[styles.version, { color: subTextColor }]}>
        v{versionLabel}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  notice: { borderRadius: 8, padding: 12, marginBottom: 24 },
  card: { borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  pkg: { paddingVertical: 10 },
  pkgName: { fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 24 },
  version: { textAlign: 'center', fontSize: 11, marginTop: 8 },
});

export default LicensesScreen;
