/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useRef, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MarkdownIt from 'markdown-it';
import { 
  Plus, 
  Calendar as CalendarIcon,
  Image as ImageIcon,
  X,
  Target,
  Hash,
  Edit3,
  Eye,
  Trash2,
  Save,
  CheckCircle2,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Maximize2,
  Type
} from 'lucide-react';
import { DayEntry } from './types';
import { TipTapEditor } from './components/TipTapEditor';

const STATUS_CONFIG = {
  unproductive: {
    label: '低效',
    icon: Target,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    indicator: 'bg-amber-500',
    hex: '#f59e0b',
    border: 'border-amber-100',
    desc: '阻力较大，建议整理待办，简化任务。'
  },
  neutral: {
    label: '平稳',
    icon: Hash,
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    indicator: 'bg-sky-500',
    hex: '#0ea5e9',
    border: 'border-sky-100',
    desc: '节奏稳定，按部就班。'
  },
  productive: {
    label: '高效',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    indicator: 'bg-emerald-500',
    hex: '#10b981',
    border: 'border-emerald-100',
    desc: '状态极佳！保持心流，乘胜追击。'
  },
  rest: {
    label: '休整',
    icon: CalendarIcon,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    indicator: 'bg-indigo-500',
    hex: '#6366f1',
    border: 'border-indigo-100',
    desc: '充分的放松是为了更好的出发。'
  }
} as const;

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
});

// Fallback mock data if server is empty
const generateMockData = (): DayEntry[] => {
  const data: DayEntry[] = [];
  const statuses: DayEntry['status'][] = ['productive', 'neutral', 'unproductive', 'rest'];
  const themes = ['项目攻坚', '深度学习', '身心休整', '创意发散', '琐事处理'];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({
      id: `day-${i}`,
      date: d,
      theme: themes[i % themes.length],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      goals: [
        { id: `g-${i}-1`, text: '整理周报内容', progress: 100, images: [] },
        { id: `g-${i}-2`, text: '学习 React Spring 动画库', progress: 45, images: [] },
        { id: `g-${i}-3`, text: '由于天气原因推迟户外运动', progress: 0, images: [] },
      ],
      note: i === 0 ? '保持专注，哪怕是一点点进步也值得记录。' : undefined
    });
  }
  return data;
};

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50 p-8 flex-col text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
            <X className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">出错了</h1>
          <p className="text-gray-500 mb-6 max-w-md">日笺在运行时遇到了一个意外错误。我们已经记录了此问题。</p>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-left w-full max-w-xl overflow-auto max-h-48 shadow-sm">
            <code className="text-xs text-rose-500 font-mono whitespace-pre-wrap">{this.state.error?.toString()}</code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-memos-accent text-white font-bold rounded-xl shadow-lg shadow-memos-accent/20 hover:scale-105 transition-all"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [entries, setEntries] = useState<DayEntry[]>([]);

  // Global Error Listener for 'Uncaught' messages outside React
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global captured error:", event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [newTaskText, setNewTaskText] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [confirmDeleteDayId, setConfirmDeleteDayId] = useState<string | null>(null);
  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const [isGridView, setIsGridView] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const skipSave = useRef(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const selectedEntry = entries.find(e => e.id === selectedDayId) || entries[0];

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/entries');
        const data = await res.json();
        if (data && data.length > 0) {
          const parsedData = data.map((entry: any) => ({
            ...entry,
            date: new Date(entry.date)
          }));
          skipSave.current = true;
          setEntries(parsedData);
          setSelectedDayId(parsedData[0].id);
        } else {
          const mock = generateMockData();
          setEntries(mock);
          setSelectedDayId(mock[0].id);
        }
      } catch (err) {
        console.error("Failed to load data", err);
        const mock = generateMockData();
        setEntries(mock);
        setSelectedDayId(mock[0].id);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const saveData = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries)
      });
    } catch (err) {
      console.error("Failed to save data", err);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  // Save data automatically
  useEffect(() => {
    if (!isLoaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }

    const timer = setTimeout(saveData, 800); 
    return () => clearTimeout(timer);
  }, [entries, isLoaded]);

  const toggleGoalExpand = (goalId: string) => {
    setExpandedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const updateGoalProgress = (dayId: string, goalId: string, progress: number) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return {
          ...entry,
          goals: entry.goals.map(g => g.id === goalId ? { ...g, progress } : g)
        };
      }
      return entry;
    }));
  };

  const updateGoalDescription = (dayId: string, goalId: string, description: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return {
          ...entry,
          goals: entry.goals.map(g => g.id === goalId ? { ...g, description } : g)
        };
      }
      return entry;
    }));
  };

  const updateGoalText = (dayId: string, goalId: string, text: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return {
          ...entry,
          goals: entry.goals.map(g => g.id === goalId ? { ...g, text } : g)
        };
      }
      return entry;
    }));
  };

  const deleteGoal = (dayId: string, goalId: string) => {
    if (confirmDeleteGoalId !== goalId) {
      setConfirmDeleteGoalId(goalId);
      setTimeout(() => {
        if (isMounted.current) setConfirmDeleteGoalId(null);
      }, 3000); // 3秒后重置状态
      return;
    }
    
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return {
          ...entry,
          goals: entry.goals.filter(g => g.id !== goalId)
        };
      }
      return entry;
    }));
    setConfirmDeleteGoalId(null);
  };

  const updateDayTheme = (dayId: string, theme: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return { ...entry, theme };
      }
      return entry;
    }));
  };

  const addGoalImage = (dayId: string, goalId: string, imageData: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return {
          ...entry,
          goals: entry.goals.map(g => g.id === goalId ? { ...g, images: [...(g.images || []), imageData] } : g)
        };
      }
      return entry;
    }));
  };

  const removeGoalImage = (dayId: string, goalId: string, imgIndex: number) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return {
          ...entry,
          goals: entry.goals.map(g => {
            if (g.id === goalId) {
              const newImages = [...(g.images || [])];
              newImages.splice(imgIndex, 1);
              return { ...g, images: newImages };
            }
            return g;
          })
        };
      }
      return entry;
    }));
  };

  const handlePaste = useCallback((e: React.ClipboardEvent, dayId: string, goalId: string) => {
    // If the rich editor is open for this goal, TipTap handles its own paste
    // This prevents images from being added twice (once in text, once in attachments)
    if (editingGoalId === goalId) {
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              const imageData = event.target.result as string;
              addGoalImage(dayId, goalId, imageData);
            }
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
        }
      }
    }
  }, [editingGoalId]);

  const addDay = (specificDate?: Date) => {
    let date: Date;
    
    if (specificDate) {
      date = specificDate;
    } else {
      // Safely base on previous entry or fall back to now
      const baseDate = entries.length > 0 && entries[0].date instanceof Date && !isNaN(entries[0].date.getTime())
        ? entries[0].date
        : new Date();
      
      date = new Date(baseDate);
      date.setDate(date.getDate() + 1);
    }
    
    // Triple-check date validity to prevent RangeError in UI
    if (isNaN(date.getTime())) {
      date = new Date();
    }

    // Check duplicate
    const exists = entries.find(e => 
      e.date.getFullYear() === date.getFullYear() && 
      e.date.getMonth() === date.getMonth() && 
      e.date.getDate() === date.getDate()
    );

    if (exists) {
      if (specificDate) {
        setSelectedDayId(exists.id);
      }
      return;
    }
    
    const newEntry: DayEntry = {
      id: `day-${Date.now()}`,
      date: date,
      status: 'neutral',
      goals: []
    };
    
    const newEntries = [...entries, newEntry].sort((a, b) => b.date.getTime() - a.date.getTime());
    setEntries(newEntries);
    setSelectedDayId(newEntry.id);
  };

  const deleteDay = (dayId: string) => {
    if (confirmDeleteDayId !== dayId) {
      setConfirmDeleteDayId(dayId);
      setTimeout(() => {
        if (isMounted.current) setConfirmDeleteDayId(null);
      }, 3000); // 3秒后重置状态
      return;
    }

    const newEntries = entries.filter(e => e.id !== dayId);
    setEntries(newEntries);
    setConfirmDeleteDayId(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(dayId);
      return next;
    });
    
    if (newEntries.length > 0) {
      if (selectedDayId === dayId) {
        setSelectedDayId(newEntries[0].id);
      }
    } else {
      // If no entries left, create a fresh one for today
      const today = new Date();
      const freshEntry: DayEntry = {
        id: `day-${Date.now()}`,
        date: today,
        status: 'neutral',
        goals: []
      };
      setEntries([freshEntry]);
      setSelectedDayId(freshEntry.id);
    }
  };

  const batchDelete = () => {
    if (selectedIds.size === 0) return;
    
    const newEntries = entries.filter(e => !selectedIds.has(e.id));
    
    if (newEntries.length === 0) {
      const today = new Date();
      const freshEntry: DayEntry = {
        id: `day-${Date.now()}`,
        date: today,
        status: 'neutral',
        goals: []
      };
      setEntries([freshEntry]);
      setSelectedDayId(freshEntry.id);
    } else {
      setEntries(newEntries);
      if (selectedIds.has(selectedDayId)) {
        setSelectedDayId(newEntries[0].id);
      }
    }
    
    setSelectedIds(new Set());
    setIsBatchMode(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateDayStatus = (dayId: string, status: DayEntry['status']) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === dayId) {
        return { ...entry, status };
      }
      return entry;
    }));
  };

  if (!isLoaded || !selectedEntry) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-memos-bg flex-col gap-4">
        <Target className="w-10 h-10 text-memos-accent animate-pulse" />
        <span className="text-sm font-bold text-memos-text-dim uppercase tracking-widest animate-pulse">正在开启日笺...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-memos-bg selection:bg-memos-accent/10 relative">
      {/* Sidebar - Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 bg-memos-sidebar border-r border-memos-border flex flex-col overflow-hidden z-50 transition-all duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}
      `}>
        <div className={`p-6 border-b border-memos-border flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'hidden' : ''}`}>
            <div className="w-8 h-8 bg-memos-accent rounded-lg flex items-center justify-center text-white">
              <Target className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">日笺</span>
          </div>
          <div className={`flex items-center gap-1 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
            <button 
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedIds(new Set());
              }}
              className={`p-2 rounded-lg transition-all ${isBatchMode ? 'bg-memos-accent text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
              title={isBatchMode ? "退出批量操作" : "批量操作"}
            >
              <Type className={`w-4 h-4 transition-transform ${isBatchMode ? 'rotate-12' : ''}`} />
            </button>
            <button 
              onClick={saveData}
              title="手动保存数据"
              disabled={isSaving}
              className={`p-2 rounded-lg transition-all ${isSaving ? 'text-amber-500 bg-amber-50' : 'text-gray-400 hover:bg-gray-100 hover:text-memos-accent'}`}
            >
              {isSaving ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Save className="w-4 h-4" />
                </motion.div>
              ) : (
                <Save className="w-4 h-4" />
              )}
            </button>
            <button 
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsSidebarOpen(false);
                }
              }}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              title={isSidebarCollapsed ? "展开菜单" : "折叠菜单"}
            >
              {window.innerWidth < 1024 ? <X className="w-4 h-4" /> : (isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!isSidebarCollapsed && (
            <div className="px-2 mb-2">
              <span className="text-[10px] font-bold text-memos-text-dim uppercase tracking-wider">TIMELINE</span>
            </div>
          )}
          {entries.map((entry) => {
            const isActive = selectedDayId === entry.id;
            const isSelected = selectedIds.has(entry.id);
            const entryGoals = entry.goals || [];
            const completedCount = entryGoals.reduce((acc, g) => acc + (g.progress === 100 ? 1 : 0), 0);
            const progress = entryGoals.length ? (completedCount / entryGoals.length) * 100 : 0;
            
            // Safety check for date
            if (!(entry.date instanceof Date) || isNaN(entry.date.getTime())) {
              return null;
            }
            
            return (
              <button
                key={entry.id}
                onClick={() => {
                  if (isBatchMode) {
                    toggleSelection(entry.id);
                  } else {
                    setSelectedDayId(entry.id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }
                }}
                className={`w-full text-left rounded-xl transition-all group relative flex flex-col ${
                  isSidebarCollapsed ? 'items-center' : 'items-start'
                } ${
                  isActive && !isBatchMode
                    ? 'bg-white shadow-sm ring-1 ring-memos-border' 
                    : isSelected
                      ? 'bg-memos-accent/10 ring-1 ring-memos-accent/30'
                      : 'hover:bg-gray-100 text-memos-text-main'
                } ${isSidebarCollapsed ? 'p-3' : 'p-4 gap-1'}`}
              >
                <div className={`flex items-start w-full gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                  {/* Selection Checkbox */}
                  {isBatchMode && !isSidebarCollapsed && (
                    <div className={`w-4 h-4 rounded border transition-all mt-1.5 shrink-0 flex items-center justify-center ${isSelected ? 'bg-memos-accent border-memos-accent' : 'bg-white border-gray-300'}`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  )}

                  {/* Left: Date Block */}
                  {!isSidebarCollapsed && (
                    <div className="flex flex-col shrink-0 min-w-[56px]">
                      <span className={`text-[14px] font-bold tracking-tight leading-tight ${isActive ? 'text-memos-text-main' : 'text-memos-text-dim'}`}>
                        {entry.date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }).replace(/\s/g, '')}
                      </span>
                      <span className="text-[10px] font-medium text-memos-text-dim/60">
                        {entry.date.toLocaleDateString('zh-CN', { weekday: 'short' })}
                      </span>
                    </div>
                  )}

                  {isSidebarCollapsed && (
                    <span className={`text-[11px] font-bold ${isActive ? 'text-memos-accent' : 'text-memos-text-dim'}`}>
                      {entry.date.getDate()}
                    </span>
                  )}

                  {/* Right: Info Block */}
                  {!isSidebarCollapsed && (
                    <div className="flex-1 flex flex-col items-start min-w-0 pt-0.5">
                      <span className={`text-[11px] font-bold truncate w-full ${isActive ? 'text-memos-text-main' : 'text-memos-text-dim/80'}`}>
                        {entry.theme || '无主题'}
                      </span>
                      <div className="w-full max-w-[64px] h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5 backdrop-blur-sm">
                        <motion.div 
                          initial={false}
                          animate={{ width: `${progress}%` }}
                          style={{ backgroundColor: STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG]?.hex || '#94a3b8' }}
                          className="h-full opacity-70" 
                        />
                      </div>
                    </div>
                  )}

                  {/* Status Dot */}
                  <div 
                    className={`w-2 h-2 rounded-full shrink-0 shadow-sm transition-all mt-1.5 ${isSidebarCollapsed ? 'absolute top-1 right-1 mt-0' : ''}`}
                    style={{ backgroundColor: STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG]?.hex || '#d1d5db' }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-memos-border bg-white flex flex-col gap-3">
          {isBatchMode ? (
            <div className={`flex flex-col gap-2 ${isSidebarCollapsed ? 'hidden' : ''}`}>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-bold text-memos-text-dim uppercase">已选 {selectedIds.size} 项</span>
                <button 
                  onClick={() => {
                    if (selectedIds.size === entries.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(entries.map(e => e.id)));
                  }}
                  className="text-[10px] font-bold text-memos-accent hover:underline"
                >
                  {selectedIds.size === entries.length ? "取消全选" : "全选"}
                </button>
              </div>
              <button 
                onClick={batchDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center justify-center gap-2 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl shadow-sm shadow-rose-500/20 hover:bg-rose-600 disabled:opacity-50 disabled:grayscale transition-all"
              >
                <Trash2 className="w-4 h-4" />
                删除选中项
              </button>
              <button 
                onClick={() => setIsBatchMode(false)}
                className="py-2 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-all text-center"
              >
                退出批量模式
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  addDay();
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 bg-memos-accent text-white text-sm font-bold rounded-xl shadow-sm shadow-memos-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex-1 ${isSidebarCollapsed ? 'hidden' : ''}`}
                title="记录后一天"
              >
                <Plus className="w-4 h-4" />
                {!isSidebarCollapsed && "记录新的一天"}
              </button>
              
              <div className={`relative ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                <input 
                  ref={dateInputRef}
                  type="date"
                  onChange={(e) => {
                    if (e.target.value) {
                      const pickedDate = new Date(e.target.value);
                      // Check if exists first
                      const exists = entries.find(e => 
                        e.date.getFullYear() === pickedDate.getFullYear() && 
                        e.date.getMonth() === pickedDate.getMonth() && 
                        e.date.getDate() === pickedDate.getDate()
                      );
                      
                      if (exists) {
                        setSelectedDayId(exists.id);
                        if (window.innerWidth < 1024) setIsSidebarOpen(false);
                      } else {
                        setPendingDate(pickedDate);
                      }
                      e.target.value = '';
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 w-10 h-10"
                  title="选择日期"
                />
                <button 
                  className="flex items-center justify-center w-10 h-10 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between px-2 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
              <span>Server Sync</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span>{isSaving ? 'Saving...' : 'Synced'}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-memos-bg overflow-hidden relative">
        <header className="h-16 border-b border-memos-border bg-white/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 lg:gap-3 text-sm font-medium overflow-hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <CalendarIcon className="w-4 h-4 text-memos-text-dim shrink-0 hidden sm:block" />
            <div className="flex items-center gap-1.5 lg:gap-2 overflow-hidden">
              <span className="shrink-0 text-xs sm:text-sm">
                {selectedEntry.date instanceof Date && !isNaN(selectedEntry.date.getTime())
                  ? selectedEntry.date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
                  : '无效日期'}
              </span>
              <div className="h-4 w-px bg-memos-border mx-0.5 shrink-0" />
              <input 
                type="text"
                value={selectedEntry.theme || ''}
                onChange={(e) => updateDayTheme(selectedEntry.id, e.target.value)}
                placeholder="设置今日主题..."
                className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-memos-accent font-bold placeholder:text-gray-300 placeholder:font-normal w-24 sm:w-32 md:w-48 truncate text-xs sm:text-sm transition-all focus:translate-x-1"
              />
              <div className="h-4 w-px bg-memos-border mx-1 shrink-0" />
              <button 
                onClick={() => deleteDay(selectedEntry.id)}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${confirmDeleteDayId === selectedEntry.id ? 'bg-rose-500 text-white px-3' : 'text-gray-300 hover:text-rose-500 hover:bg-rose-50'}`}
                title="删除该日期及其所有纪录"
              >
                <Trash2 className="w-4 h-4" />
                {confirmDeleteDayId === selectedEntry.id && <span className="text-[10px] font-bold">再次点击确认删除</span>}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:gap-6 shrink-0">
            <div className="flex items-center gap-1.5 lg:gap-2 mr-2">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => {
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;
                  const isSelected = selectedEntry.status === status;
                  
                  return (
                    <button
                      key={status}
                      onClick={() => updateDayStatus(selectedEntry.id, status)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] lg:text-xs font-bold transition-all ${
                        isSelected 
                          ? `${config.bg} ${config.color} shadow-sm` 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title={config.desc}
                    >
                      <Icon className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                      <span className={isSelected ? 'block' : 'hidden md:block'}>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedEntry.goals.length > 0 && (
              <div className="h-6 lg:h-8 w-px bg-memos-border" />
            )}
            <div className="flex flex-col items-end">
              <span className="text-[8px] lg:text-[10px] font-bold text-memos-text-dim uppercase">Progress</span>
              <span className="text-sm lg:text-lg font-bold tabular-nums">
                {selectedEntry.goals?.length 
                  ? Math.round(selectedEntry.goals.reduce((acc, g) => acc + (g.progress || 0), 0) / selectedEntry.goals.length)
                  : 0}%
              </span>
            </div>
            <div className="h-6 lg:h-8 w-px bg-memos-border mx-2" />
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setIsGridView(false)}
                className={`p-1.5 rounded-lg transition-all ${!isGridView ? 'bg-white shadow-sm text-memos-accent' : 'text-gray-400 hover:text-gray-600'}`}
                title="列表视图"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsGridView(true)}
                className={`p-1.5 rounded-lg transition-all ${isGridView ? 'bg-white shadow-sm text-memos-accent' : 'text-gray-400 hover:text-gray-600'}`}
                title="网格视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* New Task Input Area */}
            <div className="bg-white border border-memos-border rounded-xl p-4 shadow-sm focus-within:shadow-md focus-within:border-memos-accent/30 transition-all">
              <textarea
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="记录现在的想法或今日目标..."
                className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-memos-text-main resize-none p-0 h-24 placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    const text = newTaskText.trim();
                    if (text) {
                      setEntries(prev => prev.map(entry => {
                        if (entry.id === selectedEntry.id) {
                          return {
                            ...entry,
                            goals: [...entry.goals, { id: `g-${Date.now()}`, text: text, progress: 0, images: [] }]
                          };
                        }
                        return entry;
                      }));
                      setNewTaskText('');
                    }
                  }
                }}
              />
              <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
                <div className="flex items-center gap-4 text-memos-text-dim">
                  <div className="flex items-center gap-1.5 text-xs hover:text-memos-accent cursor-help transition-colors">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>下方粘贴图片</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Hash className="w-3.5 h-3.5" />
                    <span>目标</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const text = newTaskText.trim();
                    if (text) {
                      setEntries(prev => prev.map(entry => {
                        if (entry.id === selectedEntry.id) {
                          return {
                            ...entry,
                            goals: [...entry.goals, { id: `g-${Date.now()}`, text: text, progress: 0, images: [] }]
                          };
                        }
                        return entry;
                      }));
                      setNewTaskText('');
                    }
                  }}
                  disabled={!newTaskText.trim()}
                  className="px-4 py-1.5 bg-memos-accent text-white text-xs font-bold rounded-lg hover:bg-memos-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  记录 (Ctrl+Enter)
                </button>
              </div>
            </div>

            {selectedEntry.note && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm italic">
                {selectedEntry.note}
              </div>
            )}

            <div className={`grid gap-4 ${isGridView ? 'sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2' : ''} ${isGridView ? 'max-w-none' : 'max-w-3xl mx-auto'}`}>
              <AnimatePresence mode="popLayout">
                {selectedEntry.goals.map((goal) => (
                  <motion.div
                    key={goal.id}
                    layout={!zoomedImage} // Disable layout animation when zooming images to avoid jitter
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`bg-white border border-memos-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group/card relative flex flex-col ${
                      isGridView && editingGoalId !== goal.id && !expandedGoalIds.has(goal.id) ? 'h-[400px]' : ''
                    }`}
                  >
                    {/* Minimal Progress Line at the very top */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-50 overflow-hidden z-20">
                      <motion.div 
                        initial={false}
                        animate={{ width: `${goal.progress}%` }}
                        className="h-full bg-memos-accent opacity-60" 
                      />
                    </div>

                    <div className={`flex-1 flex flex-col ${isGridView ? 'p-3 lg:p-5' : 'p-4 lg:p-8'}`} onPaste={(e) => handlePaste(e, selectedEntry.id, goal.id)}>
                      {/* Header Area - Subtle */}
                      <div className={`flex items-start justify-between ${isGridView ? 'mb-2 lg:mb-3' : 'mb-4 lg:mb-6'}`}>
                        <div className="flex items-center gap-3 group/title flex-1 overflow-hidden">
                          <input 
                            type="text"
                            value={goal.text}
                            onChange={(e) => updateGoalText(selectedEntry.id, goal.id, e.target.value)}
                            className={`${isGridView ? 'text-sm lg:text-lg' : 'text-xl lg:text-3xl'} font-black bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-memos-text-main w-full placeholder:text-gray-200 transition-all focus:pl-1 truncate`}
                            placeholder="输入标题..."
                          />
                        </div>
                        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover/card:opacity-100 transition-all ml-2 scale-75 lg:scale-90 origin-right">
                          <button 
                            onClick={() => setEditingGoalId(editingGoalId === goal.id ? null : goal.id)}
                            className={`p-1.5 rounded-lg transition-colors ${editingGoalId === goal.id ? 'bg-memos-accent text-white' : 'hover:bg-gray-100 text-gray-400'}`}
                          >
                            {editingGoalId === goal.id ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={() => deleteGoal(selectedEntry.id, goal.id)}
                            className={`p-1.5 rounded-lg transition-all flex items-center gap-2 ${confirmDeleteGoalId === goal.id ? 'bg-rose-500 text-white px-2' : 'hover:bg-rose-50 text-gray-300 hover:text-rose-500'}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {confirmDeleteGoalId === goal.id && <span className="text-[9px] font-bold">删除？</span>}
                          </button>
                        </div>
                      </div>

                      {/* Content Area with Expand/Collapse */}
                      <div className={`relative flex-1 transition-all duration-500 ease-in-out overflow-hidden ${
                        editingGoalId === goal.id || expandedGoalIds.has(goal.id)
                          ? 'max-h-[5000px]' 
                          : isGridView ? 'max-h-[220px]' : 'max-h-[320px]'
                      }`}>
                        {editingGoalId === goal.id ? (
                          <div className="space-y-4">
                            <div className="min-h-[400px] w-full bg-gray-50 border border-gray-100 rounded-xl p-4">
                              <TipTapEditor 
                                content={goal.description || ''}
                                onChange={(markdown) => updateGoalDescription(selectedEntry.id, goal.id, markdown)}
                                placeholder="# 开启今日深度记录...\n\n支持粘贴图片、Markdown 语法、代码块等"
                              />
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <span className="text-[10px] font-bold text-memos-text-dim uppercase">Progress: {goal.progress}%</span>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={goal.progress}
                                  onChange={(e) => updateGoalProgress(selectedEntry.id, goal.id, parseInt(e.target.value))}
                                  className="flex-1 h-1 bg-gray-100 rounded-full appearance-none cursor-pointer accent-memos-accent"
                                />
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-memos-text-dim italic">
                                 <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                 <span>实时保存中...</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className={`prose prose-stone max-w-none
                              ${isGridView ? 'prose-xs sm:prose-sm' : 'prose-sm md:prose-base leading-relaxed'}
                              prose-h1:text-2xl prose-h1:font-black prose-h1:pb-2 prose-h1:mb-4
                              prose-h2:text-xl prose-h2:font-extrabold prose-h2:mt-6 prose-h2:mb-3
                              prose-h3:text-lg prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-2
                              prose-p:text-memos-text-main/85 prose-p:mb-3
                              prose-ul:pl-4 prose-ol:pl-4
                              prose-li:my-1
                              prose-blockquote:border-l-4 prose-blockquote:py-0.5 prose-blockquote:px-3
                              prose-pre:p-4 prose-pre:text-xs
                              prose-strong:text-memos-accent prose-img:rounded-xl prose-img:shadow-sm min-h-[60px] cursor-text`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.tagName === 'IMG') {
                                setZoomedImage((target as HTMLImageElement).src);
                              } else {
                                setEditingGoalId(goal.id);
                              }
                            }}
                            dangerouslySetInnerHTML={{ 
                              __html: goal.description 
                                ? md.render(goal.description.replace(/!\[image\]\[(\d+)\]/g, (_, idx) => {
                                    const img = goal.images?.[parseInt(idx)];
                                    return img ? `![image](${img})` : `![image](invalid)`;
                                  })) 
                                : isGridView ? '<div class="py-10 text-center border border-dashed border-gray-100 rounded-2xl"><span class="text-gray-300 italic text-[10px]">点击进行记录...</span></div>' : '<div class="py-20 text-center border border-dashed border-gray-100 rounded-3xl group-hover/card:border-memos-accent/20 transition-all"><span class="text-gray-300 italic text-sm">开始您的深度记录，支持完整 Markdown 语法...</span></div>'
                            }}
                          />
                        )}

                        {/* Image Document Section */}
                        {goal.images && goal.images.length > 0 && (
                          <div className={`${isGridView ? 'mt-4 grid grid-cols-2 gap-2' : 'mt-8 lg:mt-12 space-y-4 lg:space-y-6'}`}>
                            {goal.images.map((img, idx) => (
                              <div key={idx} className="relative group/img rounded-xl overflow-hidden bg-gray-50 ring-1 ring-gray-100 cursor-zoom-in">
                                <img 
                                  src={img} 
                                  alt="" 
                                  className={`w-full h-auto ${isGridView ? 'aspect-video object-cover' : 'max-h-[1000px] object-contain'} mx-auto`}
                                  onClick={() => setZoomedImage(img)}
                                />
                                <button 
                                  onClick={() => removeGoalImage(selectedEntry.id, goal.id, idx)}
                                  className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full lg:opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-md hover:bg-rose-500 scale-75"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Truncation Overlay */}
                        {!expandedGoalIds.has(goal.id) && editingGoalId !== goal.id && ((goal.description?.length || 0) > 100 || (goal.images?.length || 0) > 0) && (
                          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent z-10 pointer-events-none" />
                        )}
                      </div>

                      {/* Expand / Collapse Button */}
                      {editingGoalId !== goal.id && ((goal.description?.length || 0) > 100 || (goal.images?.length || 0) > 0) && (
                        <div className="flex justify-center mt-auto py-1 relative z-20">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGoalExpand(goal.id);
                            }}
                            className="flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100 text-memos-text-dim text-[8px] lg:text-[10px] font-bold rounded-full transition-all border border-gray-100"
                          >
                            {expandedGoalIds.has(goal.id) ? (
                              <>
                                <span>收起</span>
                                <ChevronUp className="w-2.5 h-2.5" />
                              </>
                            ) : (
                              <>
                                <span>展开</span>
                                <ChevronDown className="w-2.5 h-2.5" />
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      
                      <div className={`mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-[8px] text-gray-200 uppercase font-black tracking-widest ${isGridView ? 'opacity-50' : ''}`}>
                        <span>Memo System v2.0</span>
                        <div className="flex items-center gap-1">
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>DOCUMENT</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 lg:p-12 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <motion.button 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              onClick={() => setZoomedImage(null)}
            >
              <X className="w-6 h-6" />
            </motion.button>
            <motion.img 
              layoutId="zoomed-image"
              src={zoomedImage}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date Creation Confirmation Modal */}
      <AnimatePresence>
        {pendingDate && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-memos-border p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4 text-memos-accent">
                <CalendarIcon className="w-6 h-6" />
                <h3 className="text-lg font-bold text-memos-text-main">新增记录？</h3>
              </div>
              <p className="text-sm text-memos-text-dim leading-relaxed mb-6">
                该日期（<span className="font-bold text-memos-text-main">{pendingDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>）目前没有添加目标记录。是否确认创建新记录？
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setPendingDate(null)}
                  className="flex-1 py-2.5 rounded-xl border border-memos-border text-memos-text-dim font-bold text-sm hover:bg-gray-50 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    addDay(pendingDate);
                    setPendingDate(null);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-memos-accent text-white font-bold text-sm shadow-sm shadow-memos-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  确认添加
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
