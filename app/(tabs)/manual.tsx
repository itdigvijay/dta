import { useTrackerTheme } from '@/app/context/TrackerContext';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ManualScreen() {
  const insets = useSafeAreaInsets();
  const trackerTheme = useTrackerTheme();
  const styles = getStyles(trackerTheme);
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>📖 User Guide</Text>
        <Text style={styles.pageSub}>How to use DailyTracker</Text>
      </View>
      <ScrollView contentContainerStyle={styles.section} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Categories 🗂️</Text>
          <Text style={styles.cardText}>
            First, go to the "Categories" tab. Here you can set up your daily activities. 
            For example: <Text style={{fontWeight: '700'}}>Sleep, Work, Health, or Study</Text>. 
            Within each category, you can also add specific activities (e.g., "Meetings" under Work).
          </Text>
        </View>
         
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Schedule 📅</Text>
          <Text style={styles.cardText}>
            Next, go to the "Schedule" tab and create a <Text style={{fontWeight: '700'}}>Template</Text> for your day (e.g., "Weekday" or "Weekend"). 
            Please note that a template must cover exactly 24 hours. 
            {"\n\n"}Once the template is created, switch to the "Calendar" view to assign it to any specific day.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Update (Track) ✅</Text>
          <Text style={styles.cardText}>
            Before going to sleep, visit the "Update" tab. Here, the app will ask you how much time you actually spent on your scheduled tasks. 
            Log your exact spent time and submit your daily progress.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>4. Dashboard 📊</Text>
          <Text style={styles.cardText}>
            In the "Dashboard" tab, you will find your daily, weekly, and monthly performance reports. 
            You can see how focused you were compared to your targets and analyze where your time was spent.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>5. Data Backup 💾</Text>
          <Text style={styles.cardText}>
            Since this app is 100% offline, use the "Save Backup" button on the Login screen to keep your data safe and secure.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (trackerTheme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: trackerTheme.colors.bg },
  pageHeader: { paddingHorizontal: 20, paddingVertical: 16, marginBottom: 10 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: trackerTheme.colors.text, letterSpacing: -0.5 },
  pageSub: { fontSize: 14, color: trackerTheme.colors.text2, marginTop: 4 },
  section: { paddingHorizontal: 20, paddingBottom: 100 },
  card: { 
    backgroundColor: trackerTheme.colors.surface, 
    borderRadius: trackerTheme.radius.lg, 
    padding: 18, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: trackerTheme.colors.border 
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: trackerTheme.colors.accent, marginBottom: 8 },
  cardText: { fontSize: 14, color: trackerTheme.colors.text, lineHeight: 22 },
});