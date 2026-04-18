import { TemplateBlock, useTrackerContext } from '@/app/context/TrackerContext';
import { trackerTheme } from '@/constants/trackerTheme';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = ['#5BC4A0', '#7C6DED', '#F06B6B', '#F0A83E', '#378ADD', '#E85DC0', '#4CAF50', '#FF7043'];

function calcDur(start: string, end: string) {
  if (!start || !end) return '0m';
  const [sh, sm] = start.split(':').map(Number);
  let [eh, em] = end.split(':').map(Number);
  if (eh < sh) eh += 24;
  const mins = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, schedule, templates, addTemplate, deleteTemplate, assignTemplate, cycleBlockStatus } = useTrackerContext();
  
  const [activeTab, setActiveTab] = useState<'templates' | 'calendar'>('templates');
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  
  // Modal State
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplColor, setTplColor] = useState('#7C6DED');
  const [tplBlocks, setTplBlocks] = useState<TemplateBlock[]>([]);
  
  // Block Builder State
  const [blkStart, setBlkStart] = useState('08:00');
  const [blkEnd, setBlkEnd] = useState('09:00');
  const [blkTaskName, setBlkTaskName] = useState<string | null>(null);
  const [blkSub, setBlkSub] = useState<string>('');
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false);
  const [subDropdownOpen, setSubDropdownOpen] = useState(false);

  useEffect(() => {
    const activeT = tasks.find(t => t.name === blkTaskName);
    if (activeT && activeT.subtasks.length > 0 && !activeT.subtasks.includes(blkSub)) {
      setBlkSub(activeT.subtasks[0]);
    }
  }, [blkTaskName]);

  const handleAddBlock = () => {
    if (!blkTaskName) return;
    setTplBlocks([...tplBlocks, { start: blkStart, end: blkEnd, taskName: blkTaskName, sub: blkSub }]);
  };

  const handleSaveTpl = () => {
    if (!tplName.trim()) return;
    addTemplate({ name: tplName, color: tplColor, blocks: tplBlocks });
    setAddModalVisible(false);
    setTplName('');
    setTplBlocks([]);
  };

  const daysArr = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const full = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: daysArr[d.getDay()], date: d.getDate(), full, isToday: i === 3 };
  });

  const activeTaskForBlock = tasks.find(t => t.name === blkTaskName);
  const daySchedule = schedule[selectedDate];
  const isRestSelected = daySchedule && daySchedule.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Schedule</Text>
          <Text style={styles.pageSub}>Templates & daily plan</Text>
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.chip, activeTab !== 'templates' && styles.chipGhost]} onPress={() => setActiveTab('templates')}>
            <Text style={[styles.chipText, activeTab !== 'templates' && styles.chipTextGhost]}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab !== 'calendar' && styles.chipGhost]} onPress={() => setActiveTab('calendar')}>
            <Text style={[styles.chipText, activeTab !== 'calendar' && styles.chipTextGhost]}>Calendar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'templates' ? (
        <ScrollView contentContainerStyle={styles.section}>
          <Text style={styles.sectionTitle}>My Templates</Text>
          {templates.length === 0 ? (
            <Text style={{ textAlign: 'center', padding: 30, color: trackerTheme.colors.text3 }}>No templates yet. Create your first one.</Text>
          ) : (
            templates.map(tpl => (
              <View key={tpl.id} style={styles.tplCard}>
                <View style={styles.tplHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.colorDot, { backgroundColor: tpl.color }]} />
                    <Text style={styles.tplName}>{tpl.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={styles.tplCount}>{tpl.blocks.length} time blocks</Text>
                    <TouchableOpacity onPress={() => deleteTemplate(tpl.id)}>
                      <Text style={{ color: trackerTheme.colors.accent3, fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.tplBlocks}>
                  {tpl.blocks.map((b, i) => {
                    const t = tasks.find(t => t.name === b.taskName);
                    if (!t) return null;
                    return (
                      <View key={i} style={[styles.tplBlk, { backgroundColor: t.color + '22' }]}>
                        <Text style={{ color: t.color, fontSize: 10, fontWeight: '500' }}>{b.start} {t.icon} {t.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Create new template</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <View style={styles.dateStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
              {dateStrip.map((d, i) => {
                const daySched = schedule[d.full];
                const isRest = daySched && daySched.length === 0;
                const hasTpl = daySched && daySched.length > 0;
                return (
                  <TouchableOpacity key={i} style={[
                    styles.dateCell,
                    d.isToday && styles.dateCellToday,
                    selectedDate === d.full && !d.isToday && styles.dateCellSel,
                    isRest && styles.dateCellRest
                  ]} onPress={() => setSelectedDate(d.full)}>
                    <Text style={[styles.dateWd, d.isToday && styles.dateWdToday]}>{d.day}</Text>
                    <Text style={[styles.dateNum, d.isToday && styles.dateNumToday, isRest && styles.dateNumRest]}>{d.date}</Text>
                    {hasTpl && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: trackerTheme.colors.accent2, marginTop: 2 }} />}
                    {isRest && <Text style={{ fontSize: 8, color: trackerTheme.colors.accent3 }}>rest</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.section}>
            <Text style={styles.sectionTitle}>Assign template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignRow}>
              {templates.map(tpl => (
                <TouchableOpacity key={tpl.id} style={styles.assignChip} onPress={() => assignTemplate(selectedDate, tpl.id)}>
                  <Text style={styles.assignChipText}>{tpl.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.assignChip, isRestSelected && styles.assignChipRest]} onPress={() => assignTemplate(selectedDate, 'rest')}>
                <Text style={[styles.assignChipText, isRestSelected && { color: trackerTheme.colors.accent3 }]}>🛌 Rest Day</Text>
              </TouchableOpacity>
              {daySchedule !== undefined && (
                <TouchableOpacity style={[styles.assignChip, { borderColor: 'transparent', backgroundColor: 'transparent' }]} onPress={() => assignTemplate(selectedDate, '')}>
                  <Text style={[styles.assignChipText, { color: trackerTheme.colors.accent3 }]}>✕ Clear</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {isRestSelected ? (
              <View style={styles.restBanner}>
                <Text style={{ fontSize: 40 }}>🛌</Text>
                <Text style={styles.restTitle}>Rest Day</Text>
                <Text style={styles.restSub}>No schedule for this day. Rest, recover, and recharge.</Text>
                <TouchableOpacity style={styles.restBtn} onPress={() => assignTemplate(selectedDate, '')}>
                  <Text style={{ color: trackerTheme.colors.accent3, fontSize: 13, fontWeight: '600' }}>Remove rest day</Text>
                </TouchableOpacity>
              </View>
            ) : !daySchedule ? (
              <View style={{ alignItems: 'center', padding: 30 }}>
                <Text style={{ fontSize: 30, marginBottom: 8 }}>📅</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: trackerTheme.colors.text, marginBottom: 6 }}>No template assigned</Text>
                <Text style={{ fontSize: 13, color: trackerTheme.colors.text3 }}>Pick a template above or mark as Rest Day</Text>
              </View>
            ) : (
              <View>
                {(() => {
                  if (daySchedule.length === 0) return null;
                  return (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, padding: 10, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, borderWidth: 1, borderColor: trackerTheme.colors.border }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: trackerTheme.colors.text }}>Scheduled Tasks</Text>
                        <Text style={{ fontSize: 11, color: trackerTheme.colors.text2, marginLeft: 'auto' }}>{daySchedule.length} blocks</Text>
                      </View>
                      {daySchedule.map((item, i) => {
                        const t = tasks.find(t => t.name === item.taskName);
                        if (!t) return null;
                        const sc = item.status === 'completed' ? { color: trackerTheme.colors.accent2, bg: 'rgba(91,196,160,.12)', lbl: 'Completed' }
                          : item.status === 'in-progress' ? { color: trackerTheme.colors.accent4, bg: 'rgba(240,168,62,.12)', lbl: 'Active' }
                            : { color: trackerTheme.colors.text3, bg: 'transparent', lbl: 'Pending' };
                        const dur = calcDur(item.start, item.end);

                        return (
                          <View key={i} style={styles.schedItem}>
                            <View style={styles.timeCol}>
                              <Text style={styles.tRange}>{item.start}</Text>
                              <Text style={styles.tRange}>{item.end}</Text>
                              <Text style={styles.tDur}>{dur}</Text>
                            </View>
                            <View style={[styles.schedCard, { borderLeftColor: t.color }]}>
                              <View style={styles.scardTop}>
                                <View>
                                  <Text style={styles.scardName}>{t.icon} {t.name}</Text>
                                  <Text style={styles.scardSub}>{item.subtask}</Text>
                                </View>
                                <TouchableOpacity style={[styles.spill, { borderColor: sc.color, backgroundColor: sc.bg }]} onPress={() => cycleBlockStatus(selectedDate, item.id)}>
                                  <Text style={{ color: sc.color, fontSize: 10, fontWeight: '600' }}>{sc.lbl}</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  );
                })()}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={isAddModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.modalTitle}>Create Template</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Template name</Text>
              <TextInput style={styles.inputField} placeholder="e.g. Weekday Routine" placeholderTextColor={trackerTheme.colors.text3} value={tplName} onChangeText={setTplName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Color</Text>
              <View style={styles.colorOptions}>
                {COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => setTplColor(c)} style={[styles.colorOpt, { backgroundColor: c }, tplColor === c && styles.colorOptSelected]} />
                ))}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: trackerTheme.colors.border, marginVertical: 12 }} />

            <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>Time Blocks</Text>
            {tplBlocks.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                {tplBlocks.map((b, i) => {
                  const t = tasks.find(x => x.name === b.taskName);
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: trackerTheme.colors.surface2, padding: 8, borderRadius: trackerTheme.radius.sm, marginBottom: 4 }}>
                      <Text style={{ flex: 1, color: trackerTheme.colors.text2, fontSize: 12 }}>
                        {b.start} - {b.end} • {t?.icon} {t?.name} {b.sub ? `(${b.sub})` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => {
                        const newB = [...tplBlocks];
                        newB.splice(i, 1);
                        setTplBlocks(newB);
                      }}>
                        <Text style={{ color: trackerTheme.colors.accent3, fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Start</Text>
                <TextInput style={styles.inputField} value={blkStart} onChangeText={setBlkStart} placeholder="08:00" placeholderTextColor={trackerTheme.colors.text3} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>End</Text>
                <TextInput style={styles.inputField} value={blkEnd} onChangeText={setBlkEnd} placeholder="09:00" placeholderTextColor={trackerTheme.colors.text3} keyboardType="numbers-and-punctuation" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Task</Text>
              <TouchableOpacity 
                style={[styles.inputField, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                onPress={() => { setTaskDropdownOpen(!taskDropdownOpen); setBlkSub(''); setSubDropdownOpen(false); }}
              >
                <Text style={{ color: activeTaskForBlock ? activeTaskForBlock.color : trackerTheme.colors.text3 }}>
                  {activeTaskForBlock ? `${activeTaskForBlock.icon} ${activeTaskForBlock.name}` : 'Select a task...'}
                </Text>
                <Text style={{ color: trackerTheme.colors.text3, fontSize: 10 }}>▼</Text>
              </TouchableOpacity>
              
              {taskDropdownOpen && (
                <View style={styles.dropdownList}>
                  {tasks.map(t => (
                      <TouchableOpacity key={t.id} style={styles.dropdownItem} onPress={() => { setBlkTaskName(t.name); setTaskDropdownOpen(false); }}>
                      <Text style={{ color: t.color, fontSize: 14 }}>{t.icon} {t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {activeTaskForBlock && activeTaskForBlock.subtasks.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subtask</Text>
                <TouchableOpacity 
                  style={[styles.inputField, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                  onPress={() => { setSubDropdownOpen(!subDropdownOpen); setTaskDropdownOpen(false); }}
                >
                  <Text style={{ color: trackerTheme.colors.text }}>{blkSub || 'Select a subtask...'}</Text>
                  <Text style={{ color: trackerTheme.colors.text3, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                
                {subDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {activeTaskForBlock.subtasks.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => { setBlkSub(s); setSubDropdownOpen(false); }}>
                        <Text style={styles.dropdownItemText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.addBlockBtn} onPress={handleAddBlock}>
              <Text style={styles.addBlockBtnText}>+ Add this block</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveTpl}>
                <Text style={styles.btnPrimaryText}>Save Template</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  pageHeader: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: trackerTheme.colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: trackerTheme.colors.text2, marginTop: 2 },
  tabContainer: { flexDirection: 'row', gap: 6, marginTop: 4 },
  chip: { backgroundColor: trackerTheme.colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipGhost: { backgroundColor: trackerTheme.colors.surface2 },
  chipText: { color: 'white', fontSize: 11, fontWeight: '700' },
  chipTextGhost: { color: trackerTheme.colors.text2 },
  section: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  tplCard: { backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: trackerTheme.colors.border },
  tplHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  tplName: { fontSize: 14, fontWeight: '600', color: trackerTheme.colors.text },
  tplCount: { fontSize: 11, color: trackerTheme.colors.text3 },
  tplBlocks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tplBlk: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  addBtn: { width: '100%', padding: 13, borderRadius: trackerTheme.radius.lg, borderWidth: 1.5, borderColor: trackerTheme.colors.surface3, borderStyle: 'dashed', alignItems: 'center', marginBottom: 10, marginTop: 10 },
  addBtnText: { color: trackerTheme.colors.text3, fontSize: 14 },
  dateStrip: { paddingBottom: 16 },
  dateCell: { width: 46, height: 62, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: trackerTheme.colors.border, backgroundColor: trackerTheme.colors.surface, gap: 2 },
  dateCellToday: { backgroundColor: trackerTheme.colors.accent, borderColor: trackerTheme.colors.accent },
  dateCellSel: { borderColor: trackerTheme.colors.accent, backgroundColor: 'rgba(124,109,237,.15)' },
  dateCellRest: { backgroundColor: 'rgba(240,107,107,.08)', borderColor: 'rgba(240,107,107,.3)' },
  dateWd: { fontSize: 9, color: trackerTheme.colors.text3, fontWeight: '500' },
  dateWdToday: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: 15, fontWeight: '700', color: trackerTheme.colors.text },
  dateNumToday: { color: 'white' },
  dateNumRest: { color: trackerTheme.colors.accent3 },
  assignRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  assignChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: trackerTheme.colors.border, backgroundColor: trackerTheme.colors.surface2 },
  assignChipSel: { backgroundColor: 'rgba(124,109,237,.18)' },
  assignChipRest: { backgroundColor: 'rgba(240,107,107,.12)', borderColor: trackerTheme.colors.accent3 },
  assignChipText: { fontSize: 12, fontWeight: '500', color: trackerTheme.colors.text2 },
  schedItem: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border },
  timeCol: { minWidth: 62 },
  tRange: { fontSize: 11, fontWeight: '600', color: trackerTheme.colors.text2 },
  tDur: { fontSize: 10, color: trackerTheme.colors.text3, marginTop: 2 },
  schedCard: { flex: 1, backgroundColor: trackerTheme.colors.surface2, borderRadius: 10, padding: 10, borderLeftWidth: 3 },
  scardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scardName: { fontSize: 14, fontWeight: '600', color: trackerTheme.colors.text },
  scardSub: { fontSize: 12, color: trackerTheme.colors.text2, marginTop: 2 },
  spill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  restBanner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 8 },
  restTitle: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.accent3 },
  restSub: { fontSize: 13, color: trackerTheme.colors.text2, textAlign: 'center' },
  restBtn: { marginTop: 10, backgroundColor: 'rgba(240,107,107,.12)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(240,107,107,.35)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: trackerTheme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, color: trackerTheme.colors.text2, marginBottom: 6 },
  inputField: { width: '100%', backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: trackerTheme.colors.text, fontSize: 14 },
  colorOptions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  colorOpt: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorOptSelected: { borderColor: 'white' },
  taskChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: trackerTheme.radius.sm, backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border },
  addBlockBtn: { width: '100%', padding: 12, backgroundColor: 'transparent', borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, alignItems: 'center', marginVertical: 8 },
  addBlockBtnText: { color: trackerTheme.colors.text2, fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnPrimary: { flex: 2, padding: 12, backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 14, fontWeight: '600' },
  btnCancel: { flex: 1, padding: 12, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnCancelText: { color: trackerTheme.colors.text2, fontSize: 14 },
  dropdownList: { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border },
  dropdownItemText: { color: trackerTheme.colors.text, fontSize: 14 },
});