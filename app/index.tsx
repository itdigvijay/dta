import { useTrackerContext } from '@/app/context/TrackerContext';
import { Redirect } from 'expo-router';

export default function Index() {
  const { currentUser } = useTrackerContext();
  if (currentUser) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/login" />;
}