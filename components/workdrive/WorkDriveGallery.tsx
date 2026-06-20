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

  const imageFiles = files.filter((f) => f.isImage);

  const fetchFiles = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workdrive/files?folderId=${folderId}`, {
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
  }, [folderId]);

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

  // ─── Upload ─────────────────────────────────
  const handleUpload = async (fileList: FileList | File[]) => {
    if (!folderId) return;
    setUploading(true);
    const filesToUpload = Array.from(fileList);

    for (const file of filesToUpload) {
      const key = file.name;
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", folderId);

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
              accept="image/*"
              multiple
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
            <p className="text-[12px] font-bold text-foreground">Drop images to upload</p>
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
            {imageFiles.length} image{imageFiles.length !== 1 ? "s" : ""}
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
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-lg text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      ) : imageFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.01]">
          <ImageIcon className="w-10 h-10 text-foreground/10 mb-3" />
          <p className="text-[12px] font-bold text-foreground/30 uppercase tracking-widest">
            No images yet
          </p>
          {allowUpload && (
            <p className="text-[10px] text-foreground/20 mt-1">
              Upload or drag images to get started
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {imageFiles.map((file, i) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`group relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 hover:shadow-xl ${
                selectedFileId === file.id
                  ? "border-amber-400 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400/30"
                  : "border-foreground/5 hover:border-foreground/20"
              }`}
              onClick={() => {
                if (onFileSelect) {
                  onFileSelect(file.id, file.name);
                } else {
                  openLightbox(i);
                }
              }}
            >
              <img
                src={`/api/workdrive/image?fileId=${file.id}`}
                alt={file.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none">
                <p className="text-[10px] font-mono text-white/80 truncate">
                  {file.name}
                </p>
                <p className="text-[9px] text-white/50">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>

              {/* Selection check */}
              {onFileSelect && (
                <div
                  className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    selectedFileId === file.id
                      ? "bg-amber-400 text-black"
                      : "bg-black/40 text-white/60 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
              )}
            </motion.div>
          ))}
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
