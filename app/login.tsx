import { useTrackerContext } from '@/app/context/TrackerContext';
import { trackerTheme } from '@/constants/trackerTheme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginUser } = useTrackerContext();
  
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    loginUser(name);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Who's tracking?</Text>
          <Text style={styles.subtitle}>
            Enter your profile name to open your personal dashboard.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Profile Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Priyanshi, Komal..." 
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
            <Text style={styles.submitBtnText}>Continue to App</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: trackerTheme.colors.text, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: trackerTheme.colors.text2, lineHeight: 22 },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: trackerTheme.colors.text2 },
  input: { backgroundColor: trackerTheme.colors.surface2, borderWidth: 1, borderColor: trackerTheme.colors.border, borderRadius: trackerTheme.radius.sm, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: trackerTheme.colors.text },
  submitBtn: { backgroundColor: trackerTheme.colors.accent, borderRadius: trackerTheme.radius.sm, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});