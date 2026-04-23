import { useTrackerContext } from '@/app/context/TrackerContext';
import { trackerTheme } from '@/constants/trackerTheme';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let db: SQLite.SQLiteDatabase | null = null;
try {
  if (Platform.OS !== 'web') {
    db = SQLite.openDatabaseSync('tracker.db');
  }
} catch (e) {
  console.warn('SQLite init error:', e);
}

const getSavedDrafts = (date: string, userName: string | null): Record<string, number> | null => {
  const key = `drafts_${userName}_${date}`;
  if (Platform.OS === 'web') {
    try {
      const val = window.localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) { return null; }
  }
  if (!db) return null;
  try {
    const result = db.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [key]);
    return result ? JSON.parse(result.value) : null;
  } catch (e) { return null; }
};

const saveSavedDrafts = (date: string, drafts: Record<string, number>, userName: string | null) => {
  const key = `drafts_${userName}_${date}`;
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(key, JSON.stringify(drafts)); } catch (e) {}
    return;
  }
  if (!db) return;
  try { db.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, JSON.stringify(drafts)]); } catch (e) {}
};

const clearSavedDrafts = (date: string, userName: string | null) => {
  const key = `drafts_${userName}_${date}`;
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem(key); } catch (e) {}
    return;
  }
  if (!db) return;
  try { db.runSync('DELETE FROM app_state WHERE key = ?', [key]); } catch (e) {}
};

function calcScheduledHours(blocks: {start: string, end: string, categoryName: string, activity?: string}[], categoryName: string, activity?: string) {
  let total = 0;
  blocks.forEach(b => {
    if (b.categoryName === categoryName && b.activity === activity) {
      const [sh, sm] = b.start.split(':').map(Number);
      let [eh, em] = b.end.split(':').map(Number);
      if (eh < sh) eh += 24;
      total += (eh * 60 + (em || 0) - (sh * 60 + (sm || 0))) / 60;
    }
  });
  return Number(total.toFixed(1));
}

export default function UpdateScreen() {
  const insets = useSafeAreaInsets();
  const { categories, schedule, statusUpdates, updateStatusHours, currentUser } = useTrackerContext();

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const full = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: days[d.getDay()], date: d.getDate(), full, isToday: i === 3 };
  });

  const daySchedule = schedule[selectedDate];
  const isRest = daySchedule && daySchedule.length === 0;
  const isUnassigned = !daySchedule;
  const isFutureDate = selectedDate > todayStr;

  const scheduledItems: { category: any, categoryName: string, activity: string }[] = [];
  if (daySchedule) {
    daySchedule.forEach(item => {
      const t = categories.find(x => x.name === item.categoryName);
      if (t) {
        if (!scheduledItems.some(i => i.categoryName === item.categoryName && i.activity === item.activity)) {
          scheduledItems.push({ category: t, categoryName: item.categoryName, activity: item.activity });
        }
      }
    });
  }

  useEffect(() => {
    const saved = getSavedDrafts(selectedDate, currentUser);
    const isPast = selectedDate < todayStr;
    const hasSubmitted = statusUpdates[selectedDate] && Object.keys(statusUpdates[selectedDate]).length > 0;

    if (isPast && hasSubmitted && !saved) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }

    if (saved) {
      setDrafts(saved);
      setHasUnsavedChanges(true);
      return;
    }

    const initialDrafts: Record<string, number> = {};
    if (daySchedule) {
      daySchedule.forEach(item => {
        const key = `${item.categoryName}::${item.activity || ''}`;
        if (initialDrafts[key] === undefined) {
          const catData = statusUpdates[selectedDate]?.[item.categoryName];
          initialDrafts[key] = item.activity 
            ? (catData?.activities?.[item.activity]?.actual || 0)
            : (catData?.actual || 0);
        }
      });
    }
    setDrafts(initialDrafts);
    setHasUnsavedChanges(false);
  }, [selectedDate, statusUpdates]);

  const handleAdjust = (key: string, newValue: number) => {
    if (isFutureDate) {
      setSubmitError("Future Date: You cannot log progress for upcoming days.");
      return;
    }

    if (isLocked) {
      setSubmitError("Locked: Past submissions cannot be edited.");
      return;
    }

    setDrafts(prev => {
      const next = { ...prev, [key]: Math.max(0, newValue) };
      saveSavedDrafts(selectedDate, next, currentUser);
      return next;
    });
    setHasUnsavedChanges(true);
    setSubmitError(null);
  };

  const totalScheduled = scheduledItems.reduce((acc, item) => acc + calcScheduledHours(daySchedule.map(s => ({ start: s.start, end: s.end, categoryName: s.categoryName, activity: s.activity })), item.categoryName, item.activity), 0);
  const totalLogged = scheduledItems.reduce((acc, item) => acc + (drafts[`${item.categoryName}::${item.activity || ''}`] || 0), 0);
  const balance = Number((totalScheduled - totalLogged).toFixed(1));
  const isOver = balance < 0;

  const handleSubmitLog = () => {
    setSubmitError(null);

    if (balance < 0) {
      setSubmitError(`Extra Time Logged:\nYou have logged ${Math.abs(balance)} extra hours.\nYour total logged time must exactly match your scheduled ${totalScheduled}h.\nPlease reduce ${Math.abs(balance)}h from other activities.`);
      return;
    }
    
    if (balance > 0) {
      setSubmitError(`Incomplete Log:\nYou still have ${balance} hours left to log.\nYour total logged time must exactly match your scheduled ${totalScheduled}h.\nPlease add ${balance}h to your activities.`);
      return;
    }

    scheduledItems.forEach(item => {
      const key = `${item.categoryName}::${item.activity || ''}`;
      const actual = drafts[key] || 0;
      const sched = calcScheduledHours(daySchedule.map(s => ({ start: s.start, end: s.end, categoryName: s.categoryName, activity: s.activity })), item.categoryName, item.activity);
      updateStatusHours(selectedDate, item.categoryName, item.activity, actual, sched);
    });
    setHasUnsavedChanges(false);
    clearSavedDrafts(selectedDate, currentUser);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Update Status</Text>
          <Text style={styles.pageSub}>Log today's progress</Text>
        </View>
      </View>

      <View style={styles.dateStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {dateStrip.map((d, i) => (
            <TouchableOpacity 
              key={i} 
              style={[
                styles.dateCell, 
                d.isToday && styles.dateCellToday,
                selectedDate === d.full && !d.isToday && styles.dateCellSel
              ]}
              onPress={() => setSelectedDate(d.full)}
            >
              <Text style={[styles.dateWd, d.isToday && styles.dateWdToday]}>{d.day}</Text>
              <Text style={[styles.dateNum, d.isToday && styles.dateNumToday]}>{d.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.section}>
        {isRest ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🛌</Text>
            <Text style={styles.emptyTitle}>Rest Day</Text>
            <Text style={styles.emptySub}>No tasks to track today.</Text>
          </View>
        ) : isUnassigned ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>📅</Text>
            <Text style={styles.emptyTitle}>No Template Assigned</Text>
            <Text style={styles.emptySub}>Assign a template in the Schedule tab.</Text>
          </View>
        ) : scheduledItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptySub}>No categories found in this template.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Daily Balance</Text>
              <Text style={styles.summaryHint}>Adjust hours if you spent more or less time than planned.</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.sumCol}>
                  <Text style={styles.sumLbl}>Scheduled</Text>
                  <Text style={styles.sumVal}>{totalScheduled}h</Text>
                </View>
                <View style={styles.sumCol}>
                  <Text style={styles.sumLbl}>Logged</Text>
                  <Text style={[styles.sumVal, isOver && { color: trackerTheme.colors.accent3 }]}>{totalLogged}h</Text>
                </View>
                <View style={[styles.sumCol, { borderRightWidth: 0 }]}>
                  <Text style={styles.sumLbl}>Difference</Text>
                  <Text style={[styles.sumVal, isOver ? { color: trackerTheme.colors.accent3 } : { color: trackerTheme.colors.accent2 }]}>
                    {isOver ? `+${Math.abs(balance)}h Over` : `${balance}h Left`}
                  </Text>
                </View>
              </View>
            </View>

            {scheduledItems.map(item => {
              const key = `${item.categoryName}::${item.activity || ''}`;
              const sched = calcScheduledHours(daySchedule.map(s => ({ start: s.start, end: s.end, categoryName: s.categoryName, activity: s.activity })), item.categoryName, item.activity);
              const actual = drafts[key] || 0;
              
              const status = actual >= sched ? 'COMPLETED' : actual > 0 ? 'IN PROGRESS' : 'PENDING';
              const statusColor = actual >= sched ? trackerTheme.colors.accent2 : actual > 0 ? trackerTheme.colors.accent4 : trackerTheme.colors.text3;

              return (
                <View key={key} style={[styles.taskCard, { borderLeftColor: item.category.color }]}>
                  <View style={styles.taskTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskName}>{item.category.icon} {item.category.name}</Text>
                      {item.activity ? <Text style={styles.taskSub}>{item.activity}</Text> : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
                      <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{status}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.taskBody}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={styles.targetText}>Target: {sched}h</Text>
                      <View style={styles.progressWrap}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, (actual / sched) * 100)}%`, backgroundColor: actual > sched ? trackerTheme.colors.accent3 : item.category.color }]} />
                      </View>
                    </View>
                    
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => handleAdjust(key, actual - 0.5)}>
                        <Text style={styles.stepBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepVal}>{actual}h</Text>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => handleAdjust(key, actual + 0.5)}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {!isRest && !isUnassigned && scheduledItems.length > 0 && (
        <View style={styles.footer}>
          {submitError && (
            <View style={{ backgroundColor: 'rgba(240,107,107,.12)', padding: 12, borderRadius: trackerTheme.radius.sm, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(240,107,107,.3)' }}>
              <Text style={{ color: trackerTheme.colors.accent3, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>{submitError}</Text>
            </View>
          )}
          {isFutureDate ? (
            <View style={[styles.submitBtn, { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border }]}>
              <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text3 }]}>Future Date Locked</Text>
            </View>
          ) : isLocked ? (
            <View style={[styles.submitBtn, { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border }]}>
              <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text3 }]}>Past Day Locked</Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.submitBtn, hasUnsavedChanges && styles.submitBtnActive]} onPress={handleSubmitLog}>
              <Text style={styles.submitBtnText}>{hasUnsavedChanges ? 'Submit Daily Log' : 'Saved ✓'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  pageHeader: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: trackerTheme.colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: trackerTheme.colors.text2, marginTop: 2 },
  dateStrip: { paddingBottom: 16 },
  dateCell: { width: 44, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: trackerTheme.colors.border },
  dateCellToday: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  dateCellSel: { borderColor: trackerTheme.colors.accent, backgroundColor: 'rgba(124,109,237,.15)' },
  dateWd: { fontSize: 10, color: trackerTheme.colors.text3 },
  dateWdToday: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 15, fontWeight: '700', color: trackerTheme.colors.text },
  dateNumToday: { color: 'white' },
  section: { paddingHorizontal: 20, paddingBottom: 120 },
  emptyState: { paddingVertical: 50, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 4 },
  emptySub: { fontSize: 14, color: trackerTheme.colors.text2 },
  summaryCard: { backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: trackerTheme.colors.border },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: trackerTheme.colors.text },
  summaryHint: { fontSize: 11, color: trackerTheme.colors.text3, marginBottom: 12, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: trackerTheme.colors.border, paddingTop: 12 },
  sumCol: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: trackerTheme.colors.border },
  sumLbl: { fontSize: 11, color: trackerTheme.colors.text2, marginBottom: 4 },
  sumVal: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.text },
  taskCard: { backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: trackerTheme.colors.border, borderLeftWidth: 4 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  taskName: { fontSize: 15, fontWeight: '700', color: trackerTheme.colors.text },
  taskSub: { fontSize: 12, color: trackerTheme.colors.text2, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  taskBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  targetText: { fontSize: 11, color: trackerTheme.colors.text2, marginBottom: 6 },
  progressWrap: { height: 6, backgroundColor: trackerTheme.colors.surface3, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: trackerTheme.colors.surface2, borderRadius: 20, borderWidth: 1, borderColor: trackerTheme.colors.border },
  stepBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 20, color: trackerTheme.colors.text2, fontWeight: '500', marginTop: -2 },
  stepVal: { width: 36, textAlign: 'center', fontSize: 14, fontWeight: '700', color: trackerTheme.colors.text },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, backgroundColor: trackerTheme.colors.bg, borderTopWidth: 1, borderTopColor: trackerTheme.colors.border },
  submitBtn: { width: '100%', paddingVertical: 16, backgroundColor: trackerTheme.colors.surface3, borderRadius: trackerTheme.radius.lg, alignItems: 'center' },
  submitBtnActive: { backgroundColor: trackerTheme.colors.accent },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' }
});
