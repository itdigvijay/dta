import { useTrackerContext, useTrackerTheme } from '@/app/context/TrackerContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

const getMonthDays = (currentDate: Date) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: i, full: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` });
  }
  return days;
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories, statusUpdates, schedule, templates, blockStatus, currentUser, logoutUser } = useTrackerContext();
  const trackerTheme = useTrackerTheme();
  const styles = getStyles(trackerTheme);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [reportDate, setReportDate] = useState(todayStr);

  const [greeting, setGreeting] = useState('Good morning,');

  useFocusEffect(
    useCallback(() => {
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('Good morning,');
      else if (hour < 18) setGreeting('Good afternoon,');
      else setGreeting('Good evening,');
    }, [])
  );

  const handleSwitchProfile = () => {
    logoutUser();
    router.replace('/login');
  };

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Greeting */}
      <View style={styles.greetingBanner}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.greetingName}>{currentUser?.name || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={handleSwitchProfile} style={styles.switchBtn}>
            <Text style={styles.switchText}>Switch Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

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
          <Text style={styles.metricSub}>{totalActual.toFixed(2)} of {totalSched.toFixed(2)}h logged</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active Hours</Text>
          <Text style={[styles.metricVal, { color: trackerTheme.colors.accent }]}>{totalActual.toFixed(2)}h</Text>
          <Text style={styles.metricSub}>of {totalSched.toFixed(2)}h scheduled</Text>
        </View>
        
        {topCategories[0] ? (
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{topCategories[0][1].icon} {topCategories[0][0]}</Text>
            <Text style={[styles.metricVal, { color: topCategories[0][1].color }]}>{topCategories[0][1].actual.toFixed(2)}h</Text>
            <Text style={styles.metricSub}>Target: {topCategories[0][1].scheduled.toFixed(2)}h</Text>
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
            <Text style={[styles.metricVal, { color: topCategories[1][1].color }]}>{topCategories[1][1].actual.toFixed(2)}h</Text>
            <Text style={styles.metricSub}>Target: {topCategories[1][1].scheduled.toFixed(2)}h</Text>
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

      {/* Monthly Calendar */}
      {period === 'monthly' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Calendar</Text>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <Text key={day} style={styles.calDayText}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {getMonthDays(today).map((d, i) => {
                if (!d) return <View key={i} style={styles.calCellEmpty} />;
                const isToday = d.full === todayStr;
                const isSel = d.full === reportDate;
                const daySched = schedule[d.full] || [];
                const hasTasks = daySched.length > 0;
                return (
                  <TouchableOpacity key={i} style={[styles.calCell, isToday && styles.calCellToday, isSel && !isToday && styles.calCellSel]} onPress={() => setReportDate(d.full)}>
                    <Text style={[styles.calCellText, isToday && styles.calCellTextToday]}>{d.date}</Text>
                    {hasTasks && <View style={styles.calDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

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
              <Text style={[styles.hoursVal, { color: cat[1].color }]}>{cat[1].actual.toFixed(2)}/{cat[1].scheduled.toFixed(2)}h</Text>
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
            <Text style={[styles.breakdownHeaderText, { width: 75, textAlign: 'right' }]}>Schedule</Text>
            <Text style={[styles.breakdownHeaderText, { width: 60, textAlign: 'right' }]}>Done</Text>
          </View>
          {sortedCategories.length === 0 && <Text style={{ color: trackerTheme.colors.text3, fontSize: 12, paddingVertical: 10 }}>No category data available.</Text>}
          {sortedCategories.map((cat, idx) => (
            <View key={cat[0]} style={[styles.breakdownRow, idx === sortedCategories.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 14 }}>{cat[1].icon}</Text>
                <Text style={styles.breakdownName} numberOfLines={1}>{cat[0]}</Text>
              </View>
            <Text style={[styles.breakdownVal, { width: 75 }]}>{cat[1].scheduled.toFixed(2)}h</Text>
            <Text style={[styles.breakdownVal, { width: 60, color: cat[1].color }]}>{cat[1].actual.toFixed(2)}h</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Daily Task Breakdown Report */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{period === 'monthly' ? 'Selected Day Breakdown' : 'Daily Breakdown Report'}</Text>
        
        {period !== 'monthly' && (
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
        )}

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakdownHeaderText, { flex: 1 }]}>Category</Text>
            <Text style={[styles.breakdownHeaderText, { width: 75, textAlign: 'right' }]}>Schedule</Text>
            <Text style={[styles.breakdownHeaderText, { width: 60, textAlign: 'right' }]}>Done</Text>
          </View>
          {reportSortedCategories.length === 0 && <Text style={{ color: trackerTheme.colors.text3, fontSize: 12, paddingVertical: 10 }}>No category data available for this date.</Text>}
          {reportSortedCategories.map((cat, idx) => (
            <View key={cat[0]} style={[styles.breakdownRow, idx === reportSortedCategories.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={{ fontSize: 14 }}>{cat[1].icon}</Text>
                <Text style={styles.breakdownName} numberOfLines={1}>{cat[0]}</Text>
              </View>
              <Text style={[styles.breakdownVal, { width: 75 }]}>{cat[1].scheduled.toFixed(1)}h</Text>
              <Text style={[styles.breakdownVal, { width: 60, color: cat[1].color }]}>{cat[1].actual.toFixed(1)}h</Text>
            </View>
          ))}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (trackerTheme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  greetingBanner: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  greeting: { fontSize: 24, fontWeight: '700', color: trackerTheme.colors.text },
  greetingName: { fontSize: 16, color: trackerTheme.colors.text2 },
  switchBtn: { backgroundColor: trackerTheme.colors.surface2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  switchText: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text },
  periodTabsContainer: { paddingHorizontal: 20, marginBottom: 16 },
  periodTabs: { flexDirection: 'row', backgroundColor: trackerTheme.colors.surface2, borderRadius: 8, padding: 4 },
  periodTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  periodTabActive: { backgroundColor: trackerTheme.colors.surface },
  periodTabText: { fontSize: 13, fontWeight: '600', color: trackerTheme.colors.text2 },
  periodTabTextActive: { color: trackerTheme.colors.text },
  dashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginBottom: 20 },
  metricCard: { width: (width - 52) / 2, backgroundColor: trackerTheme.colors.surface, padding: 16, borderRadius: trackerTheme.radius.lg, borderWidth: 1, borderColor: trackerTheme.colors.border },
  metricLabel: { fontSize: 12, color: trackerTheme.colors.text2, marginBottom: 8, fontWeight: '600' },
  metricVal: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  metricSub: { fontSize: 11, color: trackerTheme.colors.text3 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 12 },
  highlightCard: { backgroundColor: trackerTheme.colors.surface, padding: 16, borderRadius: trackerTheme.radius.lg, borderWidth: 1, borderColor: trackerTheme.colors.border },
  highlightSub: { fontSize: 12, color: trackerTheme.colors.text2, marginBottom: 12 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hoursLabel: { width: 80, fontSize: 13, color: trackerTheme.colors.text, fontWeight: '500' },
  hoursBar: { flex: 1, height: 8, backgroundColor: trackerTheme.colors.surface2, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  hoursFill: { height: '100%', borderRadius: 4 },
  hoursVal: { width: 70, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  breakdownCard: { backgroundColor: trackerTheme.colors.surface, padding: 16, borderRadius: trackerTheme.radius.lg, borderWidth: 1, borderColor: trackerTheme.colors.border },
  breakdownHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border, paddingBottom: 8, marginBottom: 8 },
  breakdownHeaderText: { fontSize: 12, color: trackerTheme.colors.text2, fontWeight: '600' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.surface2 },
  breakdownName: { fontSize: 14, color: trackerTheme.colors.text, fontWeight: '500' },
  breakdownVal: { fontSize: 13, fontWeight: '600', color: trackerTheme.colors.text, textAlign: 'right' },
  dateStrip: { marginBottom: 16 },
  dateCell: { width: 46, height: 62, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: trackerTheme.colors.border, backgroundColor: trackerTheme.colors.surface, marginRight: 8 },
  dateCellToday: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  dateCellSel: { borderColor: trackerTheme.colors.accent, backgroundColor: trackerTheme.colors.surface2 },
  dateWd: { fontSize: 10, color: trackerTheme.colors.text3, fontWeight: '500', marginBottom: 2 },
  dateWdToday: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.text },
  dateNumToday: { color: 'white' },
  calendarCard: { backgroundColor: trackerTheme.colors.surface, padding: 16, borderRadius: trackerTheme.radius.lg, borderWidth: 1, borderColor: trackerTheme.colors.border },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  calDayText: { fontSize: 12, color: trackerTheme.colors.text2, fontWeight: '600', width: 30, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-around' },
  calCellEmpty: { width: 30, height: 30 },
  calCell: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  calCellToday: { backgroundColor: trackerTheme.colors.accent },
  calCellSel: { borderWidth: 1, borderColor: trackerTheme.colors.accent },
  calCellText: { fontSize: 13, color: trackerTheme.colors.text, fontWeight: '500' },
  calCellTextToday: { color: 'white', fontWeight: '700' },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: trackerTheme.colors.accent, marginTop: 2 }
});
