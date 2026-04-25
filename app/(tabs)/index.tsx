import { useTrackerContext, useTrackerTheme } from '@/app/context/TrackerContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const smallCardWidth = (width - 52) / 2;

const calcDurHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  let sTime = start === '23:59' || start === '24:00' ? '00:00' : start;
  let eTime = end === '23:59' || end === '24:00' ? '00:00' : end;
  const [sh, sm] = sTime.split(':').map(Number);
  let [eh, em] = eTime.split(':').map(Number);
  if (eh < sh || (eh === sh && em < sm)) eh += 24;
  return (eh * 60 + (em || 0) - (sh * 60 + (sm || 0))) / 60;
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories, statusUpdates, schedule, templates, blockStatus, currentUser, logoutUser } = useTrackerContext();
  const trackerTheme = useTrackerTheme();
  const styles = getStyles(trackerTheme);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

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

  let activeDates: string[] = [];
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const formatDate = (dateObj: Date) => `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  if (period === 'daily') {
    activeDates = [todayStr];
  } else if (period === 'weekly') {
    const diff = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon-Sun week
    const mon = new Date(y, m, d - diff);
    for(let i=0; i<7; i++) {
      const temp = new Date(mon); temp.setDate(mon.getDate() + i); activeDates.push(formatDate(temp));
    }
  } else if (period === 'monthly') {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for(let i=1; i<=daysInMonth; i++) {
      activeDates.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
  } else if (period === 'yearly') {
    const dateSet = new Set<string>();
    Object.keys(schedule).forEach(k => { if(k.startsWith(`${y}-`)) dateSet.add(k); });
    Object.keys(statusUpdates).forEach(k => { if(k.startsWith(`${y}-`)) dateSet.add(k); });
    activeDates = Array.from(dateSet);
  }
  const categoriesStats: Record<string, { actual: number, scheduled: number, color: string, icon: string, activities: Record<string, { actual: number, scheduled: number }> }> = {};
  categories.forEach(t => { categoriesStats[t.name] = { actual: 0, scheduled: 0, color: t.color, icon: t.icon, activities: {} }; });

  activeDates.forEach(d => {
    const daySched = schedule[d] || [];
    daySched.forEach(item => {
      const hours = calcDurHours(item.start, item.end);
      if (!categoriesStats[item.categoryName]) {
         const t = categories.find(x => x.name === item.categoryName);
         categoriesStats[item.categoryName] = { actual: 0, scheduled: 0, color: t ? t.color : trackerTheme.colors.accent, icon: t ? t.icon : '📌', activities: {} };
      }
      categoriesStats[item.categoryName].scheduled += hours;
      
      if (item.activity) {
        if (!categoriesStats[item.categoryName].activities[item.activity]) {
          categoriesStats[item.categoryName].activities[item.activity] = { actual: 0, scheduled: 0 };
        }
        categoriesStats[item.categoryName].activities[item.activity].scheduled += hours;
      }
    });

    const dayData = statusUpdates[d];
    if (dayData) {
      Object.entries(dayData).forEach(([tName, tData]) => {
        if (!categoriesStats[tName]) {
          const t = categories.find(x => x.name === tName);
          categoriesStats[tName] = { actual: 0, scheduled: 0, color: t ? t.color : trackerTheme.colors.accent, icon: t ? t.icon : '📌', activities: {} };
        }
        let tAct = tData.actual || 0;
        if (tData.activities) {
          Object.entries(tData.activities).forEach(([subName, subData]) => {
            const subAct = subData.actual || 0;
            tAct += subAct;
            if (!categoriesStats[tName].activities[subName]) {
              categoriesStats[tName].activities[subName] = { actual: 0, scheduled: 0 };
            }
            categoriesStats[tName].activities[subName].actual += subAct;
          });
        }
        categoriesStats[tName].actual += tAct;
      });
    }
  });

  const sortedCategories = Object.entries(categoriesStats).sort((a, b) => b[1].scheduled - a[1].scheduled).filter(t => t[1].scheduled > 0 || t[1].actual > 0);

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
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.periodTab, period === tab && styles.periodTabActive]} onPress={() => setPeriod(tab)}>
              <Text style={[styles.periodTabText, period === tab && styles.periodTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Period Progress (Category + Sub-activities) */}
      <View style={{ marginBottom: 28, marginTop: 12 }}>
        <Text style={[styles.breakdownTitle, { paddingHorizontal: 20 }]}>{period === 'daily' ? "Today's" : period.charAt(0).toUpperCase() + period.slice(1)} Progress</Text>
        {sortedCategories.length === 0 ? (
          <Text style={{ color: trackerTheme.colors.text3, fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }}>No data available for this period.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
            {sortedCategories.map(cat => {
              const scheduled = cat[1].scheduled;
              const actual = cat[1].actual;
              const diff = actual - scheduled;
              const progress = scheduled > 0 ? Math.min(100, (actual / scheduled) * 100) : 0;
              const activities = Object.entries(cat[1].activities).filter(a => a[1].scheduled > 0 || a[1].actual > 0);
              const diffText = diff > 0 ? `  (+${diff.toFixed(1)}h)` : diff < 0 ? `  (${diff.toFixed(1)}h)` : `  (✓)`;
              const diffColor = diff > 0 ? trackerTheme.colors.accent3 : diff < 0 ? trackerTheme.colors.accent4 : trackerTheme.colors.accent2;

              return (
                <View key={cat[0]} style={styles.periodCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{cat[1].icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: trackerTheme.colors.text }}>{cat[0]}</Text>
                      <Text style={{ fontSize: 12, color: trackerTheme.colors.text2 }}>
                        {actual.toFixed(1)} / {scheduled.toFixed(1)}h logged
                        <Text style={{ color: diffColor, fontWeight: '700' }}>{diffText}</Text>
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: cat[1].color }}>{Math.round(progress)}%</Text>
                  </View>
                  
                  <View style={styles.detailProgressBg}>
                    <View style={[styles.detailProgressFill, { width: `${progress}%`, backgroundColor: diff > 0 ? trackerTheme.colors.accent3 : cat[1].color }]} />
                  </View>
                  
                  {activities.length > 0 && (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {activities.map(act => {
                        const aSch = act[1].scheduled;
                        const aAct = act[1].actual;
                        const aDiff = aAct - aSch;
                        const aProg = aSch > 0 ? Math.min(100, (aAct / aSch) * 100) : 0;
                        const aDiffText = aDiff > 0 ? `  (+${aDiff.toFixed(1)}h)` : aDiff < 0 ? `  (${aDiff.toFixed(1)}h)` : `  (✓)`;
                        const aDiffColor = aDiff > 0 ? trackerTheme.colors.accent3 : aDiff < 0 ? trackerTheme.colors.accent4 : trackerTheme.colors.accent2;
                        return (
                          <View key={act[0]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, color: trackerTheme.colors.text2, fontWeight: '500' }}>{act[0]}</Text>
                              <Text style={{ fontSize: 12, color: trackerTheme.colors.text3 }}>
                                {aAct.toFixed(1)} / {aSch.toFixed(1)}h
                                <Text style={{ color: aDiffColor, fontWeight: '600' }}>{aDiffText}</Text>
                              </Text>
                            </View>
                            <View style={[styles.detailProgressBg, { height: 4 }]}>
                              <View style={[styles.detailProgressFill, { width: `${aProg}%`, backgroundColor: cat[1].color }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Daily Task Breakdown Report */}
      <View style={{ marginBottom: 40 }}>
        <Text style={[styles.breakdownTitle, { paddingHorizontal: 20 }]}>Daily Breakdown Report</Text>
        
        <View style={styles.dateStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
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

        {reportSortedCategories.length === 0 ? (
          <Text style={{ color: trackerTheme.colors.text3, fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }}>No category data available for this date.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
            {reportSortedCategories.map(cat => {
              const scheduled = cat[1].scheduled;
              const actual = cat[1].actual;
              const diff = actual - scheduled;
              const progress = scheduled > 0 ? Math.min(100, (actual / scheduled) * 100) : 0;
              
              let statusText = '';
              let statusColor = trackerTheme.colors.text2;
              
              if (diff > 0) {
                statusText = `+${diff.toFixed(1)}h`;
                statusColor = trackerTheme.colors.accent3;
              } else if (diff < 0) {
                statusText = `${diff.toFixed(1)}h`;
                statusColor = trackerTheme.colors.accent4;
              } else if (scheduled > 0 && diff === 0) {
                statusText = `Completed ✓`;
                statusColor = trackerTheme.colors.accent2;
              }

              return (
                <View key={cat[0]} style={styles.smallDetailCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={[styles.smallDetailIcon, { backgroundColor: cat[1].color + '20' }]}>
                      <Text style={{ fontSize: 16 }}>{cat[1].icon}</Text>
                    </View>
                    <Text style={styles.smallDetailName} numberOfLines={1}>{cat[0]}</Text>
                  </View>
                  
                  <Text style={styles.smallDetailVal}>
                    {actual.toFixed(1)}<Text style={styles.smallDetailSub}> / {scheduled.toFixed(1)}h</Text>
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: statusColor, fontWeight: '700' }}>{statusText}</Text>
                    <Text style={{ fontSize: 10, color: cat[1].color, fontWeight: '700' }}>{Math.round(progress)}%</Text>
                  </View>
                  
                  <View style={styles.detailProgressBg}>
                    <View style={[styles.detailProgressFill, { width: `${progress}%`, backgroundColor: diff > 0 ? trackerTheme.colors.accent3 : cat[1].color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 12 },
  breakdownTitle: { fontSize: 22, fontWeight: '800', color: trackerTheme.colors.text, marginBottom: 16, letterSpacing: -0.5 },
  periodCard: { width: '100%', backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 18, borderWidth: 1, borderColor: trackerTheme.colors.border },
  detailProgressBg: { height: 8, backgroundColor: trackerTheme.colors.surface2, borderRadius: 4, overflow: 'hidden' },
  detailProgressFill: { height: '100%', borderRadius: 4 },
  smallDetailCard: { width: smallCardWidth, backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, borderWidth: 1, borderColor: trackerTheme.colors.border },
  smallDetailIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  smallDetailName: { fontSize: 14, fontWeight: '700', color: trackerTheme.colors.text, flex: 1 },
  smallDetailVal: { fontSize: 20, fontWeight: '800', color: trackerTheme.colors.text },
  smallDetailSub: { fontSize: 12, color: trackerTheme.colors.text3, fontWeight: '500' },
  dateStrip: { marginBottom: 16 },
  dateCell: { width: 46, height: 62, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: trackerTheme.colors.border, backgroundColor: trackerTheme.colors.surface, marginRight: 8 },
  dateCellToday: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  dateCellSel: { borderColor: trackerTheme.colors.accent, backgroundColor: trackerTheme.colors.surface2 },
  dateWd: { fontSize: 10, color: trackerTheme.colors.text3, fontWeight: '500', marginBottom: 2 },
  dateWdToday: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.text },
  dateNumToday: { color: 'white' },
});
