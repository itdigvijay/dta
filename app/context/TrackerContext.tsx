import { createContext, ReactNode, useContext, useState } from 'react';

export interface Task {
  id: number;
  name: string;
  color: string;
  icon: string;
  subtasks: string[];
  type: string;
}

export interface ScheduleItem {
  id: number;
  start: string;
  end: string;
  taskId: number;
  subtask: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface StatusUpdate {
  actual: number;
  scheduled: number;
  status: 'pending' | 'partial' | 'completed';
}

interface TrackerContextType {
  tasks: Task[];
  schedule: ScheduleItem[];
  statusUpdates: Record<number, StatusUpdate>;
  addTask: (task: Omit<Task, 'id'>) => void;
  addSubtask: (taskId: number, subtask: string) => void;
  removeSubtask: (taskId: number, subtaskIndex: number) => void;
  removeTask: (taskId: number) => void;
  updateTaskName: (taskId: number, newName: string) => void;
  addSchedule: (item: Omit<ScheduleItem, 'id' | 'status'>) => void;
  cycleScheduleStatus: (id: number) => void;
  updateStatus: (taskId: number, status: 'pending' | 'partial' | 'completed') => void;
  updateStatusHours: (taskId: number, hours: number) => void;
}

const initialState = {
  tasks: [
    // { id: 1, name: 'Sleep', color: '#5BC4A0', icon: '🌙', subtasks: ['Deep sleep', 'Nap'], type: 'sleep' },
    // { id: 2, name: 'Learning', color: '#7C6DED', icon: '📚', subtasks: ['Mathematics', 'English', 'Science', 'History'], type: 'learn' },
    // { id: 3, name: 'Exercise', color: '#F0A83E', icon: '🏋', subtasks: ['Cardio', 'Weight training', 'Yoga'], type: 'exercise' },
    // { id: 4, name: 'Work', color: '#F06B6B', icon: '💼', subtasks: ['Meetings', 'Deep work', 'Emails'], type: 'work' }
  ],
  schedule: [
    // { id: 1, start: '06:00', end: '08:00', taskId: 1, subtask: 'Deep sleep', status: 'completed' as const },
    // { id: 2, start: '08:00', end: '10:00', taskId: 2, subtask: 'Mathematics', status: 'completed' as const },
    // { id: 3, start: '10:00', end: '11:00', taskId: 3, subtask: 'Cardio', status: 'in-progress' as const },
    // { id: 4, start: '11:00', end: '14:00', taskId: 4, subtask: 'Deep work', status: 'pending' as const },
    // { id: 5, start: '15:00', end: '16:00', taskId: 2, subtask: 'English', status: 'pending' as const },
    // { id: 6, start: '22:00', end: '06:00', taskId: 1, subtask: 'Night sleep', status: 'pending' as const }
  ],
  statusUpdates: {
    1: { actual: 8, scheduled: 8, status: 'completed' as const },
    2: { actual: 2, scheduled: 3, status: 'partial' as const },
    3: { actual: 0.75, scheduled: 1, status: 'partial' as const },
    4: { actual: 6, scheduled: 8, status: 'partial' as const }
  }
};

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export const TrackerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>(initialState.tasks);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialState.schedule);
  const [statusUpdates, setStatusUpdates] = useState<Record<number, StatusUpdate>>(initialState.statusUpdates);

  const addTask = (task: Omit<Task, 'id'>) => {
    const id = Date.now();
    setTasks(prev => [...prev, { ...task, id }]);
    setStatusUpdates(prev => ({
      ...prev,
      [id]: { actual: 0, scheduled: 2, status: 'pending' }
    }));
  };

  const addSubtask = (taskId: number, subtask: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t));
  };

  const removeSubtask = (taskId: number, subtaskIndex: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newSubs = [...t.subtasks];
        newSubs.splice(subtaskIndex, 1);
        return { ...t, subtasks: newSubs };
      }
      return t;
    }));
  };

  const removeTask = (taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSchedule(prev => prev.filter(s => s.taskId !== taskId));
    setStatusUpdates(prev => {
      const { [taskId]: _, ...rest } = prev;
      return rest;
    });
  };

  const updateTaskName = (taskId: number, newName: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, name: newName } : t));
  };

  const addSchedule = (item: Omit<ScheduleItem, 'id' | 'status'>) => {
    setSchedule(prev => {
      const newSched = [...prev, { ...item, id: Date.now(), status: 'pending' as const }];
      return newSched.sort((a, b) => a.start.localeCompare(b.start));
    });
  };

  const cycleScheduleStatus = (id: number) => {
    setSchedule(prev => prev.map(s => {
      if (s.id === id) {
        const cycle = ['pending', 'in-progress', 'completed'] as const;
        const next = cycle[(cycle.indexOf(s.status) + 1) % cycle.length];
        return { ...s, status: next };
      }
      return s;
    }));
  };

  const updateStatus = (taskId: number, status: 'pending' | 'partial' | 'completed') => {
    setStatusUpdates(prev => {
      const current = prev[taskId] || { actual: 0, scheduled: 3, status: 'pending' };
      const next = { ...current, status };
      if (status === 'completed') {
        next.actual = next.scheduled;
      }
      return { ...prev, [taskId]: next };
    });
  };

  const updateStatusHours = (taskId: number, hours: number) => {
    setStatusUpdates(prev => {
      const current = prev[taskId] || { actual: 0, scheduled: 3, status: 'pending' };
      const nextStatus = hours >= current.scheduled ? 'completed' : hours > 0 ? 'partial' : 'pending';
      return { ...prev, [taskId]: { ...current, actual: hours, status: nextStatus } };
    });
  };

  return (
    <TrackerContext.Provider value={{
      tasks, schedule, statusUpdates,
      addTask, addSubtask, removeSubtask,
      removeTask, updateTaskName,
      addSchedule, cycleScheduleStatus,
      updateStatus, updateStatusHours
    }}>
      {children}
    </TrackerContext.Provider>
  );
};

export const useTrackerContext = () => {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error('useTrackerContext must be used within a TrackerProvider');
  }
  return context;
};
