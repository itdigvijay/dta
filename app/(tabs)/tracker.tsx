import { useTrackerContext, useTrackerTheme } from '@/app/context/TrackerContext';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let db: SQLite.SQLiteDatabase | null = null;
const getDB = () => {
  if (db) return db;
  if (Platform.OS !== 'web') {
    try {
      db = SQLite.openDatabaseSync('tracker.db');
    } catch (e) {
      console.warn('SQLite init error:', e);
    }
  }
  return db;
};

const getSavedDrafts = (date: string, userId: string | null): Record<string, number> | null => {
  const key = `drafts_${userId}_${date}`;
  if (Platform.OS === 'web') {
    try {
      const val = window.localStorage.getItem(key);
    } catch (e) { return null; }
  }
  const database = getDB();
  if (!database) return null;
  try {
    const result = database.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [key]);
    return result ? JSON.parse(result.value) : null;
  } catch (e) { return null; }
};

const saveSavedDrafts = (date: string, drafts: Record<string, number>, userId: string | null) => {
  const key = `drafts_${userId}_${date}`;
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(key, JSON.stringify(drafts)); } catch (e) {}
    return;
  }
  const database = getDB();
  if (!database) return;
  try { database.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, JSON.stringify(drafts)]); } catch (e) {}
};

const clearSavedDrafts = (date: string, userId: string | null) => {
  const key = `drafts_${userId}_${date}`;
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem(key); } catch (e) {}
    return;
  }
  const database = getDB();
  if (!database) return;
  try { database.runSync('DELETE FROM app_state WHERE key = ?', [key]); } catch (e) {}
};

function calcScheduledMins(blocks: {start: string, end: string, categoryName: string, activity?: string}[], categoryName: string, activity?: string) {
  let total = 0;
  blocks.forEach(b => {
    if (b.categoryName === categoryName && b.activity === activity) {
      let sTime = b.start === '23:59' || b.start === '24:00' ? '00:00' : b.start;
      let eTime = b.end === '23:59' || b.end === '24:00' ? '00:00' : b.end;
      const [sh, sm] = sTime.split(':').map(Number);
      let [eh, em] = eTime.split(':').map(Number);
      if (eh < sh || (eh === sh && em < sm)) eh += 24;
      total += (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    }
  });
  return total;
}

function formatMins(mins: number) {
  const totalMins = Math.round(mins);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function UpdateScreen() {
  const insets = useSafeAreaInsets();
  const { categories, schedule, statusUpdates, updateStatusHours, currentUser } = useTrackerContext();
  const trackerTheme = useTrackerTheme();
  const styles = getStyles(trackerTheme);

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [manualHours, setManualHours] = useState('');
  const [manualMins, setManualMins] = useState('');
  const [errorData, setErrorData] = useState<{title: string, msg: string} | null>(null);

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
    const saved = getSavedDrafts(selectedDate, currentUser?.id || null);

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
          const hrs = item.activity 
            ? (catData?.activities?.[item.activity]?.actual || 0)
            : (catData?.actual || 0);
          initialDrafts[key] = Math.round(hrs * 60);
        }
      });
    }
    setDrafts(initialDrafts);
    setHasUnsavedChanges(false);
  }, [selectedDate, statusUpdates]);

  const showError = (title: string, msg: string) => {
    setErrorData({ title, msg });
  };

  const handleAdjustMins = (key: string, newMins: number) => {
    if (isFutureDate) {
      showError("Future Date", "You cannot log progress for upcoming days.");
      return;
    }

    setDrafts(prev => {
      const next = { ...prev, [key]: Math.max(0, newMins) };
      saveSavedDrafts(selectedDate, next, currentUser?.id || null);
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const totalScheduledMins = scheduledItems.reduce((acc, item) => acc + calcScheduledMins(daySchedule.map(s => ({ start: s.start, end: s.end, categoryName: s.categoryName, activity: s.activity })), item.categoryName, item.activity), 0);
  const totalLoggedMins = scheduledItems.reduce((acc, item) => acc + (drafts[`${item.categoryName}::${item.activity || ''}`] || 0), 0);
  const balanceMins = totalScheduledMins - totalLoggedMins;
  const isOver = balanceMins < 0;

  const handleSubmitLog = () => {
    if (balanceMins < 0) {
      showError("Extra Time Logged", `You have logged extra time.\nYour total logged time must exactly match your scheduled ${formatMins(totalScheduledMins)}.\nPlease reduce ${formatMins(Math.abs(balanceMins))} from other activities.`);
      return;
    }
    
    if (balanceMins > 0) {
      showError("Incomplete Log", `You still have ${formatMins(balanceMins)} left to log.\nYour total logged time must exactly match your scheduled ${formatMins(totalScheduledMins)}.\nPlease add ${formatMins(balanceMins)} to your activities.`);
      return;
    }

    scheduledItems.forEach(item => {
      const key = `${item.categoryName}::${item.activity || ''}`;
      const actualMins = drafts[key] || 0;
      const schedMins = calcScheduledMins(daySchedule.map(s => ({ start: s.start, end: s.end, categoryName: s.categoryName, activity: s.activity })), item.categoryName, item.activity);
      updateStatusHours(selectedDate, item.categoryName, item.activity, actualMins / 60, schedMins / 60);
    });
    setHasUnsavedChanges(false);
    clearSavedDrafts(selectedDate, currentUser?.id || null);
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
                <Text style={styles.summaryHint}>Adjust time if you spent more or less than planned.</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.sumCol}>
                    <Text style={styles.sumLbl}>Scheduled</Text>
                    <Text style={styles.sumVal}>{formatMins(totalScheduledMins)}</Text>
                  </View>
                  <View style={styles.sumCol}>
                    <Text style={styles.sumLbl}>Logged</Text>
                    <Text style={[styles.sumVal, isOver && { color: trackerTheme.colors.accent3 }]}>{formatMins(totalLoggedMins)}</Text>
                  </View>
                  <View style={[styles.sumCol, { borderRightWidth: 0 }]}>
                    <Text style={styles.sumLbl}>Difference</Text>
                    <Text style={[styles.sumVal, isOver ? { color: trackerTheme.colors.accent3 } : { color: trackerTheme.colors.accent2 }]}>
                      {isOver ? `+${formatMins(Math.abs(balanceMins))} Over` : `${formatMins(balanceMins)} Left`}
                    </Text>
                  </View>
                </View>
              </View>

              {scheduledItems.map(item => {
                const key = `${item.categoryName}::${item.activity || ''}`;
                const schedMins = calcScheduledMins(daySchedule.map(s => ({ start: s.start, end: s.end, categoryName: s.categoryName, activity: s.activity })), item.categoryName, item.activity);
                const actualMins = drafts[key] || 0;
                
                const status = actualMins >= schedMins ? 'COMPLETED' : actualMins > 0 ? 'IN PROGRESS' : 'PENDING';
                const statusColor = actualMins >= schedMins ? trackerTheme.colors.accent2 : actualMins > 0 ? trackerTheme.colors.accent4 : trackerTheme.colors.text3;

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
                        <Text style={styles.targetText}>Target: {formatMins(schedMins)}</Text>
                        
                        {/* Preserve and display exact user-entered blocks */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          {daySchedule.filter(s => s.categoryName === item.categoryName && s.activity === item.activity).map((b, i) => (
                            <Text key={i} style={{ fontSize: 10, color: trackerTheme.colors.text3, backgroundColor: trackerTheme.colors.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>{b.start} - {b.end}</Text>
                          ))}
                        </View>

                        <View style={styles.progressWrap}>
                          <View style={[styles.progressFill, { width: `${Math.min(100, (actualMins / Math.max(1, schedMins)) * 100)}%`, backgroundColor: actualMins > schedMins ? trackerTheme.colors.accent3 : item.category.color }]} />
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.timeInputBtn}
                        onPress={() => {
                          if (isFutureDate) {
                             showError("Action Not Allowed", "You cannot log progress for upcoming days.");
                             return;
                          }
                          setManualEntryKey(key);
                          setManualHours(Math.floor(actualMins / 60).toString());
                          setManualMins((actualMins % 60).toString());
                        }}
                      >
                        <Text style={styles.timeInputBtnText}>{formatMins(actualMins)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {!isRest && !isUnassigned && scheduledItems.length > 0 && (
          <View style={styles.footer}>
            {isFutureDate ? (
              <View style={[styles.submitBtn, { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border }]}>
                <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text3 }]}>Future Date Locked</Text>
              </View>
            ) : (
              <TouchableOpacity style={[styles.submitBtn, hasUnsavedChanges && styles.submitBtnActive]} onPress={handleSubmitLog}>
                <Text style={styles.submitBtnText}>{hasUnsavedChanges ? 'Submit Daily Log' : 'Saved ✓'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      {/* Custom Error Modal */}
      <Modal visible={!!errorData} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 }]}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(240,107,107,.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 36 }}>⚠️</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: trackerTheme.colors.accent3, marginBottom: 12, textAlign: 'center' }}>
              {errorData?.title}
            </Text>
            <Text style={{ fontSize: 15, color: trackerTheme.colors.text, textAlign: 'center', lineHeight: 24, marginBottom: 30 }}>
              {errorData?.msg}
            </Text>
            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: trackerTheme.colors.accent3, paddingVertical: 16, borderRadius: trackerTheme.radius.lg, alignItems: 'center' }} 
              onPress={() => setErrorData(null)}
            >
              <Text style={[styles.btnPrimaryText, { color: 'white' }]}>Fix it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Time Entry Modal */}
      <Modal visible={!!manualEntryKey} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Log Exact Time</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Hours</Text>
                <TextInput
                  style={styles.inputField}
                  keyboardType="number-pad"
                  value={manualHours}
                  onChangeText={setManualHours}
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Minutes</Text>
                <TextInput
                  style={styles.inputField}
                  keyboardType="number-pad"
                  value={manualMins}
                  onChangeText={setManualMins}
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setManualEntryKey(null)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => {
                const h = parseInt(manualHours || '0', 10);
                const m = parseInt(manualMins || '0', 10);
                if (!isNaN(h) && !isNaN(m)) {
                  handleAdjustMins(manualEntryKey!, h * 60 + m);
                }
                setManualEntryKey(null);
              }}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (trackerTheme: any) => StyleSheet.create({
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
  timeInputBtn: { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 16, paddingVertical: 10, minWidth: 85, alignItems: 'center' },
  timeInputBtnText: { fontSize: 14, fontWeight: '700', color: trackerTheme.colors.text },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 30, backgroundColor: trackerTheme.colors.bg, borderTopWidth: 1, borderTopColor: trackerTheme.colors.border },
  submitBtn: { width: '100%', paddingVertical: 16, backgroundColor: trackerTheme.colors.surface3, borderRadius: trackerTheme.radius.lg, alignItems: 'center' },
  submitBtnActive: { backgroundColor: trackerTheme.colors.accent },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: trackerTheme.colors.surface, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 16, textAlign: 'center' },
  inputLabel: { fontSize: 12, color: trackerTheme.colors.text2, marginBottom: 6, textAlign: 'center' },
  inputField: { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 12, paddingVertical: 14, color: trackerTheme.colors.text, fontSize: 20, textAlign: 'center', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnPrimary: { flex: 1, padding: 14, backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 15, fontWeight: '600' },
  btnCancel: { flex: 1, padding: 14, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnCancelText: { color: trackerTheme.colors.text2, fontSize: 15, fontWeight: '600' }
});
