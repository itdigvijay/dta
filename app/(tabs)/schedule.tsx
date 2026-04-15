import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { trackerTheme } from '@/constants/trackerTheme';
import { useTrackerContext } from '@/app/context/TrackerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { schedule, tasks, addSchedule, cycleScheduleStatus } = useTrackerContext();
  const [modalVisible, setModalVisible] = useState(false);

  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [selectedTaskId, setSelectedTaskId] = useState<number>(tasks[0]?.id || 0);
  const [selectedSubtask, setSelectedSubtask] = useState<string>(tasks[0]?.subtasks[0] || '');

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return { day: days[d.getDay()], date: d.getDate(), isToday: i === 3 };
  });

  const handleAddSchedule = () => {
    addSchedule({ start, end, taskId: selectedTaskId, subtask: selectedSubtask });
    setModalVisible(false);
  };

  const calcDur = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    let [eh, em] = end.split(':').map(Number);
    if (eh < sh) eh += 24;
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (isNaN(mins)) return '0m';
    return mins >= 60 ? Math.floor(mins / 60) + 'h' + (mins % 60 ? ` ${mins % 60}m` : '') : mins + 'm';
  };

  const statusColors = { completed: trackerTheme.colors.accent2, 'in-progress': trackerTheme.colors.accent4, pending: trackerTheme.colors.text3 };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Schedule</Text>
          <Text style={styles.pageSub}>Plan your day</Text>
        </View>
        <TouchableOpacity style={styles.chip} onPress={() => setModalVisible(true)}>
          <Text style={styles.chipText}>+ Add</Text>
        </TouchableOpacity>
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
        <Text style={styles.sectionTitle}>Today's Timeline</Text>
        {schedule.map(item => {
          const task = tasks.find(t => t.id === item.taskId);
          if (!task) return null;
          const dur = calcDur(item.start, item.end);
          const sColor = statusColors[item.status];
          return (
            <View key={item.id} style={styles.scheduleItem}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeRange}>{item.start}–{item.end}</Text>
                <Text style={styles.timeDuration}>{dur}</Text>
              </View>
              <View style={[styles.schedCard, { borderLeftColor: task.color }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.schedTask}>{task.icon} {task.name}</Text>
                    <Text style={styles.schedSub}>{item.subtask}</Text>
                  </View>
                  <TouchableOpacity onPress={() => cycleScheduleStatus(item.id)} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: sColor }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: sColor }}>{item.status}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add time block</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Time Block</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Start Time (HH:MM)</Text>
                <TextInput style={styles.inputField} placeholder="09:00" placeholderTextColor={trackerTheme.colors.text3} value={start} onChangeText={setStart} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>End Time (HH:MM)</Text>
                <TextInput style={styles.inputField} placeholder="10:00" placeholderTextColor={trackerTheme.colors.text3} value={end} onChangeText={setEnd} />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category ID</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {tasks.map(t => (
                  <TouchableOpacity key={t.id} onPress={() => { setSelectedTaskId(t.id); setSelectedSubtask(t.subtasks[0] || ''); }} style={[styles.pickerOpt, selectedTaskId === t.id && styles.pickerOptActive]}>
                    <Text style={{ color: selectedTaskId === t.id ? 'white' : trackerTheme.colors.text2 }}>{t.icon} {t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subtask</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {tasks.find(t => t.id === selectedTaskId)?.subtasks.map(s => (
                  <TouchableOpacity key={s} onPress={() => setSelectedSubtask(s)} style={[styles.pickerOpt, selectedSubtask === s && styles.pickerOptActive]}>
                    <Text style={{ color: selectedSubtask === s ? 'white' : trackerTheme.colors.text2 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}><Text style={styles.btnCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAddSchedule}><Text style={styles.btnPrimaryText}>Add Block</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  pageHeader: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: trackerTheme.colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: trackerTheme.colors.text2, marginTop: 2 },
  chip: { backgroundColor: trackerTheme.colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipText: { color: 'white', fontSize: 11, fontWeight: '600' },
  dateStrip: { paddingBottom: 16 },
  dateCell: { width: 44, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: trackerTheme.colors.border },
  dateCellToday: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  dateWd: { fontSize: 10, color: trackerTheme.colors.text3 },
  dateWdToday: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 15, fontWeight: '700', color: trackerTheme.colors.text },
  dateNumToday: { color: 'white' },
  section: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  scheduleItem: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border },
  timeBlock: { minWidth: 70 },
  timeRange: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text2 },
  timeDuration: { fontSize: 10, color: trackerTheme.colors.text3, marginTop: 2 },
  schedCard: { flex: 1, backgroundColor: trackerTheme.colors.surface, borderRadius: 10, padding: 10, borderLeftWidth: 3 },
  schedTask: { fontSize: 14, fontWeight: '600', color: trackerTheme.colors.text },
  schedSub: { fontSize: 12, color: trackerTheme.colors.text2, marginTop: 2 },
  addBtn: { width: '100%', padding: 13, borderRadius: trackerTheme.radius.lg, borderWidth: 1.5, borderColor: trackerTheme.colors.surface3, borderStyle: 'dashed', alignItems: 'center', marginTop: 10 },
  addBtnText: { color: trackerTheme.colors.text3, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: trackerTheme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, color: trackerTheme.colors.text2, marginBottom: 6 },
  inputField: { width: '100%', backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: trackerTheme.colors.text, fontSize: 14 },
  pickerOpt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: trackerTheme.radius.sm, borderWidth: 1, borderColor: trackerTheme.colors.border, marginRight: 8 },
  pickerOptActive: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1, padding: 12, backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 14, fontWeight: '600' },
  btnCancel: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnCancelText: { color: trackerTheme.colors.text2, fontSize: 14 },
});
