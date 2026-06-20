"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
  X,
  Link2,
  FolderOpen,
  FileText,
  Users,
  Activity,
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  Beaker,
  Award,
  AlertOctagon,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  Upload,
  Filter,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";
import WorkDriveGallery from "@/components/workdrive/WorkDriveGallery";
import { supabase } from "@/lib/supabase";

type TaskType = "MANUAL" | "PRODUCTION" | "VENDOR_SELECTION" | "VENDOR_SEARCH" | "DESIGN_SELECTION" | "DESIGN_APPROVAL";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  createdAt: string;
  type: TaskType;
  batchId?: string | null;
  batch?: {
    id: string;
    batchCode: string;
    productName: string;
    currentStage: string;
    quantity: number;
  } | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  workdriveUrl?: string | null;
  workdriveFolderId?: string | null;
  approvalStatus?: string | null;
  designName?: string | null;
  designImage?: string | null;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
};

const STAGE_ICONS: Record<string, any> = {
  READY_FOR_PRODUCTION: ClipboardList,
  IN_PRODUCTION_CUTTING: Scissors,
  IN_PRODUCTION_STITCHING: Shirt,
  SENT_PRINTING: Target,
  SENT_EMBROIDERY: Sparkles,
  SENT_WASH: Waves,
  RETURNED_COMBINED: CheckCircle2,
  SENT_SAMPLE: Beaker,
  QC_PASSED: Award,
  REJECTED_REWORK: AlertOctagon,
};

const MFG_STAGE_LABEL: Record<string, string> = {
  READY_FOR_PRODUCTION: "Ready",
  IN_PRODUCTION_CUTTING: "Cutting",
  IN_PRODUCTION_STITCHING: "Stitching",
  SENT_PRINTING: "Printing",
  SENT_EMBROIDERY: "Embroidery",
  SENT_WASH: "Washing",
  RETURNED_COMBINED: "Returned",
  SENT_SAMPLE: "Sampling",
  QC_PASSED: "QC Passed",
  REJECTED_REWORK: "Rework",
};

function actionsForBatch(currentStage: string, sampleDone: boolean = false, cuttingDone: boolean = false, stitchingDone: boolean = false): { key: string; label: string }[] {
  if (!sampleDone && !cuttingDone && currentStage === "READY_FOR_PRODUCTION") {
    return [
      { key: "MARK_SAMPLE", label: "Mark as Sample" },
      { key: "START_CUTTING", label: "Start Cutting (Production)" },
    ];
  }
  if (currentStage === "SENT_SAMPLE") {
    return [
      { key: "QC_PASS", label: "Approve Sample" },
      { key: "QC_REJECT", label: "Reject Sample" },
    ];
  }
  switch (currentStage) {
    case "READY_FOR_PRODUCTION":
      return [{ key: "START_CUTTING", label: "Start Cutting" }];
    case "IN_PRODUCTION_CUTTING":
      return [
        { key: "SEND_STITCHING", label: "Send to Stitching" },
        { key: "SEND_PRINTING", label: "Send to Printing" },
        { key: "SEND_EMBROIDERY", label: "Send to Embroidery" },
        { key: "SEND_WASH", label: "Send to Wash" },
        { key: "QC_PASS", label: "Final QC Pass" },
      ];
    case "IN_PRODUCTION_STITCHING":
      return [
        { key: "RETURN_STITCHING", label: "Return from Stitching" },
        { key: "QC_PASS", label: "Final QC Pass" },
      ];
    case "SENT_PRINTING":
      return [{ key: "RETURN_PRINTING", label: "Return from Printing" }];
    case "SENT_EMBROIDERY":
      return [{ key: "RETURN_EMBROIDERY", label: "Return from Embroidery" }];
    case "SENT_WASH":
      return [{ key: "RETURN_WASH", label: "Return from Wash" }];
    case "RETURNED_COMBINED":
      return [
        { key: "SEND_STITCHING", label: "Send to Stitching" },
        { key: "QC_PASS", label: "Final QC Pass" }
      ];
    default:
      return [];
  }
}

// ─── Sub-Components ───────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-rose-500/10 text-rose-400 border-rose-500/15",
    MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/15",
    LOW: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${colors[priority] || colors.MEDIUM}`}>
      {priority === "HIGH" ? "Urgent" : priority === "LOW" ? "Low" : "Normal"}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-400",
    COMPLETED: "bg-emerald-400",
    IN_PROGRESS: "bg-blue-400",
  };
  return <div className={`w-1.5 h-1.5 rounded-full ${colors[status] || colors.PENDING} animate-pulse`} />;
}

function TaskTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    PRODUCTION: "bg-indigo-500/10 text-indigo-400 border-indigo-500/15",
    DESIGN_APPROVAL: "bg-purple-500/10 text-purple-400 border-purple-500/15",
    DESIGN_SELECTION: "bg-purple-500/10 text-purple-400 border-purple-500/15",
    VENDOR_SELECTION: "bg-amber-500/10 text-amber-400 border-amber-500/15",
    VENDOR_SEARCH: "bg-amber-500/10 text-amber-400 border-amber-500/15",
    MANUAL: "bg-foreground/5 text-foreground/40 border-foreground/10",
  };
  const labels: Record<string, string> = {
    PRODUCTION: "Production",
    DESIGN_APPROVAL: "Design Approval",
    DESIGN_SELECTION: "Design",
    VENDOR_SELECTION: "Vendor",
    VENDOR_SEARCH: "Vendor Search",
    MANUAL: "Manual",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${styles[type] || styles.MANUAL}`}>
      {labels[type] || type}
    </span>
  );
}

function TimeRemaining({ dueDate }: { dueDate: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!dueDate) return;
    const calc = () => {
      const now = new Date();
      const target = new Date(dueDate);
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft("OVERDUE"); setIsOverdue(true); return; }
      setIsOverdue(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else setTimeLeft(`${hours}h ${mins}m`);
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [dueDate]);

  if (!dueDate) return null;

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
      isOverdue ? "bg-rose-500/10 text-rose-400 border-rose-500/15 animate-pulse" : "bg-foreground/5 text-foreground/40 border-foreground/10"
    }`}>
      <Clock className="w-2.5 h-2.5" />
      {timeLeft}
    </div>
  );
}

// ─── STATUS COLUMNS ───────────────────────────
const STATUS_COLUMNS = [
  { key: "PENDING", label: "To Do", icon: ClipboardList, color: "text-amber-400" },
  { key: "IN_PROGRESS", label: "In Progress", icon: Activity, color: "text-blue-400" },
  { key: "COMPLETED", label: "Done", icon: CheckCircle2, color: "text-emerald-400" },
] as const;

// ─── MAIN PAGE ────────────────────────────────

export default function PendingTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "due">("priority");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Modals / Drawers state
  const [newOpen, setNewOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [prodDrawerOpen, setProdDrawerOpen] = useState(false);
  const [linkingFolder, setLinkingFolder] = useState(false);

  // Production Action inputs
  const [selectedProdTask, setSelectedProdTask] = useState<Task | null>(null);
  const [prodActionLoading, setProdActionLoading] = useState(false);
  const [actionForm, setActionForm] = useState({
    action: "",
    quantity: "",
    vendor: "",
    notes: "",
    totalCharges: "",
  });

  // Workflow transition
  const [selectedWorkflowTask, setSelectedWorkflowTask] = useState<Task | null>(null);
  const [workflowActionType, setWorkflowActionType] = useState<"PRODUCTION" | "VENDOR_SELECTION" | null>(null);
  const [workflowQuantity, setWorkflowQuantity] = useState("100");
  const [workflowLoading, setWorkflowLoading] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as const,
    dueDate: "",
    type: "MANUAL" as TaskType,
    assignedToId: "",
    workdriveUrl: "",
    workdriveFolderId: "",
    designName: "",
    designImage: "",
  });

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/tasks?includeProduction=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tasks");
      if (!Array.isArray(data)) throw new Error("Received malformed task matrix");
      setTasks(data);
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/users/list");
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
      }
    } catch (e: any) {
      console.error("Failed to load assignees:", e.message);
    }
  };

  useEffect(() => {
    loadTasks();
    loadAdminUsers();
  }, [loadTasks]);

  // ─── CRUD ─────────────────────────────────
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
      setNewTask({
        title: "", description: "", priority: "MEDIUM", dueDate: "", type: "MANUAL",
        assignedToId: "", workdriveUrl: "", workdriveFolderId: "", designName: "", designImage: "",
      });
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const updateTaskStatus = async (id: string, status: string) => {
    if (id.startsWith("PROD-")) {
      const taskObj = tasks.find(t => t.id === id);
      if (taskObj) {
        setSelectedProdTask(taskObj);
        setActionForm({ action: "", quantity: "", vendor: "", notes: "", totalCharges: "" });
        setProdDrawerOpen(true);
      }
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
    if (!confirm("Delete this task?")) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      showToast("Task deleted");
      if (detailTask?.id === id) setDetailTask(null);
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  const handleProductionAction = async () => {
    if (!selectedProdTask || !selectedProdTask.batch || !actionForm.action) return;
    setProdActionLoading(true);
    const batchId = selectedProdTask.batch.id;
    try {
      const body = {
        action: actionForm.action,
        quantity: actionForm.quantity ? Number(actionForm.quantity) : undefined,
        vendor: actionForm.vendor || undefined,
        vendorName: actionForm.vendor || undefined,
        remarks: actionForm.notes || undefined,
        notes: actionForm.notes || undefined,
        costAmount: actionForm.totalCharges ? Number(actionForm.totalCharges) : undefined,
      };
      const res = await mfgFetch(`/api/admin/manufacturing/batches/${batchId}/action`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Failed to update production stage");
      }
      showToast("Production stage advanced");
      setProdDrawerOpen(false);
      setSelectedProdTask(null);
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setProdActionLoading(false);
    }
  };

  const handleWorkflowTransition = async () => {
    if (!selectedWorkflowTask || !workflowActionType) return;
    setWorkflowLoading(true);
    try {
      const transitionType = workflowActionType === "PRODUCTION" ? "SEND_TO_PRODUCTION" : "SEND_TO_VENDOR_SELECTION";
      const res = await mfgFetch("/api/admin/manufacturing/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: selectedWorkflowTask.id, transition: transitionType, quantity: workflowQuantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Workflow transition failed");
      showToast(data.message || "Process updated");
      setSelectedWorkflowTask(null);
      setWorkflowActionType(null);
      loadTasks();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setWorkflowLoading(false);
    }
  };

  const linkWorkDriveFolder = async (taskId: string) => {
    setLinkingFolder(true);
    try {
      const folderRes = await fetch("/api/workdrive/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Task-${taskId}`,
        }),
      });
      if (!folderRes.ok) throw new Error("Failed to create folder");
      const folder = await folderRes.json();
      if (folder.error) throw new Error(folder.error);

      const teamId = process.env.ZOHO_WD_TEAM_ID || "";
      const wsId = process.env.ZOHO_WD_WORKSPACE_ID || "";
      const folderUrl = `https://workdrive.zoho.in/${teamId}/ws/${wsId}/folders/${folder.folderId}`;

      // Update task with folder ID
      const { error: dbErr } = await supabase
        .from("pending_tasks")
        .update({
          workdrive_folder_id: folder.folderId,
          workdrive_folder_name: folder.folderName,
          workdrive_url: folderUrl,
        })
        .eq("id", taskId);

      if (dbErr) throw dbErr;

      showToast("WorkDrive folder linked");
      loadTasks();
      if (detailTask?.id === taskId) {
        setDetailTask(prev => prev ? { ...prev, workdriveFolderId: folder.folderId, workdriveUrl: folderUrl } : null);
      }
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLinkingFolder(false);
    }
  };

  // ─── Filtering & Sorting ──────────────────
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(q.toLowerCase()) ||
      t.description?.toLowerCase().includes(q.toLowerCase()) ||
      t.batch?.batchCode.toLowerCase().includes(q.toLowerCase()) ||
      t.designName?.toLowerCase().includes(q.toLowerCase());
    const matchesStatus = statusFilter === "ALL" ||
      (statusFilter === "PENDING" && t.status === "PENDING") ||
      (statusFilter === "COMPLETED" && t.status === "COMPLETED") ||
      (statusFilter === "IN_PROGRESS" && t.status === "IN_PROGRESS");
    const matchesType = typeFilter === "ALL" || t.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "priority") {
      const ps: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (ps[b.priority] !== ps[a.priority]) return ps[b.priority] - ps[a.priority];
    }
    if (sortBy === "due") {
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && !b.dueDate) return -1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const kanbanTasks = (status: string) => sortedTasks.filter(t =>
    status === "PENDING" ? t.status === "PENDING" :
    status === "COMPLETED" ? t.status === "COMPLETED" :
    t.status === "IN_PROGRESS"
  );

  const pendingCount = tasks.filter(t => t.status === "PENDING").length;
  const overdueCount = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status === "PENDING").length;

  // ─── RENDER ─────────────────────────────────
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

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-1">
        <div className="glass-card p-3 lg:p-4 rounded-[1.2rem] border border-foreground/5 flex items-center gap-3 transition-all hover:bg-foreground/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest leading-none mb-1">Active</div>
            <div className="text-lg font-bold text-foreground tracking-tighter">{pendingCount}</div>
          </div>
        </div>
        <div className="glass-card p-3 lg:p-4 rounded-[1.2rem] border border-foreground/5 flex items-center gap-3 transition-all hover:bg-foreground/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/10">
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest leading-none mb-1">Overdue</div>
            <div className="text-lg font-bold text-rose-500 tracking-tighter">{overdueCount}</div>
          </div>
        </div>
        <div className="glass-card p-3 lg:p-4 rounded-[1.2rem] border border-foreground/5 flex items-center gap-3 transition-all hover:bg-foreground/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10">
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest leading-none mb-1">Assigned</div>
            <div className="text-lg font-bold text-foreground tracking-tighter">
              {tasks.filter(t => t.assignedToId && t.status === "PENDING").length}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-1 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="relative w-full md:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/20" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, batches, designs..."
              className="w-full bg-foreground/[0.03] border border-foreground/5 rounded-xl pl-10 pr-4 py-2 text-[12px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/10 transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-foreground/[0.03] border border-foreground/5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/60 focus:outline-none"
            >
              <option value="ALL" className="bg-[#0e0e0e] text-foreground">All Types</option>
              <option value="MANUAL" className="bg-[#0e0e0e] text-foreground">Manual</option>
              <option value="PRODUCTION" className="bg-[#0e0e0e] text-foreground">Production</option>
              <option value="DESIGN_SELECTION" className="bg-[#0e0e0e] text-foreground">Design</option>
              <option value="DESIGN_APPROVAL" className="bg-[#0e0e0e] text-foreground">Approval</option>
              <option value="VENDOR_SELECTION" className="bg-[#0e0e0e] text-foreground">Vendor</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-foreground/[0.03] border border-foreground/5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/60 focus:outline-none"
            >
              <option value="priority" className="bg-[#0e0e0e] text-foreground">Sort: Priority</option>
              <option value="date" className="bg-[#0e0e0e] text-foreground">Sort: Created</option>
              <option value="due" className="bg-[#0e0e0e] text-foreground">Sort: Due Date</option>
            </select>

            <div className="flex gap-1 p-1 bg-foreground/[0.03] rounded-xl border border-foreground/5">
              {["ALL", "PENDING", "COMPLETED"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-foreground/40 hover:text-foreground"
                  }`}
                >
                  {s === "ALL" ? "All" : s === "PENDING" ? "Active" : "Done"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kanban / Card Layout */}
      <div className="px-1">
        {loading && tasks.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-foreground/10" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/20">Loading tasks</span>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center gap-4 bg-foreground/[0.01] rounded-[2rem] border border-dashed border-foreground/10">
            <ClipboardList className="w-12 h-12 text-foreground/10" />
            <div className="space-y-1">
              <p className="text-[13px] font-bold text-foreground/40 uppercase tracking-widest">No Tasks Found</p>
              <p className="text-[11px] text-foreground/20 font-medium max-w-xs mx-auto">All systems are operational or no tasks match your filters.</p>
            </div>
          </div>
        ) : statusFilter === "ALL" ? (
          /* Kanban view when "All" is selected */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {STATUS_COLUMNS.map(col => {
              const colTasks = kanbanTasks(col.key);
              const ColIcon = col.icon;
              return (
                <div key={col.key} className="min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <ColIcon className={`w-4 h-4 ${col.color}`} />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/50">{col.label}</h3>
                    <span className="text-[10px] font-mono text-foreground/30 ml-auto">{colTasks.length}</span>
                  </div>
                  <div className="space-y-3">
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggleStatus={updateTaskStatus}
                        onDelete={deleteTask}
                        onOpen={setDetailTask}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="py-8 flex flex-col items-center text-center rounded-2xl border border-dashed border-foreground/5">
                        <p className="text-[10px] text-foreground/20 font-medium">No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Filtered list view */
          <div className="space-y-3">
            {sortedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleStatus={updateTaskStatus}
                onDelete={deleteTask}
                onOpen={setDetailTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Detail Slide-Over Panel ─── */}
      <AnimatePresence>
        {detailTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailTask(null)}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-[600px] bg-background border-l border-foreground/10 z-[101] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Detail Header */}
              <div className="flex items-center justify-between p-5 border-b border-foreground/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={detailTask.priority} />
                    <TaskTypeBadge type={detailTask.type} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {detailTask.type !== "PRODUCTION" && (
                    <button
                      onClick={() => deleteTask(detailTask.id)}
                      className="p-2 rounded-lg text-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setDetailTask(null)}
                    className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight leading-tight">
                    {detailTask.title}
                  </h2>
                  {detailTask.description && (
                    <p className="text-[13px] text-foreground/50 mt-2 leading-relaxed">{detailTask.description}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-foreground/[0.02] rounded-xl p-3 border border-foreground/5">
                    <div className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      <StatusDot status={detailTask.status} />
                      <span className="text-[12px] font-bold text-foreground">{detailTask.status}</span>
                    </div>
                  </div>
                  <div className="bg-foreground/[0.02] rounded-xl p-3 border border-foreground/5">
                    <div className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest mb-1">Due</div>
                    <span className="text-[12px] font-bold text-foreground">
                      {detailTask.dueDate ? formatDateTimeIST(detailTask.dueDate).split(",")[0] : "No due date"}
                    </span>
                  </div>
                  {detailTask.assignedTo && (
                    <div className="bg-foreground/[0.02] rounded-xl p-3 border border-foreground/5">
                      <div className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest mb-1">Assigned</div>
                      <span className="text-[12px] font-bold text-foreground">
                        {detailTask.assignedTo.name || detailTask.assignedTo.email.split("@")[0]}
                      </span>
                    </div>
                  )}
                  {detailTask.batch && (
                    <div className="bg-foreground/[0.02] rounded-xl p-3 border border-foreground/5">
                      <div className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest mb-1">Batch</div>
                      <span className="text-[12px] font-bold text-foreground font-mono">{detailTask.batch.batchCode}</span>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                {detailTask.status === "PENDING" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateTaskStatus(detailTask.id, "COMPLETED")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                    >
                      <Check className="w-3 h-3" />
                      Complete
                    </button>
                    {detailTask.type === "DESIGN_APPROVAL" && (
                      <>
                        <button
                          onClick={async () => {
                            const res = await mfgFetch("/api/admin/manufacturing/tasks", {
                              method: "PATCH",
                              body: JSON.stringify({ id: detailTask.id, approvalStatus: "APPROVED" }),
                            });
                            if (res.ok) { showToast("Design approved"); loadTasks(); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                        >
                          Approve Design
                        </button>
                        <button
                          onClick={async () => {
                            const res = await mfgFetch("/api/admin/manufacturing/tasks", {
                              method: "PATCH",
                              body: JSON.stringify({ id: detailTask.id, approvalStatus: "REJECTED" }),
                            });
                            if (res.ok) { showToast("Design rejected"); loadTasks(); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {((detailTask.type === "DESIGN_APPROVAL" && detailTask.approvalStatus === "APPROVED") || detailTask.type === "DESIGN_SELECTION") && (
                      <>
                        <button
                          onClick={() => { setSelectedWorkflowTask(detailTask); setWorkflowActionType("PRODUCTION"); setWorkflowQuantity("100"); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          <Activity className="w-3 h-3" />
                          To Production
                        </button>
                        <button
                          onClick={() => { setSelectedWorkflowTask(detailTask); setWorkflowActionType("VENDOR_SELECTION"); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-foreground/10 text-foreground/80 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:text-foreground"
                        >
                          <Users className="w-3 h-3" />
                          To Vendor
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* WorkDrive Gallery Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/50">
                      Images & Files
                    </h3>
                    {!detailTask.workdriveFolderId && (
                      <button
                        onClick={() => linkWorkDriveFolder(detailTask.id)}
                        disabled={linkingFolder}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/5 border border-foreground/10 text-foreground/60 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-foreground/10 transition-all disabled:opacity-50"
                      >
                        {linkingFolder ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
                        Link WorkDrive Folder
                      </button>
                    )}
                  </div>
                  <WorkDriveGallery
                    folderId={detailTask.workdriveFolderId || null}
                    folderName={detailTask.title}
                    allowUpload={true}
                  />
                  {detailTask.workdriveUrl && (
                    <a
                      href={detailTask.workdriveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-colors"
                    >
                      <Link2 className="w-3 h-3" />
                      Open in WorkDrive
                    </a>
                  )}
                </div>

                {/* Activity / Created */}
                <div className="pt-4 border-t border-foreground/5">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/50 mb-2">Activity</h3>
                  <div className="text-[11px] text-foreground/40 font-medium">
                    Created {formatDateTimeIST(detailTask.createdAt)}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── New Task Modal ─── */}
      <AnimatePresence>
        {newOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-6 bg-background/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg glass-card rounded-[2.5rem] border border-foreground/10 shadow-3xl p-8 max-h-[92vh] overflow-y-auto space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">New Task</h2>
                  <p className="text-[11px] text-foreground/40 mt-1 font-medium">Create a new operational task.</p>
                </div>
                <button onClick={() => setNewOpen(false)} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Task Type</label>
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask(prev => ({ ...prev, type: e.target.value as TaskType }))}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
                  >
                    <option value="MANUAL">Manual Task</option>
                    <option value="DESIGN_SELECTION">Design Selection</option>
                    <option value="DESIGN_APPROVAL">Design Approval</option>
                    <option value="VENDOR_SELECTION">Vendor Selection</option>
                    <option value="VENDOR_SEARCH">Vendor Search</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Title *</label>
                  <input
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Task title"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task details..."
                    rows={3}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30 shadow-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Priority</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Normal</option>
                      <option value="HIGH">Urgent</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Due Date</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Assign To</label>
                  <select
                    value={newTask.assignedToId}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assignedToId: e.target.value }))}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30 shadow-sm"
                  >
                    <option value="">Unassigned</option>
                    {adminUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>

                {(newTask.type === "DESIGN_SELECTION" || newTask.type === "DESIGN_APPROVAL") && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Design Name</label>
                    <input
                      value={newTask.designName}
                      onChange={(e) => setNewTask(prev => ({ ...prev, designName: e.target.value }))}
                      placeholder="e.g. Summer Crop Top v2"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30 shadow-sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setNewOpen(false)}
                  className="flex-1 px-4 py-3 bg-background border border-foreground/10 text-foreground/60 rounded-2xl text-[11px] font-bold uppercase tracking-wider hover:bg-foreground/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  disabled={!newTask.title.trim()}
                  className="flex-1 px-4 py-3 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-wider hover:opacity-90 shadow-lg disabled:opacity-40 transition-all"
                >
                  Create Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Production Action Modal ─── */}
      <AnimatePresence>
        {prodDrawerOpen && selectedProdTask && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-[2rem] border border-foreground/10 shadow-3xl p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Production Action</h2>
                  <p className="text-[11px] text-foreground/40 mt-0.5">{selectedProdTask.batch?.batchCode} — {selectedProdTask.batch?.productName}</p>
                </div>
                <button onClick={() => { setProdDrawerOpen(false); setSelectedProdTask(null); }} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <select
                  value={actionForm.action}
                  onChange={(e) => setActionForm(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30"
                >
                  <option value="">Select Action</option>
                  {selectedProdTask.batch && actionsForBatch(selectedProdTask.batch.currentStage).map(act => (
                    <option key={act.key} value={act.key}>{act.label}</option>
                  ))}
                </select>

                <input
                  value={actionForm.quantity}
                  onChange={(e) => setActionForm(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Quantity"
                  type="number"
                  className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30"
                />

                <input
                  value={actionForm.vendor}
                  onChange={(e) => setActionForm(prev => ({ ...prev, vendor: e.target.value }))}
                  placeholder="Vendor name (optional)"
                  className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30"
                />

                <input
                  value={actionForm.totalCharges}
                  onChange={(e) => setActionForm(prev => ({ ...prev, totalCharges: e.target.value }))}
                  placeholder="Total charges (₹)"
                  type="number"
                  className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30"
                />

                <textarea
                  value={actionForm.notes}
                  onChange={(e) => setActionForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes..."
                  rows={2}
                  className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30 resize-none"
                />
              </div>

              <button
                onClick={handleProductionAction}
                disabled={!actionForm.action || prodActionLoading}
                className="w-full px-4 py-3 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-wider hover:opacity-90 shadow-lg disabled:opacity-40 transition-all"
              >
                {prodActionLoading ? "Processing..." : "Execute Action"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Workflow Transition Modal ─── */}
      <AnimatePresence>
        {selectedWorkflowTask && workflowActionType && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-card rounded-[2rem] border border-foreground/10 shadow-3xl p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">
                    {workflowActionType === "PRODUCTION" ? "Send to Production" : "Forward to Vendor Selection"}
                  </h2>
                  <p className="text-[11px] text-foreground/40 mt-0.5">{selectedWorkflowTask.designName || selectedWorkflowTask.title}</p>
                </div>
                <button onClick={() => { setSelectedWorkflowTask(null); setWorkflowActionType(null); }} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {workflowActionType === "PRODUCTION" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 ml-1">Production Quantity</label>
                  <input
                    value={workflowQuantity}
                    onChange={(e) => setWorkflowQuantity(e.target.value)}
                    type="number"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-foreground/30"
                  />
                </div>
              )}

              <button
                onClick={handleWorkflowTransition}
                disabled={workflowLoading}
                className="w-full px-4 py-3 bg-foreground text-background rounded-2xl text-[11px] font-bold uppercase tracking-wider hover:opacity-90 shadow-lg disabled:opacity-40 transition-all"
              >
                {workflowLoading ? "Processing..." : "Confirm"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Task Card Component ──────────────────────

function TaskCard({
  task,
  onToggleStatus,
  onDelete,
  onOpen,
}: {
  task: Task;
  onToggleStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onOpen: (task: Task) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onOpen(task)}
      className={`group relative glass-card p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
        task.status === "COMPLETED"
          ? "bg-foreground/[0.01] border-foreground/5 opacity-60"
          : "bg-background/40 border-foreground/[0.06] hover:border-foreground/15 hover:shadow-xl"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task.id, task.status === "PENDING" ? "COMPLETED" : "PENDING");
          }}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90 ${
            task.status === "COMPLETED"
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-foreground/15 hover:border-foreground/40"
          }`}
        >
          {task.status === "COMPLETED" && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            <TaskTypeBadge type={task.type} />
            <TimeRemaining dueDate={task.dueDate} />
            {task.assignedTo && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-foreground/40 border border-foreground/5 ml-auto">
                <Users className="w-2.5 h-2.5" />
                {task.assignedTo.name || task.assignedTo.email.split("@")[0]}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className={`text-[14px] font-bold tracking-tight leading-snug ${
            task.status === "COMPLETED" ? "line-through text-foreground/40" : "text-foreground"
          }`}>
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <p className="text-[11px] text-foreground/35 font-medium leading-relaxed line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Compact WorkDrive Gallery Strip */}
          {task.workdriveFolderId && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <WorkDriveGallery
                folderId={task.workdriveFolderId}
                compact
                allowUpload={false}
              />
            </div>
          )}

          {/* Design / Batch info */}
          {(task.designName || task.batch) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {task.designName && (
                <span className="text-[10px] font-bold text-foreground/40">
                  Design: <strong className="text-foreground/60">{task.designName}</strong>
                </span>
              )}
              {task.batch && (
                <span className="text-[10px] font-mono text-foreground/30">
                  {task.batch.batchCode} · {MFG_STAGE_LABEL[task.batch.currentStage] || task.batch.currentStage}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {task.workdriveFolderId && (
            <a
              href={task.workdriveUrl || "#"}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg text-foreground/20 hover:text-indigo-400 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </a>
          )}
          <ChevronRight className="w-4 h-4 text-foreground/15 group-hover:text-foreground/40 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}
