import { useTrackerContext } from '@/app/context/TrackerContext';
import { trackerTheme } from '@/constants/trackerTheme';
import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const calcDurHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  let [eh, em] = end.split(':').map(Number);
  if (eh < sh) eh += 24;
  return (eh * 60 + (em || 0) - (sh * 60 + (sm || 0))) / 60;
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { categories, statusUpdates, schedule } = useTrackerContext();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [reportDate, setReportDate] = useState(todayStr);
  const getDates = (daysBack: number) => {
    return Array.from({ length: daysBack }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (daysBack - 1) + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  };

  let chartData: number[] = [];
  let chartLabels: string[] = [];
  let chartColors: string[] = [];
  const colorsPalette = [trackerTheme.colors.accent, trackerTheme.colors.accent2, trackerTheme.colors.accent4, trackerTheme.colors.accent3];

  if (period === 'monthly') {
    const all28 = getDates(28);
    for (let w = 0; w < 4; w++) {
      const weekDates = all28.slice(w * 7, (w + 1) * 7);
      let act = 0, sch = 0;
      weekDates.forEach(d => {
        const daySched = schedule[d] || [];
        daySched.forEach(item => { sch += calcDurHours(item.start, item.end); });

        const dayData = statusUpdates[d];
        if (dayData) {
          Object.values(dayData).forEach(t => { 
            act += t.actual || 0; 
            if (t.activities) Object.values(t.activities).forEach(sub => { act += sub.actual || 0; });
          });
        }
      });
      chartData.push(sch > 0 ? Math.round((act / sch) * 100) : 0);
      chartLabels.push(`W${w + 1}`);
      chartColors.push(colorsPalette[w % colorsPalette.length]);
    }
  } else {
    const last7 = getDates(7);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    last7.forEach((d, i) => {
      let act = 0, sch = 0;
      const daySched = schedule[d] || [];
      daySched.forEach(item => { sch += calcDurHours(item.start, item.end); });

      const dayData = statusUpdates[d];
      if (dayData) {
        Object.values(dayData).forEach(t => { 
          act += t.actual || 0; 
          if (t.activities) Object.values(t.activities).forEach(sub => { act += sub.actual || 0; });
        });
      }
      chartData.push(sch > 0 ? Math.round((act / sch) * 100) : 0);
      const dateObj = new Date(d);
      chartLabels.push(daysOfWeek[dateObj.getDay()]);
      chartColors.push(colorsPalette[i % colorsPalette.length]);
    });
  }

  const activeDates = period === 'daily' ? getDates(1) : period === 'weekly' ? getDates(7) : getDates(28);
  let totalActual = 0;
  let totalSched = 0;
  const categoriesStats: Record<string, { actual: number, scheduled: number, color: string, icon: string }> = {};
  categories.forEach(t => { categoriesStats[t.name] = { actual: 0, scheduled: 0, color: t.color, icon: t.icon }; });

  activeDates.forEach(d => {
    const daySched = schedule[d] || [];
    daySched.forEach(item => {
      const hours = calcDurHours(item.start, item.end);
      if (!categoriesStats[item.categoryName]) {
         const t = categories.find(x => x.name === item.categoryName);
         categoriesStats[item.categoryName] = { actual: 0, scheduled: 0, color: t ? t.color : trackerTheme.colors.accent, icon: t ? t.icon : '📌' };
      }
      categoriesStats[item.categoryName].scheduled += hours;
      totalSched += hours;
    });

    const dayData = statusUpdates[d];
    if (dayData) {
      Object.entries(dayData).forEach(([tName, tData]) => {
        if (!categoriesStats[tName]) categoriesStats[tName] = { actual: 0, scheduled: 0, color: trackerTheme.colors.accent, icon: '📌' };
        let tAct = tData.actual || 0;
        if (tData.activities) Object.values(tData.activities).forEach(sub => { tAct += sub.actual || 0; });
        categoriesStats[tName].actual += tAct;
        totalActual += tAct;
      });
    }
  });

  const overallProgress = totalSched > 0 ? Math.round((totalActual / totalSched) * 100) : 0;
  const sortedCategories = Object.entries(categoriesStats).sort((a, b) => b[1].scheduled - a[1].scheduled).filter(t => t[1].scheduled > 0);
  const topCategories = sortedCategories.slice(0, 4); // Get top active categories for specific highlight cards

  const daysArr = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const reportDateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const full = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: daysArr[d.getDay()], date: d.getDate(), full, isToday: i === 3 };
  });

  const reportCategoriesStats: Record<string, { actual: number, scheduled: number, color: string, icon: string }> = {};
  categories.forEach(t => { reportCategoriesStats[t.name] = { actual: 0, scheduled: 0, color: t.color, icon: t.icon }; });

  const reportDaySched = schedule[reportDate] || [];
  reportDaySched.forEach(item => {
    const hours = calcDurHours(item.start, item.end);
    if (!reportCategoriesStats[item.categoryName]) {
       const t = categories.find(x => x.name === item.categoryName);
       reportCategoriesStats[item.categoryName] = { actual: 0, scheduled: 0, color: t ? t.color : trackerTheme.colors.accent, icon: t ? t.icon : '📌' };
    }
    reportCategoriesStats[item.categoryName].scheduled += hours;
  });

  const reportDayData = statusUpdates[reportDate];
  if (reportDayData) {
    Object.entries(reportDayData).forEach(([tName, tData]) => {
      if (!reportCategoriesStats[tName]) reportCategoriesStats[tName] = { actual: 0, scheduled: 0, color: trackerTheme.colors.accent, icon: '📌' };
      let tAct = tData.actual || 0;
      if (tData.activities) Object.values(tData.activities).forEach(sub => { tAct += sub.actual || 0; });
      reportCategoriesStats[tName].actual += tAct;
    });
  }

  const reportSortedCategories = Object.entries(reportCategoriesStats).sort((a, b) => b[1].scheduled - a[1].scheduled).filter(t => t[1].scheduled > 0 || t[1].actual > 0);

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Greeting */}
      <View style={styles.greetingBanner}>
        <Text style={styles.greeting}>Good morning,</Text>
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
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent2 }]}>{overallProgress}%</Text>
          <Text style={styles.metricSub}>{totalActual.toFixed(1)} of {totalSched.toFixed(1)}h logged</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active Hours</Text>
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent }]}>{totalActual.toFixed(1)}h</Text>
          <Text style={styles.metricSub}>of {totalSched.toFixed(1)}h scheduled</Text>
        </View>
        
        {topCategories[0] ? (
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{topCategories[0][1].icon} {topCategories[0][0]}</Text>
            <Text style={[styles.metricVal, { color: topCategories[0][1].color }]}>{topCategories[0][1].actual.toFixed(1)}h</Text>
            <Text style={styles.metricSub}>Target: {topCategories[0][1].scheduled.toFixed(1)}h</Text>
          </View>
        ) : (
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Top Category</Text>
            <Text style={[styles.metricVal, { color: trackerTheme.colors.text3 }]}>-</Text>
            <Text style={styles.metricSub}>No data</Text>
          </View>
        )}
        {topCategories[1] ? (
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{topCategories[1][1].icon} {topCategories[1][0]}</Text>
            <Text style={[styles.metricVal, { color: topCategories[1][1].color }]}>{topCategories[1][1].actual.toFixed(1)}h</Text>
            <Text style={styles.metricSub}>Target: {topCategories[1][1].scheduled.toFixed(1)}h</Text>
          </View>
        ) : (
           <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Secondary Category</Text>
            <Text style={[styles.metricVal, { color: trackerTheme.colors.text3 }]}>-</Text>
            <Text style={styles.metricSub}>No data</Text>
          </View>
        )}
      </View>

      {/* Week Chart */}
      {/* <View style={styles.section}>
        <Text style={styles.sectionTitle}>{period === 'monthly' ? 'Monthly' : 'Weekly'} Completion</Text>
        <View style={styles.chartContainer}>
          <View style={styles.barChart}>
            {chartData.map((v, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barVal}>{v}%</Text>
                <View style={[styles.bar, { height: Math.max(4, Math.round((v / 100) * 80)), backgroundColor: chartColors[i] }]} />
              </View>
            ))}
          </View>
          <View style={styles.chartDays}>
            {chartLabels.map((d, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barDay, { color: (period === 'daily' && i === 6) ? trackerTheme.colors.accent : trackerTheme.colors.text3 }]}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      </View> */}

      {/* Ring Chart */}
      {/* <View style={styles.ringContainer}>
        <Svg width={180} height={180} viewBox="0 0 180 180">
          {topCategories.length === 0 && (
             <Circle cx={90} cy={90} r={70} fill="none" stroke={trackerTheme.colors.surface3} strokeWidth={18} />
          )}
          {topCategories.slice(0, 3).map((task, i) => {
            const radii = [70, 52, 36];
            const r = radii[i];
            const circ = 2 * Math.PI * r;
            const progress = task[1].scheduled > 0 ? Math.min(1, task[1].actual / task[1].scheduled) : 0;
            const offset = circ - (progress * circ);
            
            return (
              <G key={task[0]}>
                <Circle cx={90} cy={90} r={r} fill="none" stroke={trackerTheme.colors.surface3} strokeWidth={18 - i * 4} />
                <Circle cx={90} cy={90} r={r} fill="none" stroke={task[1].color} strokeWidth={18 - i * 4} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" rotation={-90} originX={90} originY={90} />
              </G>
            );
          })}
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: trackerTheme.colors.text, fontSize: 22, fontWeight: '700' }}>{overallProgress}%</Text>
          <Text style={{ color: trackerTheme.colors.text2, fontSize: 11 }}>overall</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        {topCategories.slice(0, 3).map(task => (
          <View key={task[0]} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: task[1].color }]} />
            <Text style={styles.legendText}>{task[0]} {task[1].scheduled > 0 ? Math.round((task[1].actual/task[1].scheduled)*100) : 0}%</Text>
          </View>
        ))}
      </View> */}

      {/* Highlights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{period.charAt(0).toUpperCase() + period.slice(1)} Highlights</Text>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightSub}>Category completion</Text>
          {sortedCategories.length === 0 && <Text style={{ color: trackerTheme.colors.text3, fontSize: 12 }}>No categories scheduled for this period.</Text>}
          {sortedCategories.map(cat => {
            const progress = cat[1].scheduled > 0 ? Math.min(100, (cat[1].actual / cat[1].scheduled) * 100) : 0;
            return (
              <View key={cat[0]} style={styles.hoursRow}>
                <Text style={styles.hoursLabel} numberOfLines={1}>{cat[0]}</Text>
                <View style={styles.hoursBar}>
                  <View style={[styles.hoursFill, { width: `${progress}%`, backgroundColor: cat[1].color }]} />
                </View>
                <Text style={[styles.hoursVal, { color: cat[1].color }]}>{cat[1].actual.toFixed(1)}/{cat[1].scheduled.toFixed(1)}h</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Task Breakdown Report */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detailed Breakdown</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakdownHeaderText, { flex: 1 }]}>Category</Text>
            <Text style={[styles.breakdownHeaderText, { width: 60, textAlign: 'right' }]}>Sched</Text>
            <Text style={[styles.breakdownHeaderText, { width: 60, textAlign: 'right' }]}>Done</Text>
          </View>
          {sortedCategories.length === 0 && <Text style={{ color: trackerTheme.colors.text3, fontSize: 12, paddingVertical: 10 }}>No category data available.</Text>}
          {sortedCategories.map((cat, idx) => (
            <View key={cat[0]} style={[styles.breakdownRow, idx === sortedCategories.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 14 }}>{cat[1].icon}</Text>
                <Text style={styles.breakdownName} numberOfLines={1}>{cat[0]}</Text>
              </View>
              <Text style={[styles.breakdownVal, { width: 60 }]}>{cat[1].scheduled.toFixed(1)}h</Text>
              <Text style={[styles.breakdownVal, { width: 60, color: cat[1].color }]}>{cat[1].actual.toFixed(1)}h</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Daily Task Breakdown Report */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Breakdown Report</Text>
        <View style={styles.dateStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {reportDateStrip.map((d, i) => (
              <TouchableOpacity 
                key={i} 
                style={[
                  styles.dateCell, 
                  d.isToday && styles.dateCellToday,
                  reportDate === d.full && !d.isToday && styles.dateCellSel
                ]}
                onPress={() => setReportDate(d.full)}
              >
                <Text style={[styles.dateWd, d.isToday && styles.dateWdToday]}>{d.day}</Text>
                <Text style={[styles.dateNum, d.isToday && styles.dateNumToday]}>{d.date}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakdownHeaderText, { flex: 1 }]}>Category</Text>
            <Text style={[styles.breakdownHeaderText, { width: 60, textAlign: 'right' }]}>Sched</Text>
            <Text style={[styles.breakdownHeaderText, { width: 60, textAlign: 'right' }]}>Done</Text>
          </View>
          {reportSortedCategories.length === 0 && <Text style={{ color: trackerTheme.colors.text3, fontSize: 12, paddingVertical: 10 }}>No category data available for this date.</Text>}
          {reportSortedCategories.map((cat, idx) => (
            <View key={cat[0]} style={[styles.breakdownRow, idx === reportSortedCategories.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 14 }}>{cat[1].icon}</Text>
                <Text style={styles.breakdownName} numberOfLines={1}>{cat[0]}</Text>
              </View>
              <Text style={[styles.breakdownVal, { width: 60 }]}>{cat[1].scheduled.toFixed(1)}h</Text>
              <Text style={[styles.breakdownVal, { width: 60, color: cat[1].color }]}>{cat[1].actual.toFixed(1)}h</Text>
            </View>
          ))}
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
  breakdownCard: { backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: trackerTheme.colors.border },
  breakdownHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border, paddingVertical: 8, marginBottom: 4 },
  breakdownHeaderText: { fontSize: 11, fontWeight: '600', color: trackerTheme.colors.text3, textTransform: 'uppercase' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border },
  breakdownName: { fontSize: 14, fontWeight: '500', color: trackerTheme.colors.text },
  breakdownVal: { fontSize: 14, fontWeight: '600', textAlign: 'right', color: trackerTheme.colors.text2 },
  dateStrip: { paddingBottom: 12, paddingTop: 4 },
  dateCell: { width: 44, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: trackerTheme.colors.border, backgroundColor: trackerTheme.colors.surface },
  dateCellToday: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  dateCellSel: { borderColor: trackerTheme.colors.accent, backgroundColor: 'rgba(124,109,237,.15)' },
  dateWd: { fontSize: 10, color: trackerTheme.colors.text3, fontWeight: '500' },
  dateWdToday: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 15, fontWeight: '700', color: trackerTheme.colors.text },
  dateNumToday: { color: 'white' },
});
