"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  ImageIcon,
  RefreshCw,
  Loader2,
  FolderOpen,
  Plus,
  AlertCircle,
  Folder,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WorkDriveFileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  extension: string;
  createdTime: string;
  isImage: boolean;
  isFolder: boolean;
}

interface WorkDriveGalleryProps {
  folderId: string | null;
  folderName?: string;
  allowUpload?: boolean;
  onFileUploaded?: (fileId: string, fileName: string) => void;
  onFileSelect?: (fileId: string, fileName: string) => void;
  onFolderCreate?: (folderId: string, folderName: string) => void;
  selectedFileId?: string;
  compact?: boolean;
  autoCreateFolderName?: string; // if set + folderId null, shows "Create Folder" CTA
}

export default function WorkDriveGallery({
  folderId,
  folderName,
  allowUpload = true,
  onFileUploaded,
  onFileSelect,
  onFolderCreate,
  selectedFileId,
  compact = false,
  autoCreateFolderName,
}: WorkDriveGalleryProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderId);
  const [folderHistory, setFolderHistory] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<WorkDriveFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentFolderId(folderId);
    setFolderHistory([]);
  }, [folderId]);

  const imageFiles = files.filter((f) => f.isImage);
  const sortedItems = [...files].sort((a, b) => (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0));

  const fetchFiles = useCallback(async () => {
    if (!currentFolderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workdrive/files?folderId=${currentFolderId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`Failed to load files: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ─── Folder Creation ────────────────────────
  const handleCreateFolder = async () => {
    if (!autoCreateFolderName || !onFolderCreate) return;
    setCreatingFolder(true);
    setError(null);
    try {
      const res = await fetch("/api/workdrive/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: autoCreateFolderName }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create folder: ${res.status} — ${errText}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.folderId) {
        onFolderCreate(data.folderId, data.folderName);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleCreateNewFolder = async () => {
    const name = prompt("Enter folder name:");
    if (!name || !name.trim()) return;
    setCreatingFolder(true);
    setError(null);
    try {
      const res = await fetch("/api/workdrive/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolderId: currentFolderId, name: name.trim() }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create folder: ${res.status} — ${errText}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchFiles();
    } catch (err: any) {
      setError(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderClick = (id: string, name: string) => {
    setFolderHistory((prev) => [...prev, { id: currentFolderId!, name: folderName || "Root" }]);
    setCurrentFolderId(id);
  };

  const handleBack = () => {
    const hist = [...folderHistory];
    const prev = hist.pop();
    setFolderHistory(hist);
    setCurrentFolderId(prev ? prev.id : folderId);
  };

  // ─── Upload ─────────────────────────────────
  const handleUpload = async (fileList: FileList | File[]) => {
    const uploadFolderId = currentFolderId;
    if (!uploadFolderId) return;
    setUploading(true);
    const filesToUpload = Array.from(fileList);

    for (const file of filesToUpload) {
      const key = file.name;
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", uploadFolderId);

        setUploadProgress((prev) => ({ ...prev, [key]: 30 }));

        const res = await fetch("/api/workdrive/upload", {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        });

        setUploadProgress((prev) => ({ ...prev, [key]: 80 }));

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
        }

        const data = await res.json();
        setUploadProgress((prev) => ({ ...prev, [key]: 100 }));
        onFileUploaded?.(data.fileId, data.name);
      } catch (err: any) {
        setUploadProgress((prev) => ({ ...prev, [key]: -1 }));
        console.error(`Upload failed for ${key}:`, err);
      }
    }

    // Refresh file list after uploads
    setTimeout(() => {
      setUploadProgress({});
      setUploading(false);
      fetchFiles();
    }, 800);
  };

  // ─── Drag & Drop ────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // ─── Lightbox ───────────────────────────────
  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextImage = () =>
    setLightboxIndex((i) => (i !== null ? (i + 1) % imageFiles.length : null));
  const prevImage = () =>
    setLightboxIndex((i) =>
      i !== null ? (i - 1 + imageFiles.length) % imageFiles.length : null
    );

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, imageFiles.length]);

  // ─── NULL / EMPTY STATE ─────────────────────
  if (!folderId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/[0.01]">
        <FolderOpen className="w-10 h-10 text-foreground/15 mb-3" />
        <p className="text-[12px] font-bold text-foreground/30 uppercase tracking-widest text-center">
          No folder linked — click to create one
        </p>
        {autoCreateFolderName && onFolderCreate && (
          <button
            type="button"
            disabled={creatingFolder}
            onClick={handleCreateFolder}
            className="mt-4 px-4 py-2 bg-foreground text-background text-[10px] font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {creatingFolder ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating folder...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Create Folder
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // ─── COMPACT MODE ───────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 -mx-1 px-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-[80px] h-[80px] rounded-xl bg-foreground/5 animate-pulse shrink-0"
            />
          ))
        ) : error ? (
          <div className="flex items-center gap-2 text-[10px] text-rose-400 font-medium py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Error</span>
            <button onClick={fetchFiles} className="text-foreground/45 hover:text-foreground underline">Retry</button>
          </div>
        ) : imageFiles.length === 0 ? (
          <div className="flex items-center gap-2 text-[10px] text-foreground/30 font-medium py-2">
            <ImageIcon className="w-3.5 h-3.5" />
            No images yet
          </div>
        ) : (
          <>
            {imageFiles.slice(0, 4).map((file, i) => (
              <button
                key={file.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onFileSelect) {
                    onFileSelect(file.id, file.name);
                  } else {
                    openLightbox(i);
                  }
                }}
                className={`w-[80px] h-[80px] rounded-xl overflow-hidden shrink-0 border-2 transition-all hover:scale-105 ${
                  selectedFileId === file.id
                    ? "border-amber-400 shadow-lg shadow-amber-400/20"
                    : "border-foreground/5 hover:border-foreground/20"
                }`}
              >
                <img
                  src={`/api/workdrive/image?fileId=${file.id}`}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
            {imageFiles.length > 4 && (
              <div className="w-[80px] h-[80px] rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-foreground/40">
                  +{imageFiles.length - 4} more
                </span>
              </div>
            )}
          </>
        )}

        {allowUpload && !loading && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="w-[80px] h-[80px] rounded-xl border-2 border-dashed border-foreground/10 flex items-center justify-center shrink-0 hover:border-foreground/30 hover:bg-foreground/5 transition-all"
            >
              <Plus className="w-4 h-4 text-foreground/30" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </>
        )}

        {/* Lightbox Overlay */}
        <AnimatePresence>
          {lightboxIndex !== null && imageFiles[lightboxIndex] && (
            <LightboxOverlay
              file={imageFiles[lightboxIndex]}
              onClose={closeLightbox}
              onPrev={prevImage}
              onNext={nextImage}
              total={imageFiles.length}
              current={lightboxIndex}
              onSelect={onFileSelect}
              isSelected={selectedFileId === imageFiles[lightboxIndex]?.id}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── FULL GALLERY MODE ──────────────────────
  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-2xl p-4 transition-all ${
        isDragging ? "border-2 border-dashed border-amber-400/50 bg-amber-400/5" : ""
      }`}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/40 backdrop-blur-sm rounded-2xl z-50 flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload className="w-10 h-10 text-amber-400 mb-2 animate-bounce" />
            <p className="text-[12px] font-bold text-foreground">Drop files to upload</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-foreground/40" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/50">
            {folderName || "Gallery"}
          </h3>
          <span className="text-[10px] text-foreground/30 font-medium">
            {files.length} item{files.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFiles}
            disabled={loading}
            className="p-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {allowUpload && (
            <>
              <button
                onClick={handleCreateNewFolder}
                disabled={creatingFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-foreground/10 text-foreground rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-foreground/5 transition-all disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                New Folder
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-lg text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
              />
            </>
          )}
        </div>
      </div>

      {/* Upload progress */}
      <AnimatePresence>
        {Object.keys(uploadProgress).length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 space-y-2"
          >
            {Object.entries(uploadProgress).map(([name, pct]) => (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-foreground/5"
              >
                <span className="text-[10px] font-mono text-foreground/50 truncate flex-1">
                  {name}
                </span>
                {pct === -1 ? (
                  <span className="text-[9px] font-bold text-rose-500">FAILED</span>
                ) : pct === 100 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <div className="w-20 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div
                      className="h-full bg-foreground/60 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumbs / Back button */}
      {folderHistory.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
            {folderHistory.map(h => h.name).join(" / ")} / Current
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-foreground/5 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 border border-foreground/5 rounded-2xl bg-foreground/[0.01]">
          <p className="text-[11px] text-rose-400 font-medium">{error}</p>
          <button
            onClick={fetchFiles}
            className="px-3.5 py-1.5 rounded-xl bg-foreground/5 text-foreground/60 text-[9px] font-bold uppercase tracking-wider hover:bg-foreground/10 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.01]">
          <FolderOpen className="w-10 h-10 text-foreground/10 mb-3" />
          <p className="text-[12px] font-bold text-foreground/30 uppercase tracking-widest">
            This folder is empty
          </p>
          {allowUpload && (
            <p className="text-[10px] text-foreground/20 mt-1">
              Upload files or create subfolders to get started
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sortedItems.map((item) => {
            if (item.isFolder) {
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleFolderClick(item.id, item.name)}
                  className="aspect-square rounded-2xl border border-foreground/5 hover:border-foreground/20 bg-foreground/[0.02] hover:bg-foreground/[0.04] p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative group overflow-hidden"
                >
                  <Folder className="w-12 h-12 text-amber-500/70 group-hover:text-amber-500 transition-colors mb-3" />
                  <span className="text-[11px] font-bold text-foreground/80 line-clamp-2 px-2 uppercase tracking-wide leading-tight text-center">
                    {item.name}
                  </span>
                  <span className="text-[9px] text-foreground/30 uppercase tracking-wider mt-1">
                    Directory
                  </span>
                </motion.div>
              );
            }

            if (item.isImage) {
              const imgIndex = imageFiles.findIndex((img) => img.id === item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`group relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl ${
                    selectedFileId === item.id
                      ? "border-amber-400 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400/30"
                      : "border-foreground/5 hover:border-foreground/20"
                  }`}
                  onClick={() => {
                    if (onFileSelect) {
                      onFileSelect(item.id, item.name);
                    } else {
                      openLightbox(imgIndex >= 0 ? imgIndex : 0);
                    }
                  }}
                >
                  <img
                    src={`/api/workdrive/image?fileId=${item.id}`}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none">
                    <p className="text-[10px] font-mono text-white/80 truncate">
                      {item.name}
                    </p>
                    <p className="text-[9px] text-white/50">
                      {(item.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {onFileSelect && (
                    <div
                      className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        selectedFileId === item.id
                          ? "bg-amber-400 text-black"
                          : "bg-black/40 text-white/60 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                  )}
                </motion.div>
              );
            }

            // Non-image File type
            return (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02 }}
                className="aspect-square rounded-2xl border border-foreground/5 hover:border-foreground/25 bg-foreground/[0.01] hover:bg-foreground/[0.03] p-4 flex flex-col items-center justify-center text-center relative group overflow-hidden transition-all duration-300"
              >
                <FileText className="w-12 h-12 text-indigo-400/70 group-hover:text-indigo-400 transition-colors mb-3" />
                <span className="text-[10px] font-mono text-foreground/80 line-clamp-2 px-2 leading-tight text-center">
                  {item.name}
                </span>
                <span className="text-[9px] text-foreground/30 uppercase tracking-widest mt-1">
                  {(item.size / 1024).toFixed(0)} KB
                </span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                  <a
                    href={`/api/workdrive/image?fileId=${item.id}`}
                    download={item.name}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all shadow-md active:scale-90"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && imageFiles[lightboxIndex] && (
          <LightboxOverlay
            file={imageFiles[lightboxIndex]}
            onClose={closeLightbox}
            onPrev={prevImage}
            onNext={nextImage}
            total={imageFiles.length}
            current={lightboxIndex}
            onSelect={onFileSelect}
            isSelected={selectedFileId === imageFiles[lightboxIndex]?.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Lightbox Component ───────────────────────
function LightboxOverlay({
  file,
  onClose,
  onPrev,
  onNext,
  total,
  current,
  onSelect,
  isSelected,
}: {
  file: WorkDriveFileItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  total: number;
  current: number;
  onSelect?: (fileId: string, fileName: string) => void;
  isSelected: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[300] flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10 bg-gradient-to-b from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-white/50">
            {current + 1} / {total}
          </span>
          <span className="text-[11px] font-mono text-white/70 truncate max-w-xs">
            {file.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onSelect && (
            <button
              onClick={() => onSelect(file.id, file.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                isSelected
                  ? "bg-amber-400 text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
              {isSelected ? "Selected" : "Select"}
            </button>
          )}
          <a
            href={`/api/workdrive/image?fileId=${file.id}`}
            download={file.name}
            className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center w-full px-16" onClick={(e) => e.stopPropagation()}>
        <img
          src={`/api/workdrive/image?fileId=${file.id}`}
          alt={file.name}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Navigation */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </motion.div>
  );
}
