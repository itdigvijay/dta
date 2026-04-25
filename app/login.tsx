import { useTrackerContext, useTrackerTheme } from '@/app/context/TrackerContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginUser, users, deleteUser, exportAllProfiles, importProfile } = useTrackerContext();
  const trackerTheme = useTrackerTheme();
  const styles = getStyles(trackerTheme);
  
  const [isCreatingNew, setIsCreatingNew] = useState(users.length === 0);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [multiImportData, setMultiImportData] = useState<any | null>(null);
  const [multiImportTarget, setMultiImportTarget] = useState<{ id: string | null, name: string } | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    if (users.length === 0) {
      setIsCreatingNew(true);
    }
  }, [users]);

  const handleSelectUser = (user: { id: string; name: string }) => {
    loginUser(user);
    router.replace('/(tabs)');
  };

  const handleDeleteUser = (user: { id: string; name: string }) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${user.name}"?\n\nThis will permanently remove all their tasks, schedules, and data.`);
      if (confirmed) {
        deleteUser(user.id);
      }
      return;
    }

    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete "${user.name}"?\n\nThis will permanently remove all their tasks, schedules, and data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteUser(user.id) }
      ]
    );
  };

  const handleSubmit = () => {
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (users.some(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('Profile already exists. Please select it from the list.');
      return;
    }

    const newUser = { id: `usr_${Date.now()}`, name: name.trim() };
    loginUser(newUser);
    setName('');
    setIsCreatingNew(false);
    router.replace('/(tabs)');
  };

  const exportAndShareBackup = async () => {
    try {
      const backup = exportAllProfiles();
      const jsonStr = JSON.stringify(backup, null, 2);
      
      const date = new Date();
      const safeName = `DailyTracker_Backup_${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}.json`;

      if (Platform.OS === 'web') {
        const blob = new (window as any).Blob([jsonStr], { type: 'application/json' });
        const url = (window as any).URL.createObjectURL(blob);
        const a = (document as any).createElement('a');
        a.href = url;
        a.download = safeName;
        a.click();
        (window as any).URL.revokeObjectURL(url);
        return;
      }

      // Use cacheDirectory for temporary sharing to avoid storage permission issues
      const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
      if (!dir) {
        Alert.alert(
          'File System Not Ready ⚠️', 
          'Cannot create file. Do you want to share the backup data as text instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Share Text', onPress: () => Share.share({ message: jsonStr, title: 'Tracker Backup' }) }
          ]
        );
        return;
      }
      
      const fileUri = `${dir}${safeName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonStr);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share Tracker Backup',
          UTI: 'public.json'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message || 'An error occurred while exporting data.');
    }
  };

  const processImportFile = async (targetId: string | null, targetName: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      let fileContent = '';
      if (Platform.OS === 'web' && (result.assets[0] as any).file) {
        fileContent = await (result.assets[0] as any).file.text();
      } else {
        fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      }
      const data = JSON.parse(fileContent);
      if (data.app !== 'DailyTracker') {
        Alert.alert('Invalid Backup', 'This file is not a valid tracker backup.');
        return;
      }
      
      if (data.type === 'multi-profile') {
        setMultiImportData(data);
        setMultiImportTarget({ id: targetId, name: targetName });
        setSelectedIndices(data.profiles.map((_: any, i: number) => i));
      } else {
        confirmAndImport(targetId, data, targetName || data.user?.name || 'Imported User');
      }
    } catch (e) {
      Alert.alert('Import Failed', 'The selected file is invalid or corrupted.');
    }
  };

  const confirmAndImport = (targetId: string | null, data: any, targetName: string) => {
    const finalId = targetId || `usr_${Date.now()}`;
    const doImport = () => {
      importProfile(finalId, data, targetName);
      const msg = `Data successfully imported for ${targetName}!`;
      if (Platform.OS === 'web') (window as any).alert(msg); else Alert.alert('Success', msg);
      setName('');
      setIsCreatingNew(false);
    };

    if (targetId) {
      if (Platform.OS === 'web') {
        if ((window as any).confirm(`Overwrite data for "${targetName}" with this backup?`)) doImport();
      } else {
        Alert.alert('Restore Data', `Overwrite data for "${targetName}" with this backup?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', style: 'destructive', onPress: doImport }
        ]);
      }
    } else {
      doImport();
    }
  };

  const handleImportMultiple = () => {
    const doImport = () => {
      selectedIndices.forEach(idx => {
        const p = multiImportData.profiles[idx];
        if (multiImportTarget?.name && selectedIndices.length === 1) {
          const finalId = multiImportTarget.id || `usr_${Date.now()}`;
          importProfile(finalId, p, multiImportTarget.name);
        } else {
          importProfile(p.user?.id || `usr_${Date.now()}`, p, p.user?.name || 'Imported User');
        }
      });
      const msg = `Successfully imported ${selectedIndices.length} profile(s)!`;
      if (Platform.OS === 'web') (window as any).alert(msg); else Alert.alert('Success', msg);
      setMultiImportData(null);
      setSelectedIndices([]);
      setName('');
      setIsCreatingNew(false);
    };

    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Import ${selectedIndices.length} profile(s)? Existing data for these profiles will be overwritten.`)) doImport();
    } else {
      Alert.alert('Restore Data', `Import ${selectedIndices.length} profile(s)?\nExisting data for these profiles will be overwritten.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', style: 'destructive', onPress: doImport }
      ]);
    }
  };

  const handlePasteImport = () => {
    try {
      const data = JSON.parse(pasteText.trim());
      if (data.app !== 'DailyTracker') {
        Alert.alert('Invalid Data', 'This text does not appear to be a valid backup.');
        return;
      }
      
      setPasteModalVisible(false);
      setPasteText('');

      if (data.type === 'multi-profile') {
        setMultiImportData(data);
        setMultiImportTarget({ id: null, name: '' });
        setSelectedIndices(data.profiles.map((_: any, i: number) => i));
      } else {
        confirmAndImport(null, data, data.user?.name || 'Imported User');
      }
    } catch (e) {
      Alert.alert('Import Failed', 'The pasted text is invalid or corrupted. Please make sure you copied the entire text.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Who's tracking?</Text>
          <Text style={styles.subtitle}>
            {isCreatingNew ? 'Enter your profile name to open your personal dashboard.' : 'Select your profile to continue.'}
          </Text>
        </View>

        {isCreatingNew ? (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Profile Name</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Your name" 
                placeholderTextColor={trackerTheme.colors.text3}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {error && (
              <View style={{ backgroundColor: 'rgba(240,107,107,.12)', padding: 12, borderRadius: trackerTheme.radius.sm, borderWidth: 1, borderColor: 'rgba(240,107,107,.3)' }}>
                <Text style={{ color: trackerTheme.colors.accent3, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>Create & Continue</Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, marginTop: 0 }]} onPress={exportAndShareBackup}>
                <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text, fontSize: 14 }]}>📤 Share Backup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, marginTop: 0 }]} onPress={() => processImportFile(null, '')}>
                <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text, fontSize: 14 }]}>📂 Import JSON</Text>
              </TouchableOpacity>
            </View>
            
            {users.length > 0 && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsCreatingNew(false); setError(null); setName(''); }}>
                <Text style={styles.cancelBtnText}>Back to profiles</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.userList}>
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={true}>
              {users.map(u => (
                <View key={u.id} style={styles.userCard}>
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleSelectUser(u)}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteUser(u)}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity style={styles.addUserBtn} onPress={() => setIsCreatingNew(true)}>
              <View style={[styles.userAvatar, { backgroundColor: trackerTheme.colors.surface2 }]}>
                <Text style={[styles.userAvatarText, { color: trackerTheme.colors.text2 }]}>+</Text>
              </View>
              <Text style={styles.addUserName}>Add New Profile</Text>
            </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, marginTop: 0 }]} onPress={exportAndShareBackup}>
                  <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text, fontSize: 14 }]}>📤 Share Backup</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, marginTop: 0 }]} onPress={() => processImportFile(null, '')}>
                  <Text style={[styles.submitBtnText, { color: trackerTheme.colors.text, fontSize: 14 }]}>📂 Import JSON</Text>
                </TouchableOpacity>
              </View>
          </View>
        )}
      </ScrollView>

        {/* Multi-Profile Import Modal */}
        <Modal visible={!!multiImportData} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Select Profiles to Import</Text>
              <Text style={{ fontSize: 13, color: trackerTheme.colors.text2, marginBottom: 16, textAlign: 'center' }}>
                This backup contains multiple profiles. Select the ones you want to import.
              </Text>
              <ScrollView style={{ maxHeight: 400, marginBottom: 10 }} showsVerticalScrollIndicator={true}>
                {multiImportData?.profiles?.map((p: any, i: number) => {
                  const isSelected = selectedIndices.includes(i);
                  return (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.userCard, { marginBottom: 8, borderColor: isSelected ? trackerTheme.colors.accent : trackerTheme.colors.border, backgroundColor: isSelected ? trackerTheme.colors.accent + '15' : trackerTheme.colors.surface }]} 
                    onPress={() => {
                      setSelectedIndices(prev => prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i]);
                    }}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{(p.user?.name || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userName}>{p.user?.name || 'Unknown Profile'}</Text>
                    <View style={{ paddingHorizontal: 10 }}><Text style={{ fontSize: 20 }}>{isSelected ? '☑️' : '⬜️'}</Text></View>
                  </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnCancelModal} onPress={() => { setMultiImportData(null); setSelectedIndices([]); }}>
                  <Text style={styles.btnCancelTextModal}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary, selectedIndices.length === 0 && { opacity: 0.5 }]} disabled={selectedIndices.length === 0} onPress={handleImportMultiple}>
                  <Text style={styles.btnPrimaryText}>Import ({selectedIndices.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Paste Text Import Modal */}
        <Modal visible={pasteModalVisible} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Paste Backup Data</Text>
              <Text style={{ fontSize: 13, color: trackerTheme.colors.text2, marginBottom: 16, textAlign: 'center' }}>
                Paste the backup text you copied earlier to restore your data.
              </Text>
              <TextInput
                style={[styles.input, { height: 150, textAlignVertical: 'top', marginBottom: 10 }]}
                multiline
                placeholder='{"version":2,"app":"DailyTracker"...}'
                placeholderTextColor={trackerTheme.colors.text3}
                value={pasteText}
                onChangeText={setPasteText}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnCancelModal} onPress={() => { setPasteModalVisible(false); setPasteText(''); }}>
                  <Text style={styles.btnCancelTextModal}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary, !pasteText.trim() && { opacity: 0.5 }]} disabled={!pasteText.trim()} onPress={handlePasteImport}>
                  <Text style={styles.btnPrimaryText}>Import</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (trackerTheme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: trackerTheme.colors.text, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: trackerTheme.colors.text2, lineHeight: 22 },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: trackerTheme.colors.text2 },
  input: { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: trackerTheme.colors.text },
  submitBtn: { backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: trackerTheme.colors.text2, fontSize: 14, fontWeight: '600' },
  userList: { gap: 12 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: trackerTheme.colors.surface, paddingLeft: 12, paddingVertical: 8, borderRadius: trackerTheme.radius.lg, borderWidth: 1, borderColor: trackerTheme.colors.border },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: trackerTheme.colors.accent, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  userAvatarText: { color: 'white', fontSize: 18, fontWeight: '700' },
  userName: { flex: 1, fontSize: 16, fontWeight: '600', color: trackerTheme.colors.text },
  deleteBtn: { padding: 8, paddingHorizontal: 12 },
  deleteBtnText: { color: trackerTheme.colors.accent3, fontSize: 18, fontWeight: '600' },
  addUserBtn: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  addUserName: { fontSize: 15, fontWeight: '600', color: trackerTheme.colors.text2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: trackerTheme.colors.surface, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: trackerTheme.colors.text, marginBottom: 8, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnPrimary: { flex: 1, padding: 14, backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontSize: 15, fontWeight: '600' },
  btnCancelModal: { flex: 1, padding: 14, backgroundColor: trackerTheme.colors.surface2, borderRadius: trackerTheme.radius.sm, alignItems: 'center' },
  btnCancelTextModal: { color: trackerTheme.colors.text2, fontSize: 15, fontWeight: '600' },
});