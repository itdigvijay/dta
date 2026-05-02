import * as SQLite from 'expo-sqlite';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

export const lightTheme = {
  colors: {
    bg: '#F5F5F7',
    surface: '#FFFFFF',
    surface2: '#F2F2F7',
    surface3: '#E5E5EA',
    border: '#D1D1D6',
    text: '#1C1C1E',
    text2: '#3A3A3C',
    text3: '#8E8E93',
    accent: '#7C6DED',
    accent2: '#5BC4A0',
    accent3: '#F06B6B',
    accent4: '#F0A83E',
  },
  radius: { sm: 8, md: 12, lg: 16 }
};

export const darkTheme = {
  colors: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    surface3: '#3A3A3C',
    border: '#38383A',
    text: '#FFFFFF',
    text2: '#EBEBF5',
    text3: '#EBEBF599',
    accent: '#9D93F1',
    accent2: '#6EE3BD',
    accent3: '#FF7A7A',
    accent4: '#FFBA52',
  },
  radius: { sm: 8, md: 12, lg: 16 }
};

export function useTrackerTheme() {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}

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

export interface UserProfile {
  id: string;
  name: string;
}

interface TrackerContextType {
  categories: Category[];
  schedule: Record<string, ScheduleItem[]>;
  templates: Template[];
  blockStatus: Record<string, Record<number, string>>;
  statusUpdates: Record<string, Record<string, CategoryStatus>>;
  currentUser: UserProfile | null;
  users: UserProfile[];
  loginUser: (user: UserProfile) => void;
  logoutUser: () => void;
  deleteUser: (id: string) => void;
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
  importUserData: (data: any) => void;
  exportProfile: (userId: string) => any;
  exportAllProfiles: () => any;
  importProfile: (userId: string, data: any, overrideName?: string) => void;
  saveBackup: (name: string, data: string) => void;
  getBackups: () => string[];
  getBackupData: (name: string) => string | null;
  deleteBackup: (name: string) => void;
}

const defaultCategories: Category[] = [];

const defaultTemplates: Template[] = [];

const initialState = {
  categories: defaultCategories,
  schedule: {} as Record<string, ScheduleItem[]>,
  templates: defaultTemplates,
  statusUpdates: {} as Record<string, Record<string, CategoryStatus>>
};


const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

let db: SQLite.SQLiteDatabase | null = null;
const getDB = () => {
  if (db) return db;
  if (Platform.OS !== 'web') {
    try {
      const newDb = SQLite.openDatabaseSync('tracker.db');
      newDb.execSync(`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      db = newDb;
    } catch (e) {
      console.warn('SQLite init error:', e);
      return null;
    }
  }
  return db;
};

const loadGlobalState = (key: string, defaultVal: any) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const val = window.localStorage.getItem(`tracker_global_${key}`);
        return val ? JSON.parse(val) : defaultVal;
      }
    } catch (e) { return defaultVal; }
  }
  const database = getDB();
  if (!database) return defaultVal;
  try {
    const result = database.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [`global_${key}`]);
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
  const database = getDB();
  if (!database) return;
  try {
    database.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [`global_${key}`, JSON.stringify(value)]);
  } catch (e) {}
};

const loadState = (key: string, defaultVal: any, userId: string | null) => {
  if (!userId) return defaultVal;
  const userKey = `${userId}_${key}`;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        const val = window.localStorage.getItem(`tracker_${userKey}`);
        if (val) return JSON.parse(val);
        
        const usersVal = window.localStorage.getItem('tracker_global_users');
        const globalUsers = usersVal ? JSON.parse(usersVal) : [];
        const firstUser = globalUsers[0];
        const firstUserId = typeof firstUser === 'string' ? firstUser : firstUser?.id;
        if (globalUsers.length > 0 && firstUserId !== userId) return defaultVal;

        const legacyVal = window.localStorage.getItem(`tracker_${key}`);
        return legacyVal ? JSON.parse(legacyVal) : defaultVal;
      }
    } catch (e) { return defaultVal; }
  }
  const database = getDB();
  if (!database) return defaultVal;
  try {
    const result = database.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [userKey]);
    if (result) return JSON.parse(result.value);
    
    const usersResult = database.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', ['global_users']);
    const globalUsers = usersResult ? JSON.parse(usersResult.value) : [];
    const firstUser = globalUsers[0];
    const firstUserId = typeof firstUser === 'string' ? firstUser : firstUser?.id;
    if (globalUsers.length > 0 && firstUserId !== userId) return defaultVal;

    const legacyResult = database.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [key]);
    return legacyResult ? JSON.parse(legacyResult.value) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const saveState = (key: string, value: any, userId: string | null) => {
  if (!userId) return;
  const userKey = `${userId}_${key}`;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(`tracker_${userKey}`, JSON.stringify(value));
    } catch (e) {}
    return;
  }
  const database = getDB();
  if (!database) return;
  try {
    database.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [userKey, JSON.stringify(value)]);
  } catch (e) {}
};

export const TrackerProvider = ({ children }: { children: ReactNode }) => {
  const rawActiveUser = loadGlobalState('active_user', null);
  const migratedActiveUser = typeof rawActiveUser === 'string' ? { id: rawActiveUser, name: rawActiveUser } : rawActiveUser;
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(migratedActiveUser);
  
  const rawUsers = loadGlobalState('users', []);
  const migratedUsers = rawUsers.map((u: any) => typeof u === 'string' ? { id: u, name: u } : u);
  const [users, setUsers] = useState<UserProfile[]>(migratedUsers);

  const parseCategories = (data: any) => {
    const raw = data.categories || data.tasks || [];
    return raw.map((t: any) => ({
      ...t,
      activities: t.activities || t.subtasks || []
    }));
  };

  const parseSchedule = (data: any) => {
    const raw = data.schedule || {};
    const migrated: Record<string, ScheduleItem[]> = {};
    Object.keys(raw).forEach(date => {
      migrated[date] = (Array.isArray(raw[date]) ? raw[date] : []).map((item: any) => ({
        ...item,
        categoryName: item.categoryName || item.taskName || '',
        activity: item.activity || item.subtask || ''
      }));
    });
    return migrated;
  };

  const parseTemplates = (data: any, fallbackCats: any[] = []) => {
    const raw = data.templates || [];
    return raw.map((t: any) => ({
      ...t,
      blocks: (Array.isArray(t.blocks) ? t.blocks : []).map((b: any) => {
        let cName = b.categoryName || b.taskName;
        if (!cName && b.taskId) {
           const found = fallbackCats.find((x: any) => x.id === Number(b.taskId));
           cName = found ? found.name : String(b.taskId);
        }
        return { ...b, categoryName: cName || '', activity: b.activity || b.sub || b.subtask || '' };
      })
    }));
  };

  const parseUpdates = (data: any) => {
    const raw = data.statusUpdates || {};
    const migrated: Record<string, Record<string, CategoryStatus>> = {};
    Object.keys(raw).forEach(date => {
      migrated[date] = {};
      Object.keys(raw[date] || {}).forEach(catName => {
        const catData = raw[date][catName];
        migrated[date][catName] = {
          ...catData,
          activities: catData.activities || catData.subtasks || {}
        };
      });
    });
    return migrated;
  };

  const loadCats = (u: string | null) => {
    const c = loadState('categories', null, u);
    const t = loadState('tasks', null, u);
    const raw = c || t || initialState.categories;
    return parseCategories({ categories: raw });
  };

  const loadSched = (u: string | null) => {
    return parseSchedule({ schedule: loadState('schedule', initialState.schedule, u) });
  };

  const loadTpls = (u: string | null) => {
    const c = loadState('categories', null, u) || loadState('tasks', [], u);
    return parseTemplates({ templates: loadState('templates', initialState.templates, u) }, Array.isArray(c) ? c : []);
  };

  const loadUpdates = (u: string | null) => {
    return parseUpdates({ statusUpdates: loadState('statusUpdates', initialState.statusUpdates, u) });
  };

  const [categories, setCategories] = useState<Category[]>(() => loadCats(migratedActiveUser?.id || null));
  const [schedule, setSchedule] = useState<Record<string, ScheduleItem[]>>(() => loadSched(migratedActiveUser?.id || null));
  const [templates, setTemplates] = useState<Template[]>(() => loadTpls(migratedActiveUser?.id || null));
  const [blockStatus, setBlockStatus] = useState<Record<string, Record<number, string>>>(() => loadState('blockStatus', {}, migratedActiveUser?.id || null));
  const [statusUpdates, setStatusUpdates] = useState<Record<string, Record<string, CategoryStatus>>>(() => loadUpdates(migratedActiveUser?.id || null));

  const loginUser = (user: UserProfile) => {
    saveGlobalState('active_user', user);
    setCurrentUser(user);
    
    setUsers(prev => {
      if (!prev.some(u => u.id === user.id)) {
        const next = [...prev, user];
        saveGlobalState('users', next);
        return next;
      }
      return prev;
    });

    setCategories(loadCats(user.id));
    setSchedule(loadSched(user.id));
    setTemplates(loadTpls(user.id));
    setBlockStatus(loadState('blockStatus', {}, user.id));
    setStatusUpdates(loadUpdates(user.id));
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

  const deleteUser = (id: string) => {
    setUsers(prev => {
      const updatedUsers = prev.filter(u => u.id !== id);
      saveGlobalState('users', updatedUsers);
      return updatedUsers;
    });

    // Clean up local database for this user
    const keysToRemove = ['categories', 'schedule', 'templates', 'blockStatus', 'statusUpdates'];
    if (Platform.OS === 'web') {
      try { keysToRemove.forEach(k => window.localStorage.removeItem(`tracker_${id}_${k}`)); } catch (e) {}
    } else {
      const database = getDB();
      if (database) {
        try {
          keysToRemove.forEach(k => { database.runSync('DELETE FROM app_state WHERE key = ?', [`${id}_${k}`]); });
        } catch (e) {}
      }
    }
  };

  useEffect(() => { if (currentUser) saveState('categories', categories, currentUser.id); }, [categories, currentUser]);
  useEffect(() => { if (currentUser) saveState('schedule', schedule, currentUser.id); }, [schedule, currentUser]);
  useEffect(() => { if (currentUser) saveState('templates', templates, currentUser.id); }, [templates, currentUser]);
  useEffect(() => { if (currentUser) saveState('blockStatus', blockStatus, currentUser.id); }, [blockStatus, currentUser]);
  useEffect(() => { if (currentUser) saveState('statusUpdates', statusUpdates, currentUser.id); }, [statusUpdates, currentUser]);

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

  const importUserData = (data: any) => {
    const cats = parseCategories(data);
    setCategories(cats);
    setSchedule(parseSchedule(data));
    setTemplates(parseTemplates(data, cats));
    if (data.blockStatus) setBlockStatus(data.blockStatus);
    setStatusUpdates(parseUpdates(data));
  };

  const exportProfile = (userId: string) => {
    const targetUser = users.find(u => u.id === userId) || { id: userId, name: 'User' };
    return {
      version: 1,
      app: 'DailyTracker',
      user: targetUser,
      categories: loadState('categories', defaultCategories, userId),
      schedule: loadState('schedule', {}, userId),
      templates: loadState('templates', defaultTemplates, userId),
      blockStatus: loadState('blockStatus', {}, userId),
      statusUpdates: loadState('statusUpdates', {}, userId),
    };
  };

  const exportAllProfiles = () => {
    const profilesData = users.map(u => {
      if (currentUser && currentUser.id === u.id) {
        return {
          user: u,
          categories,
          schedule,
          templates,
          blockStatus,
          statusUpdates
        };
      }
      return {
        user: u,
        categories: loadState('categories', defaultCategories, u.id),
        schedule: loadState('schedule', {}, u.id),
        templates: loadState('templates', defaultTemplates, u.id),
        blockStatus: loadState('blockStatus', {}, u.id),
        statusUpdates: loadState('statusUpdates', {}, u.id),
      };
    });
    return {
      version: 2,
      app: 'DailyTracker',
      type: 'multi-profile',
      profiles: profilesData
    };
  };

  const importProfile = (userId: string, data: any, overrideName?: string) => {
    const newName = overrideName || data.user?.name || 'Imported User';
    
    setUsers(prev => {
      let currentUsers = [...prev];
      const existingIndex = currentUsers.findIndex(u => u.id === userId);
      if (existingIndex >= 0) {
        currentUsers[existingIndex] = { ...currentUsers[existingIndex], name: newName };
      } else {
        currentUsers.push({ id: userId, name: newName });
      }
      saveGlobalState('users', currentUsers);
      return currentUsers;
    });

    const cats = parseCategories(data);
    const sched = parseSchedule(data);
    const tpls = parseTemplates(data, cats);
    const updates = parseUpdates(data);

    saveState('categories', cats, userId);
    saveState('schedule', sched, userId);
    saveState('templates', tpls, userId);
    if (data.blockStatus) saveState('blockStatus', data.blockStatus, userId);
    saveState('statusUpdates', updates, userId);

    if (currentUser?.id === userId) {
       setCategories(cats);
       setSchedule(sched);
       setTemplates(tpls);
       if (data.blockStatus) setBlockStatus(data.blockStatus);
       setStatusUpdates(updates);
       setCurrentUser({ id: userId, name: newName });
    }
  };

  const saveBackup = (name: string, data: string) => {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(name, data); } catch (e) {}
      return;
    }
    const database = getDB();
    if (!database) throw new Error('Database is not initialized.');
    try { 
      database.runSync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [name, data]); 
    } catch (e) {
      console.error('Backup save error:', e);
      throw new Error('Failed to write backup to database.');
    }
  };

  const getBackups = () => {
    if (Platform.OS === 'web') {
      const backups: string[] = [];
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key?.startsWith('Backup_')) backups.push(key);
        }
      } catch (e) {}
      return backups;
    }
    const database = getDB();
    if (!database) return [];
    try {
      const result = database.getAllSync<{key: string}>("SELECT key FROM app_state");
      return result.filter(r => r.key && r.key.startsWith('Backup_')).map(r => r.key);
    } catch (e) { 
      console.error('Get backups error:', e);
      return []; 
    }
  };

  const getBackupData = (name: string) => {
    if (Platform.OS === 'web') { try { return window.localStorage.getItem(name); } catch (e) { return null; } }
  const database = getDB();
  if (!database) return null;
  try { const result = database.getFirstSync<{value: string}>('SELECT value FROM app_state WHERE key = ?', [name]); return result ? result.value : null; } catch (e) { return null; }
  };

  const deleteBackup = (name: string) => {
    if (Platform.OS === 'web') { try { window.localStorage.removeItem(name); } catch (e) {} return; }
  const database = getDB();
  if (!database) return;
  try { database.runSync('DELETE FROM app_state WHERE key = ?', [name]); } catch (e) {}
  };

  return (
    <TrackerContext.Provider value={{
      categories, schedule, templates, blockStatus, statusUpdates,
      currentUser, users, loginUser, logoutUser, deleteUser,
      addCategory, addActivity, removeActivity,
      removeCategory, updateCategoryName,
      addSchedule, addTemplate, deleteTemplate, assignTemplate,
      cycleBlockStatus,
      updateStatus, updateStatusHours, importUserData,
      exportProfile, exportAllProfiles, importProfile,
      saveBackup, getBackups, getBackupData, deleteBackup
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

// Dummy default export to satisfy Expo Router warning for files inside the /app directory
export default function TrackerContextRoute() { return null; }
