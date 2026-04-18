import * as SQLite from 'expo-sqlite';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

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
  taskName: string;
  subtask: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface TemplateBlock {
  start: string;
  end: string;
  taskName: string;
  sub: string;
}

export interface Template {
  id: string;
  name: string;
  color: string;
  blocks: TemplateBlock[];
}

export interface StatusUpdate {
  actual: number;
  scheduled: number;
  status: 'pending' | 'partial' | 'completed';
}

export interface TaskStatus {
  actual: number;
  scheduled: number;
  status: 'pending' | 'partial' | 'completed';
  subtasks: Record<string, StatusUpdate>;
}

interface TrackerContextType {
  tasks: Task[];
  schedule: Record<string, ScheduleItem[]>;
  templates: Template[];
  blockStatus: Record<string, Record<number, string>>;
  statusUpdates: Record<string, Record<string, TaskStatus>>;
  addTask: (task: Omit<Task, 'id'>) => void;
  addSubtask: (taskId: number, subtask: string) => void;
  removeSubtask: (taskId: number, subtaskIndex: number) => void;
  removeTask: (taskId: number) => void;
  updateTaskName: (taskId: number, newName: string) => void;
  addSchedule: (date: string, item: Omit<ScheduleItem, 'id' | 'status'>) => void;
  addTemplate: (template: Omit<Template, 'id'>) => void;
  deleteTemplate: (id: string) => void;
  assignTemplate: (date: string, templateId: string) => void;
  cycleBlockStatus: (date: string, itemId: number) => void;
  updateStatus: (date: string, taskName: string, subtask: string | undefined, status: 'pending' | 'partial' | 'completed', scheduledOverride?: number) => void;
  updateStatusHours: (date: string, taskName: string, subtask: string | undefined, hours: number, scheduledOverride?: number) => void;
}

const initialState = {
  tasks: [
    // { id: 1, name: 'Sleep', color: '#5BC4A0', icon: '🌙', subtasks: [], type: 'sleep' },
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
  templates:[
    // {id:'t1',name:'Weekday Routine',color:'#7C6DED',blocks:[
    //   {start:'06:00',end:'08:00',taskId:'1',sub:'Night Sleep'},
    //   {start:'08:00',end:'10:00',taskId:'2',sub:'Mathematics'},
    //   {start:'10:00',end:'11:00',taskId:'3',sub:'Cardio'},
    //   {start:'11:00',end:'14:00',taskId:'4',sub:'Deep Work'},
    //   {start:'15:00',end:'16:00',taskId:'2',sub:'English'},
    //   {start:'22:00',end:'06:00',taskId:'1',sub:'Night Sleep'}
    // ]},
    // {id:'t2',name:'Weekend Light',color:'#5BC4A0',blocks:[
    //   {start:'07:00',end:'09:00',taskId:'1',sub:'Night Sleep'},
    //   {start:'09:00',end:'10:00',taskId:'3',sub:'Yoga'},
    //   {start:'11:00',end:'13:00',taskId:'2',sub:'English'},
    //   {start:'23:00',end:'07:00',taskId:'1',sub:'Night Sleep'}
    // ]}
  ],
  statusUpdates: {} as Record<string, Record<string, TaskStatus>>
};


const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

let db: SQLite.SQLiteDatabase | null = null;
try {
  if (Platform.OS !== 'web') {
    // Uses the modern synchronous Expo SQLite API (SDK 50+)
    db = SQLite.openDatabaseSync('tracker.db');
    db.execSync(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }
} catch (e) {
  console.warn('SQLite init error:', e);
}

const loadState = (key: string, defaultVal: any) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const val = window.localStorage.getItem(`tracker_${key}`);
        return val ? JSON.parse(val) : defaultVal;
      }
    } catch (e) { return defaultVal; }
  }
  if (!db) return defaultVal;
  try {
    const result = db.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [key]);
    return result ? JSON.parse(result.value) : defaultVal;
  } catch (e) {
    console.warn('Error loading state for', key, e);
    return defaultVal;
  }
};

const saveState = (key: string, value: any) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(`tracker_${key}`, JSON.stringify(value));
    } catch (e) {}
    return;
  }
  if (!db) return;
  try {
    db.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  } catch (e) {
    console.warn('Error saving state for', key, e);
  }
};

export const TrackerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>(() => loadState('tasks', initialState.tasks));
  const [schedule, setSchedule] = useState<Record<string, ScheduleItem[]>>(() => {
    const loaded = loadState('schedule', initialState.schedule);
    if (Array.isArray(loaded)) return {}; // Clear state if using old array structure
    return loaded;
  });
  const [templates, setTemplates] = useState<Template[]>(() => {
    const loaded = loadState('templates', initialState.templates);
    return loaded.map((t: any) => ({
      ...t,
      blocks: (t.blocks || []).map((b: any) => {
        let tName = b.taskName;
        if (!tName && b.taskId) {
           const found = tasks.find(x => x.id === Number(b.taskId));
           tName = found ? found.name : String(b.taskId);
        }
        return { ...b, taskName: tName };
      })
    }));
  });
  const [blockStatus, setBlockStatus] = useState<Record<string, Record<number, string>>>(() => loadState('blockStatus', {}));
  const [statusUpdates, setStatusUpdates] = useState<Record<string, Record<string, TaskStatus>>>(() => loadState('statusUpdates', initialState.statusUpdates));

  useEffect(() => { saveState('tasks', tasks); }, [tasks]);
  useEffect(() => { saveState('schedule', schedule); }, [schedule]);
  useEffect(() => { saveState('templates', templates); }, [templates]);
  useEffect(() => { saveState('blockStatus', blockStatus); }, [blockStatus]);
  useEffect(() => { saveState('statusUpdates', statusUpdates); }, [statusUpdates]);

  const addTask = (task: Omit<Task, 'id'>) => {
    if (tasks.some(t => t.name.toLowerCase() === task.name.toLowerCase())) {
      return;
    }
    const id = Date.now();
    setTasks(prev => [...prev, { ...task, id }]);
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
    const taskToRemove = tasks.find(t => t.id === taskId);
    if (!taskToRemove) return;
    const taskName = taskToRemove.name;

    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSchedule(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        next[date] = next[date].filter(s => s.taskName !== taskName);
      });
      return next;
    });
    setStatusUpdates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        const dateUpdates = { ...next[date] };
        if (dateUpdates[taskName]) {
          delete dateUpdates[taskName];
          next[date] = dateUpdates;
        }
      });
      return next;
    });
  };

  const updateTaskName = (taskId: number, newName: string) => {
    if (tasks.some(t => t.id !== taskId && t.name.toLowerCase() === newName.toLowerCase())) {
      return;
    }
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;
    const oldName = taskToUpdate.name;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, name: newName } : t));

    setSchedule(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        next[date] = next[date].map(s => s.taskName === oldName ? { ...s, taskName: newName } : s);
      });
      return next;
    });

    setStatusUpdates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        if (next[date] && next[date][oldName]) {
          const dateUpdates = { ...next[date] };
          dateUpdates[newName] = dateUpdates[oldName];
          delete dateUpdates[oldName];
          next[date] = dateUpdates;
        }
      });
      return next;
    });
  };

  const addSchedule = (date: string, item: Omit<ScheduleItem, 'id' | 'status'>) => {
    setSchedule(prev => {
      const daySched = prev[date] || [];
      const newSched = [...daySched, { ...item, id: Date.now(), status: 'pending' as const }];
      return { ...prev, [date]: newSched.sort((a, b) => a.start.localeCompare(b.start)) };
    });
  };

  const addTemplate = (template: Omit<Template, 'id'>) => {
    setTemplates(prev => [...prev, { ...template, id: 't' + Date.now() }]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const assignTemplate = (date: string, templateId: string) => {
    setSchedule(prev => {
      const next = { ...prev };
      if (!templateId) {
        delete next[date];
        return next;
      }
      if (templateId === 'rest') {
        next[date] = [];
        return next;
      }
      const tpl = templates.find(t => t.id === templateId);
      if (!tpl) {
        delete next[date];
        return next;
      }
      const newItems: ScheduleItem[] = tpl.blocks.map((b, idx) => ({
        id: Date.now() + idx,
        start: b.start,
        end: b.end,
        taskName: b.taskName,
        subtask: b.sub,
        status: 'pending'
      }));
      next[date] = newItems.sort((a, b) => a.start.localeCompare(b.start));
      return next;
    });
  };

  const cycleBlockStatus = (date: string, itemId: number) => {
    setSchedule(prev => {
      const daySched = prev[date];
      if (!daySched) return prev;
      return {
        ...prev,
        [date]: daySched.map(s => {
          if (s.id === itemId) {
            const cycle = ['pending', 'in-progress', 'completed'] as const;
            const next = cycle[(cycle.indexOf(s.status) + 1) % cycle.length];
            return { ...s, status: next };
          }
          return s;
        })
      };
    });
  };

  const updateStatus = (date: string, taskName: string, subtask: string | undefined, status: 'pending' | 'partial' | 'completed', scheduledOverride?: number) => {
    setStatusUpdates(prev => {
      const dateData = prev[date] || {};
      const taskData = dateData[taskName] || { actual: 0, scheduled: 3, status: 'pending', subtasks: {} };
      
      if (subtask) {
        const currentSub = taskData.subtasks?.[subtask] || { actual: 0, scheduled: 3, status: 'pending' };
        const sched = scheduledOverride ?? currentSub.scheduled;
        const nextSub = { ...currentSub, scheduled: sched, status };
        if (status === 'completed') nextSub.actual = sched;
        return {
          ...prev,
          [date]: {
            ...dateData,
            [taskName]: {
              ...taskData,
              subtasks: { ...(taskData.subtasks || {}), [subtask]: nextSub }
            }
          }
        };
      } else {
        const sched = scheduledOverride ?? taskData.scheduled;
        const nextTask = { ...taskData, scheduled: sched, status };
        if (status === 'completed') nextTask.actual = sched;
        return { ...prev, [date]: { ...dateData, [taskName]: nextTask } };
      }
    });
  };

  const updateStatusHours = (date: string, taskName: string, subtask: string | undefined, hours: number, scheduledOverride?: number) => {
    setStatusUpdates(prev => {
      const dateData = prev[date] || {};
      const taskData = dateData[taskName] || { actual: 0, scheduled: 3, status: 'pending', subtasks: {} };
      
      if (subtask) {
        const currentSub = taskData.subtasks?.[subtask] || { actual: 0, scheduled: scheduledOverride ?? 3, status: 'pending' };
        const sched = scheduledOverride ?? currentSub.scheduled;
        const nextStatus = hours >= sched ? 'completed' : hours > 0 ? 'partial' : 'pending';
        return {
          ...prev,
          [date]: { ...dateData, [taskName]: { ...taskData, subtasks: { ...(taskData.subtasks || {}), [subtask]: { ...currentSub, actual: hours, scheduled: sched, status: nextStatus } } } }
        };
      } else {
        const sched = scheduledOverride ?? taskData.scheduled;
        const nextStatus = hours >= sched ? 'completed' : hours > 0 ? 'partial' : 'pending';
        return { ...prev, [date]: { ...dateData, [taskName]: { ...taskData, actual: hours, scheduled: sched, status: nextStatus } } };
      }
    });
  };

  return (
    <TrackerContext.Provider value={{
      tasks, schedule, templates, blockStatus, statusUpdates,
      addTask, addSubtask, removeSubtask,
      removeTask, updateTaskName,
      addSchedule, addTemplate, deleteTemplate, assignTemplate,
      cycleBlockStatus,
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
