"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Clock,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Calendar,
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
  Building2,
  Palette,
  DollarSign,
  Plus,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mfgFetch } from "@/lib/manufacturing/mfg-fetch";
import { formatDateTimeIST } from "@/lib/manufacturing/ist";
import { formatInr } from "@/lib/manufacturing/inr";
import WorkDriveGallery from "@/components/workdrive/WorkDriveGallery";

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
    isCuttingDone: boolean;
    isStitchingDone: boolean;
    isEmbroideryDone: boolean;
    isPrintingDone: boolean;
    isWashingDone: boolean;
    isSampleDone: boolean;
    stageLogs: Array<{
      id: string;
      action: string;
      fromStage: string | null;
      toStage: string | null;
      costAmount: number;
      createdByName: string;
      createdAt: string;
      payload: any;
    }>;
    batchNotes: Array<{
      id: string;
      content: string;
      createdByName: string;
      createdAt: string;
    }>;
    movements: Array<{
      id: string;
      type: string;
      quantity: number;
      quantityUnit: string;
      rateAtMovement: number;
      totalValue: number;
      remarks: string | null;
      occurredAt: string;
    }>;
    miscExpenses: Array<{
      id: string;
      amount: number;
      description: string;
      expenseType: string;
      expenseDate: string;
      createdByName: string;
    }>;
    fabricId?: string | null;
    fabric?: {
      id: string;
      sku: string;
      name: string;
      costPerMeter: number;
    } | null;
    workdriveFolderId?: string | null;
    workdriveUrl?: string | null;
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

type Vendor = {
  id: string;
  name: string;
  category: string;
  contactPerson: string | null;
  mobile: string | null;
  email: string | null;
  pricingNotes: string | null;
  leadTimeDays: number | null;
  remarks: string | null;
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

function actionsForBatch(currentStage: string, sampleDone = false, cuttingDone = false, stitchingDone = false): { key: string; label: string }[] {
  if (!sampleDone && !cuttingDone && currentStage === "READY_FOR_PRODUCTION") {
    return [
      { key: "MARK_SAMPLE", label: "Mark as Sample" },
      { key: "START_CUTTING", label: "Start Cutting (Production)" },
    ];
  }
  if (currentStage === "SENT_SAMPLE") {
    return [
      { key: "QC_PASS", label: "Approve Sample (Ready)" },
      { key: "QC_REJECT", label: "Reject Sample (Rework)" },
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
    case "REJECTED_REWORK":
      return [
        { key: "START_CUTTING", label: "Restart Cutting" },
        { key: "SEND_STITCHING", label: "Send to Stitching" }
      ];
    default:
      return [];
  }
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Edit forms
  const [editMode, setEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDesc, setEditedDesc] = useState("");
  const [editedPriority, setEditedPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [editedDueDate, setEditedDueDate] = useState("");
  const [editedAssignee, setEditedAssignee] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Batch actions state
  const [executingAction, setExecutingAction] = useState(false);
  const [actionForm, setActionForm] = useState({
    action: "",
    quantity: "",
    vendor: "",
    notes: "",
    totalCharges: "",
  });

  // Notes & Expenses inputs
  const [noteContent, setNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    expenseType: "OTHER",
    expenseDate: new Date().toISOString().split("T")[0],
  });
  const [addingExpense, setAddingExpense] = useState(false);

  // Workflow modals
  const [prodWorkflowOpen, setProdWorkflowOpen] = useState(false);
  const [prodQty, setProdQty] = useState("100");
  const [workflowLoading, setWorkflowLoading] = useState(false);

  const [linkingFolder, setLinkingFolder] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTaskData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load task details");
      setTask(data);

      // Populate edit states
      setEditedTitle(data.title || "");
      setEditedDesc(data.description || "");
      setEditedPriority(data.priority || "MEDIUM");
      setEditedDueDate(data.dueDate ? new Date(data.dueDate).toISOString().split("T")[0] : "");
      setEditedAssignee(data.assignedToId || "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const loadVendors = async () => {
    try {
      const res = await mfgFetch("/api/admin/manufacturing/vendors");
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (e: any) {
      console.error("Failed to load vendors:", e.message);
    }
  };

  useEffect(() => {
    if (id) {
      loadTaskData();
      loadAdminUsers();
      loadVendors();
    }
  }, [id, loadTaskData]);

  // Save manual task edits
  const saveTaskEdits = async () => {
    if (id.startsWith("PROD-")) return;
    setSavingTask(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editedTitle,
          description: editedDesc,
          priority: editedPriority,
          dueDate: editedDueDate || null,
          assignedToId: editedAssignee || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save edits");
      showToast("Changes saved successfully");
      setEditMode(false);
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSavingTask(false);
    }
  };

  // Toggle general task status
  const updateTaskStatus = async (status: string) => {
    if (id.startsWith("PROD-")) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      showToast(`Task marked as ${status.toLowerCase()}`);
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  // Delete manual task
  const deleteTask = async () => {
    if (id.startsWith("PROD-")) return;
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      showToast("Task deleted");
      router.push("/dashboard/manufacturing/tasks");
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  // Execute Production Batch Step Action
  const executeBatchAction = async () => {
    const batchId = task?.batchId || task?.batch?.id;
    if (!batchId || !actionForm.action) return;
    setExecutingAction(true);
    try {
      const body = {
        action: actionForm.action,
        quantity: actionForm.quantity ? Number(actionForm.quantity) : undefined,
        vendor: actionForm.vendor || undefined,
        remarks: actionForm.notes || undefined,
        notes: actionForm.notes || undefined,
        costAmount: actionForm.totalCharges ? Number(actionForm.totalCharges) : undefined,
      };
      const res = await mfgFetch(`/api/admin/manufacturing/batches/${batchId}/action`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update production stage");
      showToast("Production stage advanced");
      setActionForm({ action: "", quantity: "", vendor: "", notes: "", totalCharges: "" });
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setExecutingAction(false);
    }
  };

  // Post Batch Note
  const addBatchNote = async () => {
    const batchId = task?.batchId || task?.batch?.id;
    if (!batchId || !noteContent.trim()) return;
    setAddingNote(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/batches/${batchId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      if (!res.ok) throw new Error("Failed to post note");
      showToast("Note added");
      setNoteContent("");
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setAddingNote(false);
    }
  };

  // Add Miscellaneous Expense
  const addMiscExpense = async () => {
    const batchId = task?.batchId || task?.batch?.id;
    if (!batchId || !expenseForm.amount || !expenseForm.description.trim()) return;
    setAddingExpense(true);
    try {
      const res = await mfgFetch("/api/admin/manufacturing/misc", {
        method: "POST",
        body: JSON.stringify({
          batchId,
          amount: Number(expenseForm.amount),
          description: expenseForm.description.trim(),
          expenseType: expenseForm.expenseType,
          expenseDate: expenseForm.expenseDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to log expense");
      showToast("Expense logged");
      setExpenseForm({
        amount: "",
        description: "",
        expenseType: "OTHER",
        expenseDate: new Date().toISOString().split("T")[0],
      });
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setAddingExpense(false);
    }
  };

  // Zoho WorkDrive Folder Link
  const linkWorkDriveFolder = async () => {
    if (!task) return;
    setLinkingFolder(true);
    try {
      const folderNameClean = task.batch?.batchCode
        ? `Batch-${task.batch.batchCode}`
        : `Task-${task.id}`;

      const folderRes = await fetch("/api/workdrive/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderNameClean }),
      });
      if (!folderRes.ok) throw new Error("Failed to create folder");
      const folder = await folderRes.json();
      if (folder.error) throw new Error(folder.error);

      const teamId = process.env.NEXT_PUBLIC_ZOHO_WD_TEAM_ID || "f48vv99d2b514c3a14d4faf3d5813eb13c454";
      const wsId = process.env.NEXT_PUBLIC_ZOHO_WD_WORKSPACE_ID || "1egko45e1b49a70d2401fad5e5650485e18e1";
      const folderUrl = `https://workdrive.zoho.in/${teamId}/ws/${wsId}/folders/${folder.folderId}`;

      // Update database task or batch
      if (id.startsWith("PROD-")) {
        const batchId = id.replace("PROD-", "");
        const res = await mfgFetch(`/api/admin/manufacturing/batches/${batchId}`, {
          method: "PATCH",
          body: JSON.stringify({
            workdriveFolderId: folder.folderId,
            workdriveUrl: folderUrl,
          }),
        });
        if (!res.ok) throw new Error("Failed to save folder link in Batch");
      } else {
        const res = await mfgFetch(`/api/admin/manufacturing/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            workdriveFolderId: folder.folderId,
            workdriveUrl: folderUrl,
            workdriveFolderName: folder.folderName,
          }),
        });
        if (!res.ok) throw new Error("Failed to save folder link in Task");
      }

      showToast("WorkDrive folder linked successfully!");
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setLinkingFolder(false);
    }
  };

  // Workflow transition transitions: DESIGN -> PRODUCTION / VENDOR
  const handleWorkflowTransition = async (transitionType: "SEND_TO_PRODUCTION" | "SEND_TO_VENDOR_SELECTION") => {
    if (!task) return;
    setWorkflowLoading(true);
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          id: task.id,
          transition: transitionType,
          quantity: transitionType === "SEND_TO_PRODUCTION" ? prodQty : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Workflow transition failed");
      showToast(data.message || "Workflow updated");
      setProdWorkflowOpen(false);
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setWorkflowLoading(false);
    }
  };

  // Direct Design Approval updates
  const handleDesignApproval = async (status: "APPROVED" | "REJECTED" | "PENDING") => {
    if (!task) return;
    try {
      const res = await mfgFetch(`/api/admin/manufacturing/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus: status }),
      });
      if (!res.ok) throw new Error("Failed to update approval status");
      showToast(`Design ${status.toLowerCase()}`);
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  // Assign Vendor directly to a vendor task (Logs vendor to notes and description)
  const assignVendorToTask = async (vendor: Vendor) => {
    if (!task) return;
    try {
      const newDesc = `${task.description || ""}\n\n[Assigned Vendor: ${vendor.name} (${vendor.contactPerson || "No Contact"} - ${vendor.mobile || "No Mobile"})]`;
      const res = await mfgFetch(`/api/admin/manufacturing/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: newDesc,
          status: "COMPLETED",
        }),
      });
      if (!res.ok) throw new Error("Failed to assign vendor");
      showToast(`Vendor ${vendor.name} assigned to task!`);
      loadTaskData();
    } catch (e: any) {
      showToast(e.message, "err");
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 relative z-10">
        <Loader2 className="w-10 h-10 animate-spin text-foreground/45" />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/30">Loading Task Details</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 relative z-10 text-center px-4">
        <AlertCircle className="w-12 h-12 text-rose-500/80" />
        <div>
          <h2 className="text-base font-bold text-foreground uppercase tracking-tight">Failed to Load Task</h2>
          <p className="text-[11px] text-foreground/40 mt-1 max-w-sm">{error || "Task details could not be found."}</p>
        </div>
        <button
          onClick={() => router.push("/dashboard/manufacturing/tasks")}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Kanban Board
        </button>
      </div>
    );
  }

  const batch = task.batch;
  const isVirtual = id.startsWith("PROD-");
  const batchId = task.batchId || batch?.id;
  const workdriveFolderId = task.workdriveFolderId || batch?.workdriveFolderId;
  const workdriveUrl = task.workdriveUrl || batch?.workdriveUrl;

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
    v.category.toLowerCase().includes(vendorSearchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-24 space-y-6 relative z-10"
    >
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
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

      {/* Header breadcrumb & navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/manufacturing/tasks")}
          className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/5 rounded-xl text-[9px] font-bold uppercase tracking-[0.15em] transition-all active:scale-95 shadow-inner"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Kanban
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTaskData}
            className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/5 hover:bg-foreground/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-foreground/40" />
          </button>
          {!isVirtual && (
            <button
              onClick={deleteTask}
              className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Main Context Area) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Base Meta Card */}
          <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-5">
            
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                task.priority === "HIGH" ? "bg-rose-500/10 text-rose-400 border-rose-500/15" :
                task.priority === "LOW" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" :
                "bg-amber-500/10 text-amber-400 border-amber-500/15"
              }`}>
                {task.priority === "HIGH" ? "Urgent" : task.priority === "LOW" ? "Low" : "Normal"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                {task.type}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                task.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" :
                task.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-400 border-blue-500/15" :
                "bg-amber-500/10 text-amber-400 border-amber-500/15"
              }`}>
                {task.status}
              </span>
            </div>

            {/* Task Editable Title & Info */}
            <div className="space-y-4">
              {editMode ? (
                <div className="space-y-3 pt-2">
                  <input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[15px] font-bold text-foreground focus:outline-none focus:border-foreground/30"
                    placeholder="Task Title"
                  />
                  <textarea
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] font-medium text-foreground focus:outline-none focus:border-foreground/30 resize-none"
                    placeholder="Task Description"
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Priority</label>
                      <select
                        value={editedPriority}
                        onChange={(e) => setEditedPriority(e.target.value as any)}
                        className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-[12px] font-semibold text-foreground focus:outline-none"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Normal</option>
                        <option value="HIGH">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Due Date</label>
                      <input
                        type="date"
                        value={editedDueDate}
                        onChange={(e) => setEditedDueDate(e.target.value)}
                        className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-[12px] font-semibold text-foreground focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Assignee</label>
                      <select
                        value={editedAssignee}
                        onChange={(e) => setEditedAssignee(e.target.value)}
                        className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-[12px] font-semibold text-foreground focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {adminUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setEditMode(false)}
                      disabled={savingTask}
                      className="px-4 py-2 bg-background border border-foreground/10 text-foreground/60 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-foreground/5 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTaskEdits}
                      disabled={savingTask}
                      className="px-5 py-2 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5"
                    >
                      {savingTask && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save Updates
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">{task.title}</h1>
                    {!isVirtual && (
                      <button
                        onClick={() => setEditMode(true)}
                        className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-[13px] text-foreground/50 mt-3 leading-relaxed whitespace-pre-line">{task.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Quick Status Adjust & Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-foreground/5">
              <div>
                <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Created At</span>
                <span className="text-[11px] font-semibold text-foreground/70">{formatDateTimeIST(task.createdAt)}</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Due Date</span>
                <span className="text-[11px] font-semibold text-foreground/70">
                  {task.dueDate ? formatDateTimeIST(task.dueDate).split(",")[0] : "None"}
                </span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Assignee</span>
                <span className="text-[11px] font-semibold text-foreground/70">
                  {task.assignedTo ? (task.assignedTo.name || task.assignedTo.email.split("@")[0]) : "Unassigned"}
                </span>
              </div>
              {!isVirtual && (
                <div>
                  <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-1">Actions</span>
                  <div className="flex gap-1">
                    {task.status !== "COMPLETED" ? (
                      <button
                        onClick={() => updateTaskStatus("COMPLETED")}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-500/25 transition-all"
                      >
                        <Check className="w-3 h-3" />
                        Complete
                      </button>
                    ) : (
                      <button
                        onClick={() => updateTaskStatus("PENDING")}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-amber-500/25 transition-all"
                      >
                        Re-open
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* PRODUCTION SPECIFIC WORKFLOWS */}
          {batch && (
            <div className="space-y-6">
              
              {/* Batch State Details */}
              <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Production Tracker Details</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-foreground/[0.02] border border-foreground/5 rounded-2xl">
                  <div>
                    <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-0.5">Batch Code</span>
                    <span className="text-[13px] font-bold font-mono text-foreground">{batch.batchCode}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-0.5">Product</span>
                    <span className="text-[13px] font-bold text-foreground truncate block">{batch.productName}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-0.5">Quantity</span>
                    <span className="text-[13px] font-bold text-foreground">{batch.quantity} units</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-0.5">Current Stage</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[12px] font-bold text-indigo-400 uppercase tracking-wide">
                        {MFG_STAGE_LABEL[batch.currentStage] || batch.currentStage}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: "Sample", val: batch.isSampleDone },
                    { label: "Cutting", val: batch.isCuttingDone },
                    { label: "Stitching", val: batch.isStitchingDone },
                    { label: "Printing", val: batch.isPrintingDone },
                    { label: "Embroidery", val: batch.isEmbroideryDone },
                    { label: "Washing", val: batch.isWashingDone },
                  ].map((f, i) => (
                    <div key={i} className={`p-2 rounded-xl border text-center transition-all ${
                      f.val ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "bg-foreground/[0.01] text-foreground/30 border-foreground/5"
                    }`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider block">{f.label}</span>
                      <span className="text-[8px] font-bold mt-0.5 block">{f.val ? "Done" : "Pending"}</span>
                    </div>
                  ))}
                </div>

                {/* Execute Stage Update */}
                <div className="pt-4 border-t border-foreground/5 space-y-4">
                  <div className="text-[9.5px] font-bold text-foreground/30 uppercase tracking-[0.2em]">Execute Stage transition</div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={actionForm.action}
                        onChange={(e) => setActionForm(prev => ({ ...prev, action: e.target.value }))}
                        className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] font-bold text-foreground focus:outline-none"
                      >
                        <option value="">Select Stage Transition...</option>
                        {actionsForBatch(batch.currentStage, batch.isSampleDone, batch.isCuttingDone, batch.isStitchingDone).map(act => (
                          <option key={act.key} value={act.key}>{act.label}</option>
                        ))}
                      </select>

                      <input
                        value={actionForm.quantity}
                        onChange={(e) => setActionForm(prev => ({ ...prev, quantity: e.target.value }))}
                        placeholder={`Quantity (Default: ${batch.quantity})`}
                        type="number"
                        className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] font-medium text-foreground focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        value={actionForm.vendor}
                        onChange={(e) => setActionForm(prev => ({ ...prev, vendor: e.target.value }))}
                        placeholder="Vendor / Workshop Name"
                        className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] font-medium text-foreground focus:outline-none"
                      />

                      <input
                        value={actionForm.totalCharges}
                        onChange={(e) => setActionForm(prev => ({ ...prev, totalCharges: e.target.value }))}
                        placeholder="Total charges (₹)"
                        type="number"
                        className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] font-medium text-foreground focus:outline-none"
                      />
                    </div>

                    <textarea
                      value={actionForm.notes}
                      onChange={(e) => setActionForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Transaction notes and details..."
                      rows={2}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none resize-none"
                    />

                    <button
                      onClick={executeBatchAction}
                      disabled={!actionForm.action || executingAction}
                      className="w-full py-2.5 bg-foreground text-background hover:opacity-90 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {executingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Log Transition
                    </button>
                  </div>
                </div>

              </div>

              {/* Batch Note Card */}
              <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Batch Notes</h2>
                </div>

                <div className="flex gap-2">
                  <input
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write a quick batch note..."
                    className="flex-1 bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none"
                    onKeyDown={(e) => e.key === "Enter" && addBatchNote()}
                  />
                  <button
                    onClick={addBatchNote}
                    disabled={addingNote || !noteContent.trim()}
                    className="px-4 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                  >
                    Post
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {batch.batchNotes.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-foreground/20 font-medium">No notes on this batch yet.</div>
                  ) : (
                    batch.batchNotes.map(n => (
                      <div key={n.id} className="p-3 bg-foreground/[0.01] border border-foreground/5 rounded-xl space-y-1">
                        <p className="text-[11.5px] text-foreground/80 leading-normal">{n.content}</p>
                        <div className="flex justify-between text-[8.5px] text-foreground/35 font-bold uppercase tracking-wider">
                          <span>By {n.createdByName}</span>
                          <span>{formatDateTimeIST(n.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Misc Expenses Card */}
              <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Miscellaneous Expenses Ledger</h2>
                </div>

                {/* Add Expense Form */}
                <div className="p-4 bg-foreground/[0.01] border border-foreground/5 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="number"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Amount (₹)"
                      className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-1.5 text-[11.5px] font-semibold text-foreground focus:outline-none"
                    />
                    <select
                      value={expenseForm.expenseType}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseType: e.target.value }))}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-1.5 text-[11.5px] font-semibold text-foreground focus:outline-none"
                    >
                      <option value="LOGISTICS">Logistics</option>
                      <option value="WASHING">Washing</option>
                      <option value="FABRIC_TRIMS">Trims/Trimmings</option>
                      <option value="LABOUR">Labour</option>
                      <option value="SAMPLE">Sampling</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      type="date"
                      value={expenseForm.expenseDate}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                      className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-1.5 text-[11.5px] font-semibold text-foreground focus:outline-none"
                    />
                    <button
                      onClick={addMiscExpense}
                      disabled={addingExpense || !expenseForm.amount || !expenseForm.description.trim()}
                      className="w-full bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 text-center"
                    >
                      Add Expense
                    </button>
                  </div>
                  <input
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Expense Description (e.g. zippers, local cargo travel, custom buttons)"
                    className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[11.5px] font-medium text-foreground focus:outline-none"
                  />
                </div>

                {/* Expenses list */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {batch.miscExpenses.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-foreground/20 font-medium">No miscellaneous expenses logged.</div>
                  ) : (
                    batch.miscExpenses.map(exp => (
                      <div key={exp.id} className="flex justify-between items-center p-3 bg-foreground/[0.01] border border-foreground/5 rounded-xl">
                        <div>
                          <div className="text-[12px] font-bold text-foreground">{exp.description}</div>
                          <div className="flex gap-2 text-[8.5px] text-foreground/35 font-bold uppercase mt-1">
                            <span className="px-1.5 py-0.2 bg-foreground/5 rounded border border-foreground/5">{exp.expenseType}</span>
                            <span>{formatDateTimeIST(exp.expenseDate).split(",")[0]}</span>
                            <span>By {exp.createdByName}</span>
                          </div>
                        </div>
                        <div className="text-[13px] font-extrabold text-rose-400 font-mono">-{formatInr(exp.amount)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Fabric Movements Card */}
              <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Linked Fabric Movements</h2>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {batch.movements.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-foreground/20 font-medium">No fabric movements linked.</div>
                  ) : (
                    batch.movements.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-foreground/[0.01] border border-foreground/5 rounded-xl">
                        <div>
                          <div className="text-[12px] font-bold text-foreground">
                            {m.type === "CONSUMPTION" ? "Consumed" : m.type === "ALLOCATION" ? "Allocated" : m.type}
                          </div>
                          <div className="text-[9px] text-foreground/45 font-medium mt-0.5">
                            {m.remarks || "No remarks"}
                          </div>
                          <div className="text-[8.5px] text-foreground/35 font-bold uppercase tracking-wider mt-1">
                            {formatDateTimeIST(m.occurredAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-bold font-mono text-indigo-400">
                            {m.quantity} {m.quantityUnit}
                          </div>
                          <div className="text-[9px] text-foreground/30 font-medium">
                            @{formatInr(m.rateAtMovement)}/m
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stage Logs timeline */}
              <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Timeline Stage Logs</h2>
                </div>

                <div className="relative border-l border-foreground/5 ml-3 pl-5 space-y-5 py-2">
                  {batch.stageLogs.map((log) => {
                    const LogIcon = STAGE_ICONS[log.toStage || ""] || ClipboardList;
                    return (
                      <div key={log.id} className="relative">
                        {/* Timeline node */}
                        <div className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-background border-2 border-indigo-400 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-foreground uppercase tracking-tight">
                              {log.action.replaceAll("_", " ")}
                            </span>
                            <span className="text-[8.5px] font-bold text-foreground/30 uppercase tracking-widest ml-auto">
                              {formatDateTimeIST(log.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-foreground/45">
                            <span>Stage:</span>
                            <span className="text-indigo-400 font-bold uppercase tracking-wide">
                              {log.fromStage ? (MFG_STAGE_LABEL[log.fromStage] || log.fromStage) : "Start"}
                            </span>
                            <ArrowRight className="w-2.5 h-2.5" />
                            <span className="text-indigo-400 font-bold uppercase tracking-wide">
                              {MFG_STAGE_LABEL[log.toStage || ""] || log.toStage || "QC"}
                            </span>
                          </div>

                          {log.costAmount > 0 && (
                            <div className="text-[10.5px] font-semibold text-rose-400">
                              Cost logged: {formatInr(log.costAmount)}
                            </div>
                          )}

                          {log.payload?.notes && (
                            <p className="text-[10px] text-foreground/35 italic">“{log.payload.notes}”</p>
                          )}

                          <div className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest">
                            Logged by {log.createdByName}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* DESIGN SELECTION & APPROVAL SPECIFIC WORKFLOWS */}
          {(task.type === "DESIGN_APPROVAL" || task.type === "DESIGN_SELECTION") && (
            <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Design Studio Approval Workflow</h2>
              </div>

              <div className="p-4 bg-foreground/[0.01] border border-foreground/5 rounded-2xl space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-0.5">Design Name</span>
                    <span className="text-[13px] font-bold text-foreground">{task.designName || task.title}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-widest block mb-0.5">Approval Status</span>
                    <span className={`text-[13px] font-bold ${
                      task.approvalStatus === "APPROVED" ? "text-emerald-400" :
                      task.approvalStatus === "REJECTED" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {task.approvalStatus || "PENDING"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {task.approvalStatus !== "APPROVED" && (
                  <button
                    onClick={() => handleDesignApproval("APPROVED")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all active:scale-[0.98]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve Design
                  </button>
                )}
                {task.approvalStatus !== "REJECTED" && (
                  <button
                    onClick={() => handleDesignApproval("REJECTED")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all active:scale-[0.98]"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject / Revision Needed
                  </button>
                )}
                
                {/* Send To Production Trigger */}
                {(task.approvalStatus === "APPROVED" || task.type === "DESIGN_SELECTION") && (
                  <button
                    onClick={() => setProdWorkflowOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 shadow-md transition-all active:scale-[0.98]"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Spin-off to Production
                  </button>
                )}

                {/* Send To Vendor Trigger */}
                {(task.approvalStatus === "APPROVED" || task.type === "DESIGN_SELECTION") && (
                  <button
                    onClick={() => handleWorkflowTransition("SEND_TO_VENDOR_SELECTION")}
                    disabled={workflowLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-background border border-foreground/10 text-foreground rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-foreground/5 transition-all active:scale-[0.98]"
                  >
                    {workflowLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    Forward to Vendor Selection
                  </button>
                )}
              </div>

              {/* Production Spin off modal */}
              {prodWorkflowOpen && (
                <div className="p-4 bg-foreground/[0.02] border border-foreground/5 rounded-2xl space-y-3 mt-3 animate-fadeIn">
                  <div className="text-[9.5px] font-bold text-foreground/30 uppercase tracking-[0.2em]">Configure Production Batch</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={prodQty}
                      onChange={(e) => setProdQty(e.target.value)}
                      placeholder="Batch size quantity"
                      className="bg-background border border-foreground/10 rounded-xl px-4 py-2 text-[12px] font-medium text-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => handleWorkflowTransition("SEND_TO_PRODUCTION")}
                      disabled={workflowLoading || !prodQty}
                      className="px-5 bg-foreground text-background rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5"
                    >
                      {workflowLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Confirm Production Spin-off
                    </button>
                    <button
                      onClick={() => setProdWorkflowOpen(false)}
                      className="px-3 bg-foreground/5 text-foreground border border-foreground/5 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-foreground/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* VENDOR SEARCH & SELECTION WORKFLOWS */}
          {(task.type === "VENDOR_SELECTION" || task.type === "VENDOR_SEARCH") && (
            <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Vendor Directory Match</h2>
              </div>

              <div className="relative">
                <input
                  value={vendorSearchQuery}
                  onChange={(e) => setVendorSearchQuery(e.target.value)}
                  placeholder="Search vendors by category or name..."
                  className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-2.5 text-[12px] font-medium text-foreground focus:outline-none"
                />
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {filteredVendors.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-foreground/20 font-medium">No vendors found matching query.</div>
                ) : (
                  filteredVendors.map(vendor => (
                    <div key={vendor.id} className="p-4 bg-foreground/[0.01] border border-foreground/5 rounded-xl flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-foreground">{vendor.name}</span>
                          <span className="px-2 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 rounded text-[9px] font-bold uppercase tracking-wider">
                            {vendor.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-foreground/45">
                          Contact: {vendor.contactPerson || "None"} &middot; {vendor.mobile || "No Mobile"}
                        </p>
                        {vendor.pricingNotes && (
                          <p className="text-[10px] text-amber-400/80 font-medium">Pricing: {vendor.pricingNotes}</p>
                        )}
                        {vendor.remarks && (
                          <p className="text-[9.5px] text-foreground/30 italic">“{vendor.remarks}”</p>
                        )}
                      </div>
                      
                      <button
                        onClick={() => assignVendorToTask(vendor)}
                        className="px-3 py-1.5 bg-foreground text-background hover:opacity-90 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shrink-0 active:scale-95 shadow-sm"
                      >
                        Assign Vendor
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column (Zoho WorkDrive Explorer & Side Utilities) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* WorkDrive Explorer Card */}
          <div className="glass-card p-6 rounded-[2rem] border border-foreground/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">Zoho WorkDrive Explorer</h2>
              </div>
              
              {workdriveUrl && (
                <a
                  href={workdriveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-foreground/30 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                </a>
              )}
            </div>

            {workdriveFolderId ? (
              <div className="space-y-4">
                <WorkDriveGallery
                  folderId={workdriveFolderId}
                  folderName={task.title}
                  allowUpload={true}
                />
                
                {workdriveUrl && (
                  <a
                    href={workdriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 rounded-xl text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-colors shadow-inner"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Open WorkDrive Dashboard
                  </a>
                )}
              </div>
            ) : (
              <div className="p-6 bg-foreground/[0.01] border border-dashed border-foreground/10 rounded-[1.5rem] text-center space-y-4">
                <FolderOpen className="w-10 h-10 text-foreground/10 mx-auto" />
                
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-foreground/40 uppercase tracking-widest">No WorkDrive Folder</p>
                  <p className="text-[10px] text-foreground/25 font-medium leading-relaxed max-w-xs mx-auto">
                    Link folder to synchronize design drafts, specs sheets, costings, or product imagery.
                  </p>
                </div>

                <button
                  onClick={linkWorkDriveFolder}
                  disabled={linkingFolder}
                  className="mx-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-foreground text-background hover:opacity-90 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 shadow-md active:scale-95"
                >
                  {linkingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Link Zoho WorkDrive
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </motion.div>
  );
}
