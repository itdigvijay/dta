import { trackerTheme } from '@/constants/trackerTheme';
import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const vals = period === 'monthly' ? [72, 80, 65, 78] : [65, 80, 55, 90, 78, 88, 60];
  const days = period === 'monthly' ? ['W1', 'W2', 'W3', 'W4'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const colors = [trackerTheme.colors.accent, trackerTheme.colors.accent2, trackerTheme.colors.accent, trackerTheme.colors.accent2, trackerTheme.colors.accent4, trackerTheme.colors.accent2, trackerTheme.colors.accent];

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Greeting */}
      <View style={styles.greetingBanner}>
        <Text style={styles.greeting}>Good morning,,,,,</Text>
        <Text style={styles.greetingName}>DailyTracker</Text>
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>🔥 7 day streak</Text>
        </View>
      </View>

      {/* Period Tabs */}
      <View style={styles.periodTabsContainer}>
        <View style={styles.periodTabs}>
          {(['daily', 'weekly', 'monthly'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.periodTab, period === tab && styles.periodTabActive]} onPress={() => setPeriod(tab)}>
              <Text style={[styles.periodTabText, period === tab && styles.periodTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.dashGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Completion</Text>
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent2 }]}>78%</Text>
          <Text style={styles.metricSub}>5 of 7 tasks</Text>
          <Text style={[styles.metricTrend, styles.trendUp]}>↑ 12% vs yesterday</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active Hours</Text>
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent }]}>11.5h</Text>
          <Text style={styles.metricSub}>of 16h scheduled</Text>
          <Text style={[styles.metricTrend, styles.trendDown]}>↓ 2h deficit</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Sleep Score</Text>
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent2 }]}>8h</Text>
          <Text style={styles.metricSub}>Target: 8h</Text>
          <Text style={[styles.metricTrend, styles.trendUp]}>✓ Goal met</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Study Time</Text>
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent4 }]}>2h</Text>
          <Text style={styles.metricSub}>of 3h scheduled</Text>
          <Text style={[styles.metricTrend, styles.trendDown]}>↓ 1h remaining</Text>
        </View>
      </View>

      {/* Week Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Completion</Text>
        <View style={styles.chartContainer}>
          <View style={styles.barChart}>
            {vals.map((v, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barVal}>{v}%</Text>
                <View style={[styles.bar, { height: Math.round((v / 100) * 80), backgroundColor: colors[i % colors.length] }]} />
              </View>
            ))}
          </View>
          <View style={styles.chartDays}>
            {days.map((d, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barDay, { color: i === 4 ? trackerTheme.colors.accent : trackerTheme.colors.text3 }]}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Ring Chart */}
      <View style={styles.ringContainer}>
        <Svg width={180} height={180} viewBox="0 0 180 180">
          <Circle cx={90} cy={90} r={70} fill="none" stroke={trackerTheme.colors.surface3} strokeWidth={18} />
          <Circle cx={90} cy={90} r={70} fill="none" stroke={trackerTheme.colors.accent} strokeWidth={18} strokeDasharray={439.8} strokeDashoffset={97} strokeLinecap="round" rotation={-90} originX={90} originY={90} />
          <Circle cx={90} cy={90} r={52} fill="none" stroke={trackerTheme.colors.surface3} strokeWidth={14} />
          <Circle cx={90} cy={90} r={52} fill="none" stroke={trackerTheme.colors.accent2} strokeWidth={14} strokeDasharray={326.7} strokeDashoffset={72} strokeLinecap="round" rotation={-90} originX={90} originY={90} />
          <Circle cx={90} cy={90} r={36} fill="none" stroke={trackerTheme.colors.surface3} strokeWidth={12} />
          <Circle cx={90} cy={90} r={36} fill="none" stroke={trackerTheme.colors.accent4} strokeWidth={12} strokeDasharray={226.2} strokeDashoffset={78} strokeLinecap="round" rotation={-90} originX={90} originY={90} />
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: trackerTheme.colors.text, fontSize: 22, fontWeight: '700' }}>78%</Text>
          <Text style={{ color: trackerTheme.colors.text2, fontSize: 11 }}>overall</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: trackerTheme.colors.accent }]} /><Text style={styles.legendText}>Learn 78%</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: trackerTheme.colors.accent2 }]} /><Text style={styles.legendText}>Sleep 100%</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: trackerTheme.colors.accent4 }]} /><Text style={styles.legendText}>Exercise 65%</Text></View>
      </View>

      {/* Highlights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Highlights</Text>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightSub}>Task completion by category</Text>
          <View style={styles.hoursRow}><Text style={styles.hoursLabel}>Sleep</Text><View style={styles.hoursBar}><View style={[styles.hoursFill, { width: '100%', backgroundColor: trackerTheme.colors.accent2 }]} /></View><Text style={[styles.hoursVal, { color: trackerTheme.colors.accent2 }]}>8/8h</Text></View>
          <View style={styles.hoursRow}><Text style={styles.hoursLabel}>Learning</Text><View style={styles.hoursBar}><View style={[styles.hoursFill, { width: '66%', backgroundColor: trackerTheme.colors.accent }]} /></View><Text style={[styles.hoursVal, { color: trackerTheme.colors.accent }]}>2/3h</Text></View>
          <View style={styles.hoursRow}><Text style={styles.hoursLabel}>Exercise</Text><View style={styles.hoursBar}><View style={[styles.hoursFill, { width: '75%', backgroundColor: trackerTheme.colors.accent4 }]} /></View><Text style={[styles.hoursVal, { color: trackerTheme.colors.accent4 }]}>45m</Text></View>
          <View style={styles.hoursRow}><Text style={styles.hoursLabel}>Work</Text><View style={styles.hoursBar}><View style={[styles.hoursFill, { width: '80%', backgroundColor: trackerTheme.colors.accent3 }]} /></View><Text style={[styles.hoursVal, { color: trackerTheme.colors.accent3 }]}>6/8h</Text></View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  greetingBanner: { padding: 20, paddingTop: 10, paddingBottom: 4 },
  greeting: { fontSize: 13, color: trackerTheme.colors.text2 },
  greetingName: { fontSize: 26, fontWeight: '800', color: trackerTheme.colors.text, letterSpacing: -0.5, marginTop: 2 },
  streakBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(240,168,62,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 6 },
  streakText: { color: trackerTheme.colors.accent4, fontSize: 12, fontWeight: '600' },
  periodTabsContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  periodTabs: { flexDirection: 'row', gap: 6 },
  periodTab: { flex: 1, padding: 8, alignItems: 'center', borderRadius: trackerTheme.radius.sm, borderWidth: 1, borderColor: trackerTheme.colors.border },
  periodTabActive: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  periodTabText: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text2 },
  periodTabTextActive: { color: 'white' },
  dashGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, paddingBottom: 16 },
  metricCard: { width: (width - 50) / 2, backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, borderWidth: 1, borderColor: trackerTheme.colors.border },
  metricLabel: { fontSize: 11, color: trackerTheme.colors.text2, fontWeight: '500', marginBottom: 6 },
  metricVal: { fontSize: 24, fontWeight: '700' },
  metricSub: { fontSize: 11, color: trackerTheme.colors.text3, marginTop: 2 },
  metricTrend: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  trendUp: { color: trackerTheme.colors.accent2 },
  trendDown: { color: trackerTheme.colors.accent3 },
  section: { paddingHorizontal: 20, paddingBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chartContainer: { gap: 6 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 6 },
  chartDays: { flexDirection: 'row', gap: 6 },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 },
  barVal: { fontSize: 9, color: trackerTheme.colors.text2, marginBottom: 4 },
  barDay: { fontSize: 10 },
  ringContainer: { alignItems: 'center', paddingVertical: 8, paddingBottom: 16 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: trackerTheme.colors.text2 },
  highlightCard: { backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, borderWidth: 1, borderColor: trackerTheme.colors.border, marginBottom: 8 },
  highlightSub: { fontSize: 13, color: trackerTheme.colors.text2, marginBottom: 8 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hoursLabel: { fontSize: 12, color: trackerTheme.colors.text2, width: 65 },
  hoursBar: { flex: 1, height: 6, backgroundColor: trackerTheme.colors.surface3, borderRadius: 3, overflow: 'hidden' },
  hoursFill: { height: '100%', borderRadius: 3 },
  hoursVal: { fontSize: 12, fontWeight: '600', width: 40, textAlign: 'right' },
});
