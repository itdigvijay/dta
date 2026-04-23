import * as SQLite from 'expo-sqlite';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  activities: string[];
  type: string;
}

export interface ScheduleItem {
  id: number;
  start: string;
  end: string;
  categoryName: string;
  activity: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface TemplateBlock {
  start: string;
  end: string;
  categoryName: string;
  activity: string;
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

export interface CategoryStatus {
  actual: number;
  scheduled: number;
  status: 'pending' | 'partial' | 'completed';
  activities: Record<string, StatusUpdate>;
}

interface TrackerContextType {
  categories: Category[];
  schedule: Record<string, ScheduleItem[]>;
  templates: Template[];
  blockStatus: Record<string, Record<number, string>>;
  statusUpdates: Record<string, Record<string, CategoryStatus>>;
  currentUser: string | null;
  loginUser: (name: string) => void;
  logoutUser: () => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  addActivity: (categoryId: number, activity: string) => void;
  removeActivity: (categoryId: number, activityIndex: number) => void;
  removeCategory: (categoryId: number) => void;
  updateCategoryName: (categoryId: number, newName: string) => void;
  addSchedule: (date: string, item: Omit<ScheduleItem, 'id' | 'status'>) => void;
  addTemplate: (template: Omit<Template, 'id'>) => void;
  deleteTemplate: (id: string) => void;
  assignTemplate: (date: string, templateId: string) => void;
  cycleBlockStatus: (date: string, itemId: number) => void;
  updateStatus: (date: string, categoryName: string, activity: string | undefined, status: 'pending' | 'partial' | 'completed', scheduledOverride?: number) => void;
  updateStatusHours: (date: string, categoryName: string, activity: string | undefined, hours: number, scheduledOverride?: number) => void;
}

const initialState = {
  categories: [] as Category[],
  schedule: {} as Record<string, ScheduleItem[]>,
  templates: [] as Template[],
  statusUpdates: {} as Record<string, Record<string, CategoryStatus>>
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

const loadGlobalState = (key: string, defaultVal: any) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const val = window.localStorage.getItem(`tracker_global_${key}`);
        return val ? JSON.parse(val) : defaultVal;
      }
    } catch (e) { return defaultVal; }
  }
  if (!db) return defaultVal;
  try {
    const result = db.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [`global_${key}`]);
    return result ? JSON.parse(result.value) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const saveGlobalState = (key: string, value: any) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(`tracker_global_${key}`, JSON.stringify(value));
    } catch (e) {}
    return;
  }
  if (!db) return;
  try {
    db.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [`global_${key}`, JSON.stringify(value)]);
  } catch (e) {}
};

const loadState = (key: string, defaultVal: any, username: string | null) => {
  if (!username) return defaultVal;
  const userKey = `${username}_${key}`;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const val = window.localStorage.getItem(`tracker_${userKey}`);
        if (val) return JSON.parse(val);
        const legacyVal = window.localStorage.getItem(`tracker_${key}`);
        return legacyVal ? JSON.parse(legacyVal) : defaultVal;
      }
    } catch (e) { return defaultVal; }
  }
  if (!db) return defaultVal;
  try {
    const result = db.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [userKey]);
    if (result) return JSON.parse(result.value);
    
    // Give legacy data to the first profile created so no data is lost!
    const legacyResult = db.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [key]);
    return legacyResult ? JSON.parse(legacyResult.value) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const saveState = (key: string, value: any, username: string | null) => {
  if (!username) return;
  const userKey = `${username}_${key}`;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(`tracker_${userKey}`, JSON.stringify(value));
    } catch (e) {}
    return;
  }
  if (!db) return;
  try {
    db.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [userKey, JSON.stringify(value)]);
  } catch (e) {}
};

export const TrackerProvider = ({ children }: { children: ReactNode }) => {
  const activeUser = loadGlobalState('active_user', null);
  const [currentUser, setCurrentUser] = useState<string | null>(activeUser);

  const loadCats = (u: string | null) => {
    const loaded = loadState('categories', null, u);
    if (loaded && Array.isArray(loaded)) return loaded;
    const oldTasks = loadState('tasks', initialState.categories, u);
    return (Array.isArray(oldTasks) ? oldTasks : []).map((t: any) => ({
      ...t,
      activities: t.activities || t.subtasks || []
    }));
  };

  const loadSched = (u: string | null) => {
    const loaded = loadState('schedule', initialState.schedule, u);
    if (!loaded || Array.isArray(loaded)) return {};
    const migrated: Record<string, ScheduleItem[]> = {};
    Object.keys(loaded).forEach(date => {
      migrated[date] = (Array.isArray(loaded[date]) ? loaded[date] : []).map((item: any) => ({
        ...item,
        categoryName: item.categoryName || item.taskName || '',
        activity: item.activity || item.subtask || ''
      }));
    });
    return migrated;
  };

  const loadTpls = (u: string | null) => {
    const loaded = loadState('templates', initialState.templates, u);
    if (!Array.isArray(loaded)) return [];
    return (loaded || []).map((t: any) => ({
      ...t,
      blocks: (Array.isArray(t.blocks) ? t.blocks : []).map((b: any) => {
        let cName = b.categoryName || b.taskName;
        if (!cName && b.taskId) {
           const oldCats = loadState('categories', null, u) || loadState('tasks', [], u);
           const found = (Array.isArray(oldCats) ? oldCats : []).find((x: any) => x.id === Number(b.taskId));
           cName = found ? found.name : String(b.taskId);
        }
        return { ...b, categoryName: cName, activity: b.activity || b.sub || b.subtask || '' };
      })
    }));
  };

  const loadUpdates = (u: string | null) => {
    const loaded = loadState('statusUpdates', initialState.statusUpdates, u);
    if (!loaded || typeof loaded !== 'object') return {};
    const migrated: Record<string, Record<string, CategoryStatus>> = {};
    Object.keys(loaded).forEach(date => {
      migrated[date] = {};
      Object.keys(loaded[date] || {}).forEach(catName => {
        const catData = loaded[date][catName];
        migrated[date][catName] = {
          ...catData,
          activities: catData.activities || catData.subtasks || {}
        };
      });
    });
    return migrated;
  };

  const [categories, setCategories] = useState<Category[]>(() => loadCats(activeUser));
  const [schedule, setSchedule] = useState<Record<string, ScheduleItem[]>>(() => loadSched(activeUser));
  const [templates, setTemplates] = useState<Template[]>(() => loadTpls(activeUser));
  const [blockStatus, setBlockStatus] = useState<Record<string, Record<number, string>>>(() => loadState('blockStatus', {}, activeUser));
  const [statusUpdates, setStatusUpdates] = useState<Record<string, Record<string, CategoryStatus>>>(() => loadUpdates(activeUser));

  const loginUser = (name: string) => {
    const uName = name.trim();
    saveGlobalState('active_user', uName);
    setCurrentUser(uName);
    setCategories(loadCats(uName));
    setSchedule(loadSched(uName));
    setTemplates(loadTpls(uName));
    setBlockStatus(loadState('blockStatus', {}, uName));
    setStatusUpdates(loadUpdates(uName));
  };

  const logoutUser = () => {
    saveGlobalState('active_user', null);
    setCurrentUser(null);
    setCategories([]);
    setSchedule({});
    setTemplates([]);
    setBlockStatus({});
    setStatusUpdates({});
  };

  useEffect(() => { if (currentUser) saveState('categories', categories, currentUser); }, [categories, currentUser]);
  useEffect(() => { if (currentUser) saveState('schedule', schedule, currentUser); }, [schedule, currentUser]);
  useEffect(() => { if (currentUser) saveState('templates', templates, currentUser); }, [templates, currentUser]);
  useEffect(() => { if (currentUser) saveState('blockStatus', blockStatus, currentUser); }, [blockStatus, currentUser]);
  useEffect(() => { if (currentUser) saveState('statusUpdates', statusUpdates, currentUser); }, [statusUpdates, currentUser]);

  const addCategory = (category: Omit<Category, 'id'>) => {
    if (categories.some(t => t.name.toLowerCase() === category.name.toLowerCase())) return;
    const id = Date.now();
    setCategories(prev => [...prev, { ...category, id }]);
  };

  const addActivity = (categoryId: number, activity: string) => {
    setCategories(prev => prev.map(t => t.id === categoryId ? { ...t, activities: [...t.activities, activity] } : t));
  };

  const removeActivity = (categoryId: number, activityIndex: number) => {
    setCategories(prev => prev.map(t => {
      if (t.id === categoryId) {
        const newSubs = [...t.activities];
        newSubs.splice(activityIndex, 1);
        return { ...t, activities: newSubs };
      }
      return t;
    }));
  };

  const removeCategory = (categoryId: number) => {
    const catToRemove = categories.find(t => t.id === categoryId);
    if (!catToRemove) return;
    const catName = catToRemove.name;

    setCategories(prev => prev.filter(t => t.id !== categoryId));
    setSchedule(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        next[date] = next[date].filter(s => s.categoryName !== catName);
      });
      return next;
    });
    setStatusUpdates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        const dateUpdates = { ...next[date] };
        if (dateUpdates[catName]) {
          delete dateUpdates[catName];
          next[date] = dateUpdates;
        }
      });
      return next;
    });
  };

  const updateCategoryName = (categoryId: number, newName: string) => {
    if (categories.some(t => t.id !== categoryId && t.name.toLowerCase() === newName.toLowerCase())) return;
    const catToUpdate = categories.find(t => t.id === categoryId);
    if (!catToUpdate) return;
    const oldName = catToUpdate.name;

    setCategories(prev => prev.map(t => t.id === categoryId ? { ...t, name: newName } : t));

    setSchedule(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        next[date] = next[date].map(s => s.categoryName === oldName ? { ...s, categoryName: newName } : s);
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
    const tplToDelete = templates.find(t => t.id === id);
    setTemplates(prev => prev.filter(t => t.id !== id));

    if (tplToDelete) {
      setSchedule(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(date => {
          const daySched = next[date];
          if (daySched && daySched.length > 0 && daySched.length === tplToDelete.blocks.length) {
            const isMatch = tplToDelete.blocks.every(tb => 
              daySched.some(ds => ds.start === tb.start && ds.end === tb.end && ds.categoryName === tb.categoryName)
            );
            if (isMatch) delete next[date];
          }
        });
        return next;
      });
      
      setStatusUpdates(prev => {
        const next = { ...prev };
        Object.keys(schedule).forEach(date => {
          const daySched = schedule[date];
          if (daySched && daySched.length > 0 && daySched.length === tplToDelete.blocks.length) {
            const isMatch = tplToDelete.blocks.every(tb => 
              daySched.some(ds => ds.start === tb.start && ds.end === tb.end && ds.categoryName === tb.categoryName)
            );
            if (isMatch) delete next[date];
          }
        });
        return next;
      });
    }
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
        categoryName: b.categoryName,
        activity: b.activity,
        status: 'pending'
      }));
      next[date] = newItems.sort((a, b) => a.start.localeCompare(b.start));
      return next;
    });

    if (!templateId || templateId === 'rest') {
      setStatusUpdates(prev => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
    }
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

  const updateStatus = (date: string, categoryName: string, activity: string | undefined, status: 'pending' | 'partial' | 'completed', scheduledOverride?: number) => {
    setStatusUpdates(prev => {
      const dateData = prev[date] || {};
      const catData = dateData[categoryName] || { actual: 0, scheduled: 3, status: 'pending', activities: {} };
      
      if (activity) {
        const currentSub = catData.activities?.[activity] || { actual: 0, scheduled: 3, status: 'pending' };
        const sched = scheduledOverride ?? currentSub.scheduled;
        const nextSub = { ...currentSub, scheduled: sched, status };
        if (status === 'completed') nextSub.actual = sched;
        return {
          ...prev,
          [date]: {
            ...dateData,
            [categoryName]: {
              ...catData,
              activities: { ...(catData.activities || {}), [activity]: nextSub }
            }
          }
        };
      } else {
        const sched = scheduledOverride ?? catData.scheduled;
        const nextCat = { ...catData, scheduled: sched, status };
        if (status === 'completed') nextCat.actual = sched;
        return { ...prev, [date]: { ...dateData, [categoryName]: nextCat } };
      }
    });
  };

  const updateStatusHours = (date: string, categoryName: string, activity: string | undefined, hours: number, scheduledOverride?: number) => {
    setStatusUpdates(prev => {
      const dateData = prev[date] || {};
      const catData = dateData[categoryName] || { actual: 0, scheduled: 3, status: 'pending', activities: {} };
      
      if (activity) {
        const currentSub = catData.activities?.[activity] || { actual: 0, scheduled: scheduledOverride ?? 3, status: 'pending' };
        const sched = scheduledOverride ?? currentSub.scheduled;
        const nextStatus = hours >= sched ? 'completed' : hours > 0 ? 'partial' : 'pending';
        return {
          ...prev,
          [date]: { ...dateData, [categoryName]: { ...catData, activities: { ...(catData.activities || {}), [activity]: { ...currentSub, actual: hours, scheduled: sched, status: nextStatus } } } }
        };
      } else {
        const sched = scheduledOverride ?? catData.scheduled;
        const nextStatus = hours >= sched ? 'completed' : hours > 0 ? 'partial' : 'pending';
        return { ...prev, [date]: { ...dateData, [categoryName]: { ...catData, actual: hours, scheduled: sched, status: nextStatus } } };
      }
    });
  };

  return (
    <TrackerContext.Provider value={{
      categories, schedule, templates, blockStatus, statusUpdates,
      currentUser, loginUser, logoutUser,
      addCategory, addActivity, removeActivity,
      removeCategory, updateCategoryName,
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
