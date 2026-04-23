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

function addOneHour(timeStr: string) {
  if (!timeStr || !timeStr.includes(':')) return '00:00';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  h = (h + 1) % 24;
  return `${String(h).padStart(2, '0')}:${mStr}`;
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { categories, schedule, templates, addTemplate, deleteTemplate, assignTemplate, cycleBlockStatus } = useTrackerContext();
  
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
  const [blkCategoryName, setBlkCategoryName] = useState<string | null>(null);
  const [blkActivity, setBlkActivity] = useState<string>('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoFillMsg, setAutoFillMsg] = useState<{text: string, isError: boolean} | null>(null);

  const currentTotalMins = tplBlocks.reduce((total, block) => {
    if (!block.start || !block.end) return total;
    const [bsh, bsm] = block.start.split(':').map(Number);
    let [beh, bem] = block.end.split(':').map(Number);
    if (beh < bsh || (beh === bsh && bem < bsm)) beh += 24;
    const duration = (beh * 60 + (bem || 0)) - (bsh * 60 + (bsm || 0));
    return total + (duration > 0 ? duration : 0);
  }, 0);

  useEffect(() => {
    const activeT = categories.find(t => t.name === blkCategoryName);
    if (activeT && activeT.activities.length > 0 && !activeT.activities.includes(blkActivity)) {
      setBlkActivity(activeT.activities[0]);
    }
  }, [blkCategoryName]);

  const handleStartChange = (text: string) => {
    setBlkStart(text);
    if (/^\d{1,2}:\d{2}$/.test(text)) {
      setBlkEnd(addOneHour(text));
    }
  };

  const handleAddBlock = () => {
    setSaveError(null);
    if (!blkCategoryName) {
      setSaveError('Category Missing: Please select a category first.');
      return;
    }

    const [sh, sm] = blkStart.split(':').map(Number);
    let [eh, em] = blkEnd.split(':').map(Number);
    if (eh < sh || (eh === sh && em < sm)) eh += 24;
    const newDur = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));

    if (currentTotalMins + newDur > 24 * 60) {
      const availableMins = (24 * 60) - currentTotalMins;
      setSaveError(`Limit Exceeded: This block goes beyond 24 hours and cannot be added.\n\nYou only have ${Math.floor(availableMins / 60)}h ${availableMins % 60}m left to schedule.`);
      return;
    }

    setTplBlocks([...tplBlocks, { start: blkStart, end: blkEnd, categoryName: blkCategoryName, activity: blkActivity }]);
    setBlkStart(blkEnd);
    setBlkEnd(addOneHour(blkEnd));
  };

  const handleSaveTpl = () => {
    setSaveError(null);

    if (tplBlocks.length === 0) {
      setSaveError("Empty Template: You haven't added any time blocks yet.\n\nPlease create a full 24-hour schedule first.");
      return;
    }

    const hours = Math.floor(currentTotalMins / 60);
    const minutes = currentTotalMins % 60;  

    if (currentTotalMins < 24 * 60) {
      const remMins = (24 * 60) - currentTotalMins;
      const remH = Math.floor(remMins / 60);
      const remM = remMins % 60;
      setSaveError(`Incomplete Schedule: Your template is not 24 hours long yet.\n\nYou have only added ${hours}h ${minutes}m.\nYou still need to add ${remH}h ${remM}m.`);
      return;
    }
    if (currentTotalMins > 24 * 60) {
      setSaveError(`Limit Exceeded: Your schedule is over 24 hours.\n\nThe template is currently ${hours}h ${minutes}m long. It must be exactly 24 hours.`);
      return;
    }

    if (!tplName.trim()) {
      setSaveError('Please enter a Template name before saving.');
      return;
    }

    addTemplate({ name: tplName, color: tplColor, blocks: tplBlocks });
    setAddModalVisible(false);
    setTplName('');
    setTplBlocks([]);
    setBlkStart('08:00');
    setBlkEnd('09:00');
  };

  const daysArr = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const full = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: daysArr[d.getDay()], date: d.getDate(), full, isToday: i === 3 };
  });

  const activeCategoryForBlock = categories.find(t => t.name === blkCategoryName);
  const daySchedule = schedule[selectedDate];
  const isRestSelected = daySchedule && daySchedule.length === 0;

  const handleAutoFill = () => {
    setAutoFillMsg(null);
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const weekdayTpl = templates.find(t => normalize(t.name).includes('weekday'));
    const weekendTpl = templates.find(t => normalize(t.name).includes('weekend'));
    
    if (!weekdayTpl || !weekendTpl) {
      setAutoFillMsg({ text: 'Error: Aapko pehle 2 templates banane honge. Ek ke naam me "Weekday" aur dusre me "Weekend" likha hona zaroori hai.', isError: true });
      return;
    }

    let assignedCount = 0;
    dateStrip.forEach(d => {
      const dayIndex = daysArr.indexOf(d.day);
      // Sirf Sunday (0) ko weekend maana gaya hai, Monday-Saturday weekdays hain
      const isWeekend = dayIndex === 0;
      
      // Agar aapne us din ko pehle se Rest Day mark kiya hai, to auto-fill usko change nahi karega
      const existingSched = schedule[d.full];
      const isAlreadyRestDay = existingSched && existingSched.length === 0;

      if (!isAlreadyRestDay) {
        if (isWeekend && weekendTpl) {
          assignTemplate(d.full, weekendTpl.id);
          assignedCount++;
        } else if (!isWeekend && weekdayTpl) {
          assignTemplate(d.full, weekdayTpl.id);
          assignedCount++;
        }
      }
    });
    setAutoFillMsg({ text: `Success! Auto-assigned tasks for ${assignedCount} days.\n(Skipped your existing Rest Days)`, isError: false });
    setTimeout(() => setAutoFillMsg(null), 5000);
  };

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
                    const t = categories.find(t => t.name === b.categoryName);
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Assign template</Text>
              <TouchableOpacity onPress={handleAutoFill}>
                <Text style={{ color: trackerTheme.colors.accent, fontSize: 12, fontWeight: '600' }}>Auto-fill Week</Text>
              </TouchableOpacity>
            </View>
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

          {autoFillMsg && (
            <View style={{ backgroundColor: autoFillMsg.isError ? 'rgba(240,107,107,.12)' : 'rgba(91,196,160,.12)', padding: 12, borderRadius: trackerTheme.radius.sm, marginBottom: 12, borderWidth: 1, borderColor: autoFillMsg.isError ? 'rgba(240,107,107,.3)' : 'rgba(91,196,160,.3)' }}>
              <Text style={{ color: autoFillMsg.isError ? trackerTheme.colors.accent3 : trackerTheme.colors.accent2, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>{autoFillMsg.text}</Text>
            </View>
          )}

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
                        <Text style={{ fontSize: 13, fontWeight: '600', color: trackerTheme.colors.text }}>Scheduled Categories</Text>
                        <Text style={{ fontSize: 11, color: trackerTheme.colors.text2, marginLeft: 'auto' }}>{daySchedule.length} blocks</Text>
                      </View>
                      {daySchedule.map((item, i) => {
                        const t = categories.find(t => t.name === item.categoryName);
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
                                  <Text style={styles.scardSub}>{item.activity}</Text>
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
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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

            <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>Time Blocks ({Math.floor(currentTotalMins / 60)}h {currentTotalMins % 60}m / 24h)</Text>
            {tplBlocks.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                {tplBlocks.map((b, i) => {
                  const t = categories.find(x => x.name === b.categoryName);
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: trackerTheme.colors.surface2, padding: 8, borderRadius: trackerTheme.radius.sm, marginBottom: 4 }}>
                      <Text style={{ flex: 1, color: trackerTheme.colors.text2, fontSize: 12 }}>
                        {b.start} - {b.end} • {t?.icon} {t?.name} {b.activity ? `(${b.activity})` : ''}
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
                <TextInput style={styles.inputField} value={blkStart} onChangeText={handleStartChange} placeholder="08:00" placeholderTextColor={trackerTheme.colors.text3} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>End</Text>
                <TextInput style={styles.inputField} value={blkEnd} onChangeText={setBlkEnd} placeholder="09:00" placeholderTextColor={trackerTheme.colors.text3} keyboardType="numbers-and-punctuation" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity 
                style={[styles.inputField, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                onPress={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setBlkActivity(''); setActivityDropdownOpen(false); }}
              >
                <Text style={{ color: activeCategoryForBlock ? activeCategoryForBlock.color : trackerTheme.colors.text3 }}>
                  {activeCategoryForBlock ? `${activeCategoryForBlock.icon} ${activeCategoryForBlock.name}` : 'Select a category...'}
                </Text>
                <Text style={{ color: trackerTheme.colors.text3, fontSize: 10 }}>▼</Text>
              </TouchableOpacity>
              
              {categoryDropdownOpen && (
                <View style={styles.dropdownList}>
                  {categories.map(t => (
                      <TouchableOpacity key={t.id} style={styles.dropdownItem} onPress={() => { setBlkCategoryName(t.name); setCategoryDropdownOpen(false); }}>
                      <Text style={{ color: t.color, fontSize: 14 }}>{t.icon} {t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {activeCategoryForBlock && activeCategoryForBlock.activities.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Activity</Text>
                <TouchableOpacity 
                  style={[styles.inputField, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                  onPress={() => { setActivityDropdownOpen(!activityDropdownOpen); setCategoryDropdownOpen(false); }}
                >
                  <Text style={{ color: trackerTheme.colors.text }}>{blkActivity || 'Select an activity...'}</Text>
                  <Text style={{ color: trackerTheme.colors.text3, fontSize: 10 }}>▼</Text>
                </TouchableOpacity>
                
                {activityDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {activeCategoryForBlock.activities.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => { setBlkActivity(s); setActivityDropdownOpen(false); }}>
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

            {saveError && (
              <View style={{ backgroundColor: 'rgba(240,107,107,.12)', padding: 12, borderRadius: trackerTheme.radius.sm, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(240,107,107,.3)' }}>
                <Text style={{ color: trackerTheme.colors.accent3, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>{saveError}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setAddModalVisible(false); setSaveError(null); }}>
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