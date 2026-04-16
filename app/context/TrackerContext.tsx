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

export interface TemplateBlock {
  start: string;
  end: string;
  taskId: number;
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

interface TrackerContextType {
  tasks: Task[];
  schedule: ScheduleItem[];
  templates: Template[];
  dateMap: Record<string, string>;
  blockStatus: Record<string, Record<number, string>>;
  statusUpdates: Record<string, StatusUpdate>;
  addTask: (task: Omit<Task, 'id'>) => void;
  addSubtask: (taskId: number, subtask: string) => void;
  removeSubtask: (taskId: number, subtaskIndex: number) => void;
  removeTask: (taskId: number) => void;
  updateTaskName: (taskId: number, newName: string) => void;
  addSchedule: (item: Omit<ScheduleItem, 'id' | 'status'>) => void;
  addTemplate: (template: Omit<Template, 'id'>) => void;
  deleteTemplate: (id: string) => void;
  assignTemplate: (date: string, templateId: string) => void;
  cycleBlockStatus: (date: string, blockIdx: number) => void;
  updateStatus: (id: string | number, status: 'pending' | 'partial' | 'completed', scheduledOverride?: number) => void;
  updateStatusHours: (id: string | number, hours: number, scheduledOverride?: number) => void;
}

const initialState = {
  tasks: [
    { id: 1, name: 'Sleep', color: '#5BC4A0', icon: '🌙', subtasks: [], type: 'sleep' },
    { id: 2, name: 'Learning', color: '#7C6DED', icon: '📚', subtasks: ['Mathematics', 'English', 'Science', 'History'], type: 'learn' },
    { id: 3, name: 'Exercise', color: '#F0A83E', icon: '🏋', subtasks: ['Cardio', 'Weight training', 'Yoga'], type: 'exercise' },
    { id: 4, name: 'Work', color: '#F06B6B', icon: '💼', subtasks: ['Meetings', 'Deep work', 'Emails'], type: 'work' }
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
    {id:'t1',name:'Weekday Routine',color:'#7C6DED',blocks:[
      {start:'06:00',end:'08:00',taskId:'1',sub:'Night Sleep'},
      {start:'08:00',end:'10:00',taskId:'2',sub:'Mathematics'},
      {start:'10:00',end:'11:00',taskId:'3',sub:'Cardio'},
      {start:'11:00',end:'14:00',taskId:'4',sub:'Deep Work'},
      {start:'15:00',end:'16:00',taskId:'2',sub:'English'},
      {start:'22:00',end:'06:00',taskId:'1',sub:'Night Sleep'}
    ]},
    {id:'t2',name:'Weekend Light',color:'#5BC4A0',blocks:[
      {start:'07:00',end:'09:00',taskId:'1',sub:'Night Sleep'},
      {start:'09:00',end:'10:00',taskId:'3',sub:'Yoga'},
      {start:'11:00',end:'13:00',taskId:'2',sub:'English'},
      {start:'23:00',end:'07:00',taskId:'1',sub:'Night Sleep'}
    ]}
  ],
  statusUpdates: {} as Record<string, StatusUpdate>
};


const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export const TrackerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>(initialState.tasks);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialState.schedule);
  const [templates, setTemplates] = useState<Template[]>(initialState.templates.map(t => ({ ...t, id: t.id, blocks: t.blocks.map(b => ({ ...b, taskId: parseInt(b.taskId) })) })));
  const [dateMap, setDateMap] = useState<Record<string, string>>({});
  const [blockStatus, setBlockStatus] = useState<Record<string, Record<number, string>>>({});
  const [statusUpdates, setStatusUpdates] = useState<Record<string, StatusUpdate>>(initialState.statusUpdates);

  const addTask = (task: Omit<Task, 'id'>) => {
    const id = Date.now();
    setTasks(prev => [...prev, { ...task, id }]);
    setStatusUpdates(prev => ({
      ...prev,
      [String(id)]: { actual: 0, scheduled: 2, status: 'pending' }
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
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k === String(taskId) || k.startsWith(`${taskId}_`)) {
          delete next[k];
        }
      });
      return next;
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

  const addTemplate = (template: Omit<Template, 'id'>) => {
    setTemplates(prev => [...prev, { ...template, id: 't' + Date.now() }]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setDateMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === id) delete next[k]; });
      return next;
    });
  };

  const assignTemplate = (date: string, templateId: string) => {
    setDateMap(prev => ({ ...prev, [date]: templateId }));
  };

  const cycleBlockStatus = (date: string, blockIdx: number) => {
    setBlockStatus(prev => {
      const dateStatus = prev[date] || {};
      const cycle = ['pending', 'in-progress', 'completed'];
      const current = dateStatus[blockIdx] || 'pending';
      const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
      return {
        ...prev,
        [date]: { ...dateStatus, [blockIdx]: next }
      };
    });
  };

  const updateStatus = (id: string | number, status: 'pending' | 'partial' | 'completed', scheduledOverride?: number) => {
    setStatusUpdates(prev => {
      const current = prev[String(id)] || { actual: 0, scheduled: 3, status: 'pending' };
      const sched = scheduledOverride ?? current.scheduled;
      const next = { ...current, scheduled: sched, status };
      if (status === 'completed') {
        next.actual = sched;
      }
      return { ...prev, [String(id)]: next };
    });
  };

  const updateStatusHours = (id: string | number, hours: number, scheduledOverride?: number) => {
    setStatusUpdates(prev => {
      const current = prev[String(id)] || { actual: 0, scheduled: scheduledOverride ?? 3, status: 'pending' };
      const sched = scheduledOverride ?? current.scheduled;
      const nextStatus = hours >= sched ? 'completed' : hours > 0 ? 'partial' : 'pending';
      return { ...prev, [String(id)]: { ...current, actual: hours, scheduled: sched, status: nextStatus } };
    });
  };

  return (
    <TrackerContext.Provider value={{
      tasks, schedule, templates, dateMap, blockStatus, statusUpdates,
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
