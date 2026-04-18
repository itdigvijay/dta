import { useTrackerContext } from '@/app/context/TrackerContext';
import { trackerTheme } from '@/constants/trackerTheme';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function calcScheduledHours(blocks: {start: string, end: string, taskName: string, sub?: string}[], taskName: string, sub?: string) {
  let total = 0;
  blocks.forEach(b => {
    if (b.taskName === taskName && b.sub === sub) {
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
  const { tasks, schedule, statusUpdates, updateStatus, updateStatusHours } = useTrackerContext();

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const full = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: days[d.getDay()], date: d.getDate(), full, isToday: i === 3 };
  });

  const daySchedule = schedule[selectedDate];
  const isRest = daySchedule && daySchedule.length === 0;
  const isUnassigned = !daySchedule;

  const scheduledItems: { task: any, taskName: string, sub: string }[] = [];
  if (daySchedule) {
    daySchedule.forEach(item => {
      const t = tasks.find(x => x.name === item.taskName);
      if (t) {
        if (!scheduledItems.some(i => i.taskName === item.taskName && i.sub === item.subtask)) {
          scheduledItems.push({ task: t, taskName: item.taskName, sub: item.subtask });
        }
      }
    });
  }

  const statusLabels = ['pending', 'partial', 'completed'] as const;

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
        <Text style={styles.sectionTitle}>
          {isRest ? 'Rest Day' : selectedDate === todayStr ? "Today's Tasks" : "Scheduled Tasks"}
        </Text>
        
        {isRest ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 30, marginBottom: 10 }}>🛌</Text>
            <Text style={{ color: trackerTheme.colors.text2 }}>Rest day. No tasks scheduled.</Text>
          </View>
        ) : isUnassigned ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 30, marginBottom: 10 }}>📅</Text>
            <Text style={{ color: trackerTheme.colors.text2 }}>No template assigned for this date.</Text>
          </View>
        ) : scheduledItems.length === 0 ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ color: trackerTheme.colors.text2 }}>No tasks in this template.</Text>
          </View>
        ) : (
          scheduledItems.map(item => {
            const itemKey = item.sub ? `${item.taskName}_${item.sub}` : item.taskName;
            const displayScheduled = calcScheduledHours(daySchedule.map(s => ({ start: s.start, end: s.end, taskName: s.taskName, sub: s.subtask })), item.taskName, item.sub);
            
            const taskData = statusUpdates[selectedDate]?.[item.taskName];
            let su;
            if (item.sub) {
              su = taskData?.subtasks?.[item.sub] || { actual: 0, scheduled: displayScheduled, status: 'pending' };
            } else {
              su = taskData || { actual: 0, scheduled: displayScheduled, status: 'pending' };
            }

            return (
              <View key={itemKey} style={styles.statusUpdateCard}>
                <View style={styles.statusHeader}>
                  <View>
                    <Text style={styles.statusName}>{item.task.icon} {item.task.name}</Text>
                    {item.sub ? <Text style={{ fontSize: 13, color: trackerTheme.colors.text2, marginTop: 2 }}>{item.sub}</Text> : null}
                  </View>
                  <View style={styles.statusToggle}>
                    {statusLabels.map(s => {
                      const isActive = su.status === s;
                      let bgColor = 'transparent', borderColor = trackerTheme.colors.border, textColor = trackerTheme.colors.text3;
                      if (isActive) {
                        if (s === 'completed') { bgColor = 'rgba(91,196,160,.15)'; borderColor = trackerTheme.colors.accent2; textColor = trackerTheme.colors.accent2; }
                        else if (s === 'partial') { bgColor = 'rgba(240,168,62,.15)'; borderColor = trackerTheme.colors.accent4; textColor = trackerTheme.colors.accent4; }
                        else { bgColor = trackerTheme.colors.surface3; borderColor = trackerTheme.colors.text3; textColor = trackerTheme.colors.text; }
                      }
                      return (
                        <TouchableOpacity key={s} onPress={() => updateStatus(selectedDate, item.taskName, item.sub, s, displayScheduled)} style={[styles.statusPill, { backgroundColor: bgColor, borderColor }]}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: textColor }}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.hoursRow}>
                  <Text style={styles.hoursLabel}>Progress</Text>
                  <View style={styles.hoursBar}>
                    <View style={[styles.hoursFill, { width: `${Math.min(100, (su.actual / displayScheduled) * 100 || 0)}%`, backgroundColor: item.task.color }]} />
                  </View>
                  <Text style={styles.hoursVal}>{su.actual}/{displayScheduled}h</Text>
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 11, color: trackerTheme.colors.text3, marginBottom: 8 }}>Adjust actual hours</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => updateStatusHours(selectedDate, item.taskName, item.sub, Math.max(0, su.actual - 0.5), displayScheduled)}>
                      <Text style={styles.adjustBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={{ flex: 1, textAlign: 'center', color: trackerTheme.colors.text, fontSize: 16, fontWeight: '600' }}>{su.actual}h</Text>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => updateStatusHours(selectedDate, item.taskName, item.sub, Math.min(displayScheduled, su.actual + 0.5), displayScheduled)}>
                      <Text style={styles.adjustBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
        })
      )}
      </ScrollView>
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
  section: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  statusUpdateCard: { backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: trackerTheme.colors.border },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusName: { fontSize: 15, fontWeight: '600', color: trackerTheme.colors.text },
  statusToggle: { flexDirection: 'row', gap: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  hoursRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  hoursLabel: { fontSize: 12, color: trackerTheme.colors.text2, minWidth: 65 },
  hoursBar: { flex: 1, height: 6, backgroundColor: trackerTheme.colors.surface3, borderRadius: 3, overflow: 'hidden' },
  hoursFill: { height: '100%', borderRadius: 3 },
  hoursVal: { fontSize: 12, fontWeight: '600', minWidth: 30, textAlign: 'right', color: trackerTheme.colors.text2 },
  adjustBtn: { width: 40, height: 32, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, justifyContent: 'center', alignItems: 'center' },
  adjustBtnText: { color: trackerTheme.colors.text, fontSize: 18, fontWeight: '600' }
});
