import { useTrackerContext } from '@/app/context/TrackerContext';
import { trackerTheme } from '@/constants/trackerTheme';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { categories, statusUpdates, schedule, addCategory, addActivity, removeActivity, removeCategory, updateCategoryName } = useTrackerContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState<number | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📌');
  const [newCategoryColor, setNewCategoryColor] = useState('#7C6DED');
  const [newCategoryActivities, setNewCategoryActivities] = useState('');

  const [newActivityName, setNewActivityName] = useState('');

  const colors = ['#5BC4A0', '#7C6DED', '#F06B6B', '#F0A83E', '#378ADD'];
  const icons = ['📚', '🌙', '🏋', '💼', '🎵', '🍎', '🧘', '💡'];

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.some(t => t.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      return;
    }

    const subs = newCategoryActivities.split(',').map(s => s.trim()).filter(Boolean);
    addCategory({
      name: newCategoryName,
      icon: newCategoryIcon,
      color: newCategoryColor,
      activities: subs,
      type: 'work'
    });
    setModalVisible(false);
    setNewCategoryName('');
    setNewCategoryActivities('');
  };

  const handleAddActivity = (categoryId: number) => {
    if (!newActivityName.trim()) return;
    addActivity(categoryId, newActivityName.trim());
    setNewActivityName('');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>My Categories</Text>
          <Text style={styles.pageSub}>Manage categories & activities</Text>
        </View>
        <TouchableOpacity style={styles.chip} onPress={() => setModalVisible(true)}>
          <Text style={styles.chipText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.section}>
        <Text style={styles.sectionTitle}>Active Categories</Text>
        {categories.map(category => {
          let actual = 0, sched = 0;

          Object.values(schedule).forEach(daySched => {
            if (daySched) {
              daySched.forEach(item => {
                if (item.categoryName === category.name) {
                  const [sh, sm] = item.start.split(':').map(Number);
                  let [eh, em] = item.end.split(':').map(Number);
                  if (eh < sh) eh += 24;
                  sched += (eh * 60 + (em || 0) - (sh * 60 + (sm || 0))) / 60;
                }
              });
            }
          });

          Object.values(statusUpdates).forEach(dateData => {
            const catData = dateData[category.name];
            if (catData) {
              actual += catData.actual || 0;
              if (catData.activities) {
                Object.values(catData.activities).forEach(subU => {
                  actual += subU.actual || 0;
                });
              }
            }
          });
          const progress = sched > 0 ? Math.round((actual / sched) * 100) : 0;
          
          return (
            <TouchableOpacity key={category.id} style={styles.taskCard} onPress={() => setCategoryModalVisible(category.id)}>
              <View style={styles.taskCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>{category.icon}</Text>
                  <Text style={styles.taskName}>{category.name}</Text>
                </View>
                <View style={[styles.taskBadge, { backgroundColor: category.color + '26' }]}>
                  {/* <Text style={{ color: task.color, fontSize: 10, fontWeight: '600' }}>{task.subtasks.length} subtasks</Text> */}
                           <TouchableOpacity onPress={() => removeCategory(category.id)}>
                               <Text style={{ color: trackerTheme.colors.accent3, fontSize: 18 }}>×</Text>
                          </TouchableOpacity>
                  
                </View>
              </View>
              <View>
                {category.activities.slice(0, 3).map((s, i) => (
                  <View key={i} style={styles.subtaskRow}>
                    <View style={[styles.subtaskDot, { backgroundColor: category.color }]} />
                    <Text style={styles.subtaskName}>{s}</Text>
                  </View>
                ))}
                {category.activities.length > 3 && (
                  <View style={styles.subtaskRow}>
                    <View style={styles.subtaskDot} />
                    <Text style={[styles.subtaskName, { color: trackerTheme.colors.text3 }]}>+{category.activities.length - 3} more</Text>
                  </View>
                )}
              </View>
              {/* <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: task.color }]} />
              </View> */}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add new category</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Category</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category Name</Text>
              <TextInput style={styles.inputField} placeholder="e.g. Reading, Meditation..." placeholderTextColor={trackerTheme.colors.text3} value={newCategoryName} onChangeText={setNewCategoryName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Icon</Text>
              <View style={styles.colorOptions}>
                {icons.map(ic => (
                  <TouchableOpacity key={ic} onPress={() => setNewCategoryIcon(ic)} style={[styles.iconOpt, newCategoryIcon === ic && { borderColor: trackerTheme.colors.accent }]}>
                    <Text style={{ fontSize: 18 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Color</Text>
              <View style={styles.colorOptions}>
                {colors.map(c => (
                  <TouchableOpacity key={c} onPress={() => setNewCategoryColor(c)} style={[styles.colorOpt, { backgroundColor: c }, newCategoryColor === c && styles.colorOptSelected]} />
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Activities (comma-separated)</Text>
              <TextInput style={styles.inputField} placeholder="e.g. Math, English" placeholderTextColor={trackerTheme.colors.text3} value={newCategoryActivities} onChangeText={setNewCategoryActivities} />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}><Text style={styles.btnCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAddCategory}><Text style={styles.btnPrimaryText}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View/Edit Task Modal */}
      {categoryModalVisible !== null && (
        <Modal visible transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modal}>
              {(() => {
                const category = categories.find(t => t.id === categoryModalVisible);
                if (!category) return null;
                return (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <Text style={{ fontSize: 28 }}>{category.icon}</Text>
                      <Text style={styles.modalTitle}>{category.name}</Text>
                    </View>
                    <Text style={styles.sectionTitle}>Activities</Text>
                    <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
                      {category.activities.map((s, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: trackerTheme.colors.border }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: category.color }} />
                          <Text style={{ flex: 1, fontSize: 14, color: trackerTheme.colors.text }}>{s}</Text>
                          <TouchableOpacity onPress={() => removeActivity(category.id, i)}>
                            <Text style={{ color: trackerTheme.colors.accent3, fontSize: 18 }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[styles.inputField, { flex: 1 }]} placeholder="Add activity..." placeholderTextColor={trackerTheme.colors.text3} value={newActivityName} onChangeText={setNewActivityName} />
                      <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 16, paddingVertical: 10 }]} onPress={() => handleAddActivity(category.id)}>
                        <Text style={styles.btnPrimaryText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={[styles.btnCancel, { flex: 1 }]} onPress={() => setCategoryModalVisible(null)}><Text style={styles.btnCancelText}>Close</Text></TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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
  section: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: trackerTheme.colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  taskCard: { backgroundColor: trackerTheme.colors.surface, borderRadius: trackerTheme.radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: trackerTheme.colors.border },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  taskName: { fontSize: 15, fontWeight: '600', color: trackerTheme.colors.text },
  taskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  subtaskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: trackerTheme.colors.text3 },
  subtaskName: { fontSize: 13, color: trackerTheme.colors.text2 },
  progressBar: { height: 3, backgroundColor: trackerTheme.colors.surface3, borderRadius: 2, marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 2 },
  addBtn: { width: '100%', padding: 13, borderRadius: trackerTheme.radius.lg, borderWidth: 1.5, borderColor: trackerTheme.colors.surface3, borderStyle: 'dashed', alignItems: 'center', marginBottom: 10 },
  addBtnText: { color: trackerTheme.colors.text3, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: trackerTheme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, color: trackerTheme.colors.text2, marginBottom: 6 },
  inputField: { width: '100%', backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: trackerTheme.colors.text, fontSize: 14 },
  colorOptions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  iconOpt: { width: 36, height: 36, borderRadius: 8, backgroundColor: trackerTheme.colors.surface2, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorOpt: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorOptSelected: { borderColor: 'white' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1, padding: 12, backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 14, fontWeight: '600' },
  btnCancel: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnCancelText: { color: trackerTheme.colors.text2, fontSize: 14 },
});
