import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { trackerTheme } from '@/constants/trackerTheme';
import { useTrackerContext } from '@/app/context/TrackerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UpdateScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, statusUpdates, updateStatus, updateStatusHours } = useTrackerContext();

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return { day: days[d.getDay()], date: d.getDate(), isToday: i === 3 };
  });

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
            <View key={i} style={[styles.dateCell, d.isToday && styles.dateCellToday]}>
              <Text style={[styles.dateWd, d.isToday && styles.dateWdToday]}>{d.day}</Text>
              <Text style={[styles.dateNum, d.isToday && styles.dateNumToday]}>{d.date}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.section}>
        <Text style={styles.sectionTitle}>Today's Tasks</Text>
        {tasks.map(task => {
          const su = statusUpdates[task.id] || { actual: 0, scheduled: 3, status: 'pending' };
          const pct = Math.min(100, Math.round((su.actual / su.scheduled) * 100)) || 0;
          return (
            <View key={task.id} style={styles.statusUpdateCard}>
              <View style={styles.statusHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>{task.icon}</Text>
                  <Text style={styles.statusName}>{task.name}</Text>
                </View>
                <View style={styles.statusToggle}>
                  {statusLabels.map(s => {
                    const isSelected = su.status === s;
                    let bgColor = 'transparent';
                    let borderColor = trackerTheme.colors.border;
                    let textColor = trackerTheme.colors.text2;
                    if (isSelected) {
                      if (s === 'completed') { bgColor = 'rgba(91,196,160,0.15)'; borderColor = trackerTheme.colors.accent2; textColor = trackerTheme.colors.accent2; }
                      else if (s === 'partial') { bgColor = 'rgba(240,168,62,0.15)'; borderColor = trackerTheme.colors.accent4; textColor = trackerTheme.colors.accent4; }
                      else { bgColor = trackerTheme.colors.surface3; borderColor = trackerTheme.colors.text3; textColor = trackerTheme.colors.text; }
                    }
                    return (
                      <TouchableOpacity key={s} onPress={() => updateStatus(task.id, s)} style={[styles.statusPill, { backgroundColor: bgColor, borderColor }]}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: textColor }}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.hoursRow}>
                <Text style={styles.hoursLabel}>Completed</Text>
                <View style={styles.hoursBar}><View style={[styles.hoursFill, { width: `${pct}%`, backgroundColor: task.color }]} /></View>
                <Text style={[styles.hoursVal, { color: task.color }]}>{su.actual}h</Text>
              </View>
              <View style={styles.hoursRow}>
                <Text style={styles.hoursLabel}>Scheduled</Text>
                <View style={styles.hoursBar}><View style={[styles.hoursFill, { width: '100%', backgroundColor: trackerTheme.colors.surface3 }]} /></View>
                <Text style={styles.hoursVal}>{su.scheduled}h</Text>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 11, color: trackerTheme.colors.text3, marginBottom: 8 }}>Adjust actual hours</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity style={styles.adjustBtn} onPress={() => updateStatusHours(task.id, Math.max(0, su.actual - 0.5))}>
                    <Text style={styles.adjustBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ flex: 1, textAlign: 'center', color: trackerTheme.colors.text, fontSize: 16, fontWeight: '600' }}>{su.actual}h</Text>
                  <TouchableOpacity style={styles.adjustBtn} onPress={() => updateStatusHours(task.id, Math.min(su.scheduled, su.actual + 0.5))}>
                    <Text style={styles.adjustBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
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
