"use client";

import { useState, useEffect, useRef } from "react";
import {
  Globe,
  Image as ImageIcon,
  Trash2,
  UploadCloud,
  AlertTriangle,
  Save,
  Undo,
  Check,
  Loader2,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Settings {
  id?: string;
  pageKey: string;
  homePageTitle: string;
  metaDescription: string;
  socialImageUrl?: string | null;
  socialImageAlt?: string | null;
  twitterCardType?: string;
}

export default function WebStorePreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    pageKey: "homepage",
    homePageTitle: "",
    metaDescription: "",
    socialImageUrl: null,
    socialImageAlt: "",
    twitterCardType: "summary_large_image"
  });
  const [initialSettings, setInitialSettings] = useState<Settings>({
    pageKey: "homepage",
    homePageTitle: "",
    metaDescription: "",
    socialImageUrl: null,
    socialImageAlt: "",
    twitterCardType: "summary_large_image"
  });

  const [lastUpdatedBy, setLastUpdatedBy] = useState<string>("System");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load preferences from API
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/webstore-settings/homepage");
        if (!res.ok) {
          throw new Error("Failed to fetch preferences settings.");
        }
        const data = await res.json();
        if (data.success && data.settings) {
          const loaded = {
            id: data.settings.id,
            pageKey: data.settings.pageKey,
            homePageTitle: data.settings.homePageTitle || "",
            metaDescription: data.settings.metaDescription || "",
            socialImageUrl: data.settings.socialImageUrl || null,
            socialImageAlt: data.settings.socialImageAlt || "",
            twitterCardType: data.settings.twitterCardType || "summary_large_image"
          };
          setSettings(loaded);
          setInitialSettings(loaded);
        }
        if (data.lastUpdatedBy) {
          setLastUpdatedBy(data.lastUpdatedBy);
        }
        if (data.lastUpdatedAt) {
          setLastUpdatedAt(new Date(data.lastUpdatedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
          }));
        }
      } catch (err: any) {
        toast.error(err.message || "Error loading store preferences");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const isDirty =
    settings.homePageTitle !== initialSettings.homePageTitle ||
    settings.metaDescription !== initialSettings.metaDescription ||
    settings.socialImageUrl !== initialSettings.socialImageUrl ||
    settings.socialImageAlt !== initialSettings.socialImageAlt ||
    settings.twitterCardType !== initialSettings.twitterCardType;

  // Handle Input Changes
  const handleInputChange = (field: keyof Settings, value: string | null) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Client-side center crop and resize to 1200x630
  const processImageFile = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1200;
          canvas.height = 630;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not initialize canvas context"));
            return;
          }

          const targetWidth = 1200;
          const targetHeight = 630;
          const targetAspect = targetWidth / targetHeight;
          const imageAspect = img.width / img.height;

          let srcX = 0;
          let srcY = 0;
          let srcWidth = img.width;
          let srcHeight = img.height;

          if (imageAspect > targetAspect) {
            srcWidth = img.height * targetAspect;
            srcX = (img.width - srcWidth) / 2;
          } else if (imageAspect < targetAspect) {
            srcHeight = img.width / targetAspect;
            srcY = (img.height - srcHeight) / 2;
          }

          ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to process image canvas"));
              }
            },
            "image/jpeg",
            0.92
          );
        };
        img.onerror = () => reject(new Error("Failed to load source image file."));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  };

  // Handle Image Upload
  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("Invalid file format. Please upload a JPG, PNG or WebP image.");
      return;
    }

    setUploading(true);
    const uploadToast = toast.loading("Processing and uploading sharing image...");

    try {
      // Process image to exactly 1200x630 (aspect-ratio & sizing standard)
      const croppedBlob = await processImageFile(file);
      
      const formData = new FormData();
      formData.append("file", croppedBlob, "social-share.jpg");

      const res = await fetch("/api/webstore-settings/upload-social-image", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to upload image.");
      }

      const data = await res.json();
      if (data.url) {
        handleInputChange("socialImageUrl", data.url);
        toast.success("Social sharing image uploaded successfully!", { id: uploadToast });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload image file.", { id: uploadToast });
    } finally {
      setUploading(false);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  // Discard Changes
  const handleDiscard = () => {
    setSettings(initialSettings);
    toast.success("Changes discarded.");
  };

  // Save Settings
  const handleSave = async () => {
    if (settings.homePageTitle.length > 70) {
      toast.error("Home page title must not exceed 70 characters.");
      return;
    }
    if (settings.metaDescription.length > 320) {
      toast.error("Meta description must not exceed 320 characters.");
      return;
    }

    setSaving(true);
    const saveToast = toast.loading("Saving store preferences...");

    try {
      const res = await fetch("/api/webstore-settings/homepage", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save preferences.");
      }

      const data = await res.json();
      if (data.success && data.settings) {
        const updated = {
          id: data.settings.id,
          pageKey: data.settings.pageKey,
          homePageTitle: data.settings.homePageTitle || "",
          metaDescription: data.settings.metaDescription || "",
          socialImageUrl: data.settings.socialImageUrl || null,
          socialImageAlt: data.settings.socialImageAlt || "",
          twitterCardType: data.settings.twitterCardType || "summary_large_image"
        };
        setSettings(updated);
        setInitialSettings(updated);
        
        // Refresh editor audit logs
        const refreshRes = await fetch("/api/webstore-settings/homepage");
        const refreshData = await refreshRes.json();
        if (refreshData.lastUpdatedBy) setLastUpdatedBy(refreshData.lastUpdatedBy);
        if (refreshData.lastUpdatedAt) {
          setLastUpdatedAt(new Date(refreshData.lastUpdatedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
          }));
        }

        toast.success("Preferences updated and live storefront revalidated successfully!", { id: saveToast });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save preferences.", { id: saveToast });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse p-4">
        <div className="flex flex-col gap-2">
          <div className="h-6 w-48 bg-foreground/10 rounded-lg" />
          <div className="h-4 w-72 bg-foreground/5 rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          <div className="lg:col-span-5 h-96 bg-foreground/5 rounded-3xl border border-foreground/5" />
          <div className="lg:col-span-7 h-96 bg-foreground/5 rounded-3xl border border-foreground/5" />
        </div>
      </div>
    );
  }

  const titleLength = settings.homePageTitle.length;
  const descLength = settings.metaDescription.length;

  return (
    <div className="space-y-8 pb-24 p-2 md:p-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-inter flex items-center gap-2">
            Store Preferences <Globe className="w-5 h-5 text-foreground/80" />
          </h1>
          <p className="text-[12px] text-foreground/50 mt-1">
            Manage global SEO meta tags, social sharing preview cards, and search engine settings.
          </p>
        </div>
        {lastUpdatedAt && (
          <div className="text-[11px] text-foreground/50 bg-foreground/5 px-3 py-1.5 rounded-xl border border-foreground/5">
            Last updated by <span className="text-foreground font-semibold">{lastUpdatedBy}</span> on {lastUpdatedAt}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Card: live preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass rounded-[2rem] border border-foreground/5 p-6 space-y-4">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-foreground/75 font-inter">
              Social Sharing Preview
            </h2>
            <p className="text-[11px] text-foreground/45 leading-relaxed">
              This preview matches how your home page appears when shared across social channels like Facebook, Twitter, and WhatsApp.
            </p>

            {/* Shopify Social Preview Card Mockup */}
            <div className="rounded-2xl border border-foreground/10 overflow-hidden bg-[#121212]/80 dark:bg-black/40 shadow-xl transition-all duration-300">
              <div className="relative aspect-[1200/630] bg-[#1a1a1a] flex items-center justify-center group">
                {settings.socialImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.socialImageUrl}
                    alt={settings.socialImageAlt || "Social preview image"}
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-foreground/30 text-center">
                    <ImageIcon className="w-12 h-12 mb-3 stroke-[1.25]" />
                    <span className="text-[11px] font-medium font-inter">No Social Sharing Image Set</span>
                    <span className="text-[9px] text-foreground/20 mt-1 max-w-[200px]">Recommended: 1200 x 630 pixels</span>
                  </div>
                )}

                {/* Overlay upload options inside preview */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-300">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-foreground text-background text-[11px] font-bold hover:opacity-90 transition-opacity"
                  >
                    {settings.socialImageUrl ? "Replace Image" : "Upload Image"}
                  </button>
                  {settings.socialImageUrl && (
                    <button
                      onClick={() => handleInputChange("socialImageUrl", null)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                      title="Remove Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Text metadata block below image */}
              <div className="p-4 border-t border-foreground/5 space-y-1 bg-[#1A1A1A]/90">
                <span className="text-[9px] font-bold tracking-widest text-foreground/35 uppercase font-inter block">
                  WWW.ZICABELLA.COM
                </span>
                <h3 className="text-[13px] font-bold text-foreground/80 line-clamp-1 font-inter">
                  {settings.homePageTitle || "Zica Bella | Luxury Indian Streetwear"}
                </h3>
                <p className="text-[11px] text-foreground/45 line-clamp-2 leading-normal">
                  {settings.metaDescription || "Zica Bella crafts luxury Indian streetwear for modern men, oversized heavyweight tees, acid-wash finishes, cargos and modern denim."}
                </p>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 hover:bg-foreground/[0.02] flex flex-col items-center justify-center gap-2 ${
                uploading ? "opacity-50 pointer-events-none" : ""
              } ${settings.socialImageUrl ? "border-foreground/10" : "border-foreground/20 hover:border-foreground/40"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                className="hidden"
              />
              {uploading ? (
                <Loader2 className="w-8 h-8 text-foreground/60 animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8 text-foreground/40" />
              )}
              <span className="text-[12px] font-semibold text-foreground/75 font-inter">
                {uploading ? "Processing Image..." : "Drag & drop image here or click to browse"}
              </span>
              <span className="text-[10px] text-foreground/40">
                JPG, PNG, or WebP. Max 5MB. Automatically cropped to 1200 x 630.
              </span>
            </div>
          </div>
        </div>

        {/* Right Card: SEO fields form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass rounded-[2rem] border border-foreground/5 p-6 space-y-6">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-foreground/75 font-inter">
              SEO Tag Management
            </h2>

            <div className="space-y-6">
              {/* Home Page Title Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="homePageTitle" className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 font-inter">
                    Homepage Meta Title
                  </label>
                  <span className={`text-[10px] font-mono ${titleLength > 70 ? "text-rose-500 font-bold" : "text-foreground/40"}`}>
                    {titleLength} of 70 characters used
                  </span>
                </div>
                <input
                  id="homePageTitle"
                  type="text"
                  placeholder="Enter a descriptive SEO title..."
                  value={settings.homePageTitle}
                  onChange={(e) => handleInputChange("homePageTitle", e.target.value)}
                  className={`w-full bg-[#141414]/90 border rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/20 font-inter transition-all duration-300 ${
                    titleLength > 70 ? "border-rose-500/50 focus:ring-rose-500/30" : "border-foreground/10 focus:border-foreground/20"
                  }`}
                />
                {titleLength > 70 && (
                  <p className="text-[10px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Recommended limit exceeded. Search engines may truncate this text.
                  </p>
                )}
              </div>

              {/* Meta Description Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="metaDescription" className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 font-inter">
                    Homepage Meta Description
                  </label>
                  <span className={`text-[10px] font-mono ${descLength > 320 ? "text-rose-500 font-bold" : "text-foreground/40"}`}>
                    {descLength} of 320 characters used
                  </span>
                </div>
                <textarea
                  id="metaDescription"
                  rows={5}
                  placeholder="Enter a brief summary of your shop for search results..."
                  value={settings.metaDescription}
                  onChange={(e) => handleInputChange("metaDescription", e.target.value)}
                  className={`w-full bg-[#141414]/90 border rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/20 font-inter transition-all duration-300 resize-none ${
                    descLength > 320 ? "border-rose-500/50 focus:ring-rose-500/30" : "border-foreground/10 focus:border-foreground/20"
                  }`}
                />
                {descLength > 320 && (
                  <p className="text-[10px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Recommended limit exceeded. Search engines may truncate this description.
                  </p>
                )}
              </div>

              {/* Social Image Alt Text */}
              {settings.socialImageUrl && (
                <div className="space-y-2">
                  <label htmlFor="socialImageAlt" className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 font-inter">
                    Social Sharing Image Alt Text
                  </label>
                  <input
                    id="socialImageAlt"
                    type="text"
                    placeholder="Describe this image for screen readers..."
                    value={settings.socialImageAlt || ""}
                    onChange={(e) => handleInputChange("socialImageAlt", e.target.value)}
                    className="w-full bg-[#141414]/90 border border-foreground/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/20 font-inter transition-all duration-300 focus:border-foreground/20"
                  />
                </div>
              )}

              {/* Twitter Card Type */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="twitterCardType" className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 font-inter">
                    Twitter Card Format
                  </label>
                  <div className="group relative">
                    <HelpCircle className="w-3.5 h-3.5 text-foreground/30 hover:text-foreground/60 cursor-pointer" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-[#1A1A1A] border border-foreground/10 rounded-lg shadow-xl text-[10px] text-foreground/65 hidden group-hover:block z-10 leading-normal">
                      Specifies whether Twitter displays a large full-width image or a small icon next to the link.
                    </div>
                  </div>
                </div>
                <select
                  id="twitterCardType"
                  value={settings.twitterCardType}
                  onChange={(e) => handleInputChange("twitterCardType", e.target.value)}
                  className="w-full bg-[#141414]/90 border border-foreground/10 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 font-inter transition-all duration-300 focus:border-foreground/20"
                >
                  <option value="summary_large_image">Large Image Preview (Default)</option>
                  <option value="summary">Small Square Image Preview</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 left-6 right-6 lg:left-80 z-50 flex items-center justify-between bg-black/60 dark:bg-[#0c0c0c]/85 border border-foreground/10 rounded-2xl px-6 py-4 backdrop-blur-lg shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-[12px] font-medium text-foreground/75 font-inter">
                Unsaved preferences changes
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="px-4 py-2 text-[11px] font-bold text-foreground/50 hover:text-foreground hover:bg-foreground/5 rounded-xl border border-foreground/5 transition-colors duration-300 disabled:opacity-40"
              >
                <span className="flex items-center gap-1"><Undo className="w-3.5 h-3.5" /> Discard</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-[11px] font-bold bg-foreground text-background hover:opacity-90 rounded-xl transition-all duration-300 flex items-center gap-1.5 shadow-md shadow-foreground/5 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving ? "Saving..." : "Save Preferences"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
