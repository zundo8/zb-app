"use client";

import { useCallback, useEffect, useState } from "react";
import { 
  Loader2, 
  Plus, 
  RefreshCw, 
  Search, 
  Clock, 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  MoreVertical,
  Trash2,
  Check,
  ChevronRight,
  TrendingUp,
  Target,
  Zap,
  Edit2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";

type TaskType = "MANUAL" | "PRODUCTION";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  createdAt: string;
  type: TaskType;
  batch?: {
    id: string;
    batchCode: string;
    productName: string;
    currentStage: string;
  };
};

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-rose-500/10 text-rose-500 border-rose-500/10",
    MEDIUM: "bg-amber-500/10 text-amber-500 border-amber-500/10",
    LOW: "bg-emerald-500/10 text-emerald-500 border-emerald-500/10",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${colors[priority] || colors.MEDIUM}`}>
      {priority}
    </span>
  );
}

function Timer({ dueDate }: { dueDate: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!dueDate) return;

    const interval = setInterval(() => {
      const now = new Date();
      const target = new Date(dueDate);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("OVERDUE");
        clearInterval(interval);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        setTimeLeft(`${hours}h ${mins}m`);
      }
    }, 60000);

    // Initial run
    const now = new Date();
    const target = new Date(dueDate);
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) {
      setTimeLeft("OVERDUE");
    } else {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else setTimeLeft(`${hours}h ${mins}m`);
    }

    return () => clearInterval(interval);
  }, [dueDate]);

  if (!dueDate) return null;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
      timeLeft === "OVERDUE" ? "bg-rose-500/10 text-rose-500 border-rose-500/10 animate-pulse" : "bg-foreground/5 text-foreground/40 border-foreground/10"
    }`}>
      <Clock className="w-2.5 h-2.5" />
      {timeLeft}
    </div>
  );
}

export default function PendingTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("PENDING");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  
  // Modals state
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as const,
    dueDate: "",
  });

  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/tasks?includeProduction=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mission data fetch failure");
      if (!Array.isArray(data)) throw new Error("Received malformed task matrix");
      setTasks(data);
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const res = await mfgFetch("/api/admin/manufacturing/tasks", {
        method: "POST",
        body: JSON.stringify(newTask),
      });
      if (!res.ok) throw new Error("Failed to create task");
      showToast("Task created successfully");
      setNewOpen(false);
      setNewTask({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const updateTask = async () => {
    if (!editingTask || !editingTask.title.trim()) return;
    try {
      const res = await mfgFetch("/api/admin/manufacturing/tasks", {
        method: "PATCH",
        body: JSON.stringify({
          id: editingTask.id,
          title: editingTask.title,
          description: editingTask.description,
          priority: editingTask.priority,
          dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : null,
          status: editingTask.status
        }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      showToast("Task updated successfully");
      setEditOpen(false);
      setEditingTask(null);
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const updateTaskStatus = async (id: string, status: string) => {
    if (id.startsWith("PROD-")) {
      showToast("Production tasks must be updated via Production Tracker stages", "err");
      return;
    }

    try {
      const res = await mfgFetch("/api/admin/manufacturing/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      showToast(`Task marked as ${status.toLowerCase()}`);
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const deleteTask = async (id: string) => {
    if (id.startsWith("PROD-")) return;
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      showToast("Task deleted");
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(q.toLowerCase()) || 
      t.description?.toLowerCase().includes(q.toLowerCase()) ||
      t.batch?.batchCode.toLowerCase().includes(q.toLowerCase());
    
    const matchesFilter = filter === "ALL" || 
      (filter === "PENDING" && t.status === "PENDING") || 
      (filter === "COMPLETED" && t.status === "COMPLETED");
      
    return matchesSearch && matchesFilter;
  });

  const pendingCount = tasks.filter(t => t.status === "PENDING").length;
  const overdueCount = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status === "PENDING").length;

  const handleEditTask = (task: Task) => {
    if (task.type === "PRODUCTION") {
      showToast("Production tasks cannot be edited directly here.", "err");
      return;
    }
    setEditingTask({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""
    });
    setEditOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-20 space-y-6 relative z-10 overflow-hidden"
    >
      {/* Background Orbs */}
      <div className="absolute -right-24 -top-24 w-96 h-96 bg-foreground/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -left-24 top-1/2 w-72 h-72 bg-foreground/5 blur-3xl rounded-full pointer-events-none" />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-[200] max-w-[90vw] w-max px-4 py-3 rounded-2xl text-[12px] font-bold shadow-2xl flex items-center justify-center gap-2 border backdrop-blur-xl ${
              toast.type === "ok" 
                ? "bg-background/90 text-foreground border-foreground/10" 
                : "bg-rose-500 text-white border-rose-500/20"
            }`}
          >
            {toast.type === "ok" && <Check className="w-4 h-4 text-emerald-500" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 lg:mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 shadow-inner shrink-0">
             <ClipboardList className="w-5 h-5 text-foreground/40" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-foreground tracking-tight leading-none truncate uppercase">
              Pending Tasks
            </h1>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-[0.2em] mt-0.5">
              Operations &middot; {tasks.length} items
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-foreground/[0.08] text-foreground rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:bg-foreground/[0.02] disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>

          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-foreground text-background rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/15"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4">
        <div className="glass-card p-3 lg:p-4 rounded-[1.2rem] border border-foreground/5 flex items-center gap-3 transition-all hover:bg-foreground/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest leading-none mb-1">Active Nodes</div>
            <div className="text-lg font-bold text-foreground tracking-tighter">{pendingCount}</div>
          </div>
        </div>
        <div className="glass-card p-3 lg:p-4 rounded-[1.2rem] border border-foreground/5 flex items-center gap-3 transition-all hover:bg-foreground/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/10">
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest leading-none mb-1">Overdue Spectrum</div>
            <div className="text-lg font-bold text-rose-500 tracking-tighter">{overdueCount}</div>
          </div>
        </div>
        <div className="glass-card p-3 lg:p-4 rounded-[1.2rem] border border-foreground/5 flex items-center gap-3 transition-all hover:bg-foreground/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10">
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest leading-none mb-1">Efficiency Goal</div>
            <div className="text-lg font-bold text-foreground tracking-tighter">94%</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4">
        <div className="glass-card rounded-[1.5rem] border border-foreground/5 p-4 lg:p-5 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/20" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tasks, batches, or descriptions..."
                className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl pl-10 pr-4 py-2 text-[12px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/10 transition-all shadow-inner"
              />
            </div>
            
            <div className="flex gap-2 p-1 bg-foreground/[0.03] rounded-xl border border-foreground/5">
              <button 
                onClick={() => setFilter("ALL")}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filter === "ALL" ? "bg-background text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground"}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter("PENDING")}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filter === "PENDING" ? "bg-background text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground"}`}
              >
                Pending
              </button>
              <button 
                onClick={() => setFilter("COMPLETED")}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filter === "COMPLETED" ? "bg-background text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground"}`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-foreground/10" />
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/20">Synthesizing Task Matrix</span>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-center gap-4 bg-foreground/[0.01] rounded-[2rem] border border-dashed border-foreground/10">
                <ClipboardList className="w-12 h-12 text-foreground/10" />
                <div className="space-y-1">
                  <p className="text-[13px] font-bold text-foreground/40 uppercase tracking-widest">No Active Nodes Found</p>
                  <p className="text-[11px] text-foreground/20 font-medium max-w-xs mx-auto">All systems are operational or no tasks match your search parameters.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => handleEditTask(task)}
                    className={`group relative glass-card p-3 lg:p-4 rounded-[1.2rem] border transition-all duration-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                      task.status === "COMPLETED" 
                        ? "bg-foreground/[0.01] border-foreground/5 opacity-60" 
                        : "bg-background/40 border-foreground/[0.05] hover:border-foreground/15 hover:shadow-xl hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskStatus(task.id, task.status === "PENDING" ? "COMPLETED" : "PENDING");
                        }}
                        disabled={task.type === "PRODUCTION"}
                        className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          task.status === "COMPLETED" 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-foreground/10 hover:border-foreground/40"
                        } ${task.type === "PRODUCTION" ? "opacity-30 cursor-not-allowed" : "cursor-pointer active:scale-90"}`}
                      >
                        {task.status === "COMPLETED" && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </button>
                      
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <PriorityBadge priority={task.priority} />
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            task.type === "PRODUCTION" 
                              ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/10" 
                              : "bg-foreground/5 text-foreground/40 border-foreground/10"
                          }`}>
                            {task.type}
                          </span>
                          <Timer dueDate={task.dueDate} />
                        </div>
                        <h3 className={`text-lg font-bold tracking-tight leading-tight ${task.status === "COMPLETED" ? "line-through text-foreground/40" : "text-foreground"}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-[12px] text-foreground/40 font-medium leading-relaxed max-w-2xl line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        {task.batch && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-foreground/5">
                            <div className="w-5 h-5 rounded-lg bg-foreground/5 flex items-center justify-center border border-foreground/5">
                              <TrendingUp className="w-3 h-3 text-foreground/40" />
                            </div>
                            <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-widest">
                              Batch: {task.batch.batchCode} · {task.batch.currentStage}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center ml-10 sm:ml-0">
                      <div className="flex flex-col items-end mr-4 hidden lg:flex">
                        <div className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">Logged</div>
                        <div className="text-[11px] font-bold text-foreground/60 font-mono">{formatDateTimeIST(task.createdAt).split(',')[0]}</div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {task.type === "MANUAL" && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTask(task.id);
                            }}
                            className="p-2.5 rounded-xl hover:bg-rose-500/10 text-foreground/20 hover:text-rose-500 transition-all active:scale-90"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-3 rounded-xl hover:bg-foreground/5 text-foreground/20 hover:text-foreground transition-all active:scale-90">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Task Overlay */}
      <AnimatePresence>
        {newOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="w-full max-w-lg glass-card rounded-[2.5rem] border border-foreground/10 shadow-3xl p-8 lg:p-10 space-y-8"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">Define Task Node</h2>
                  <p className="text-[12px] text-foreground/40 mt-1 font-medium font-inter">Commit a new operational directive to the system.</p>
                </div>
                <button onClick={() => setNewOpen(false)} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Task Title *</label>
                  <input
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Enter objective title..."
                    className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-foreground/10 transition-all font-medium"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Priority</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 text-sm focus:outline-none shadow-sm appearance-none font-medium text-foreground/80"
                    >
                      <option value="LOW">Low Velocity</option>
                      <option value="MEDIUM">Medium Velocity</option>
                      <option value="HIGH">High Velocity</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Deadline</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" />
                      <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                        className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none font-medium text-foreground/80"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Context / Details</label>
                   <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    placeholder="Provide depth for this mission objective..."
                    rows={4}
                    className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-foreground/10 transition-all font-medium resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setNewOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-foreground/5 text-foreground/60 text-[10px] font-bold uppercase tracking-widest hover:bg-foreground/10 transition-all"
                >
                  Abort
                </button>
                <button
                  onClick={createTask}
                  className="flex-[1.5] py-4 rounded-2xl bg-foreground text-background text-[10px] font-bold uppercase tracking-[0.3em] hover:opacity-90 transition-all shadow-2xl shadow-foreground/20"
                >
                  Log Directive
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Task Overlay */}
      <AnimatePresence>
        {editOpen && editingTask && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="w-full max-w-lg glass-card rounded-[2.5rem] border border-foreground/10 shadow-3xl p-8 lg:p-10 space-y-8"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">Update Directive</h2>
                  <p className="text-[12px] text-foreground/40 mt-1 font-medium font-inter">Modify the operational parameters of this node.</p>
                </div>
                <button onClick={() => { setEditOpen(false); setEditingTask(null); }} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Task Title *</label>
                  <input
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                    placeholder="Enter objective title..."
                    className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-foreground/10 transition-all font-medium"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Priority</label>
                    <select
                      value={editingTask.priority}
                      onChange={(e) => setEditingTask({...editingTask, priority: e.target.value as any})}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 text-sm focus:outline-none shadow-sm appearance-none font-medium text-foreground/80"
                    >
                      <option value="LOW">Low Velocity</option>
                      <option value="MEDIUM">Medium Velocity</option>
                      <option value="HIGH">High Velocity</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Deadline</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" />
                      <input
                        type="date"
                        value={editingTask.dueDate || ""}
                        onChange={(e) => setEditingTask({...editingTask, dueDate: e.target.value})}
                        className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none font-medium text-foreground/80"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Status</label>
                    <select
                      value={editingTask.status}
                      onChange={(e) => setEditingTask({...editingTask, status: e.target.value})}
                      className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-3.5 text-sm focus:outline-none shadow-sm appearance-none font-medium text-foreground/80"
                    >
                      <option value="PENDING">Active (Pending)</option>
                      <option value="COMPLETED">Decommissioned (Completed)</option>
                    </select>
                  </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Context / Details</label>
                   <textarea
                    value={editingTask.description || ""}
                    onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                    placeholder="Provide depth for this mission objective..."
                    rows={4}
                    className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-foreground/10 transition-all font-medium resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => { setEditOpen(false); setEditingTask(null); }}
                  className="flex-1 py-4 rounded-2xl bg-foreground/5 text-foreground/60 text-[10px] font-bold uppercase tracking-widest hover:bg-foreground/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={updateTask}
                  className="flex-[1.5] py-4 rounded-2xl bg-foreground text-background text-[10px] font-bold uppercase tracking-[0.3em] hover:opacity-90 transition-all shadow-2xl shadow-foreground/20"
                >
                  Update Node
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
