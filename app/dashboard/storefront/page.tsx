"use client";

import { useState, useEffect } from 'react';
import {
  Save, CheckCircle, RefreshCw,
  Layout, ImageIcon, Video, Monitor, Globe, Navigation,
  Sparkles, Layers, MessageSquare, Info, Loader2, Upload, X
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsData {
  id: string;
  shopDomain: string;
  heroImage: string;
  heroVideo: string;
  heroTitle: string;
  heroSubtitle: string;
  heroButtonText: string;
  latestCurationTitle: string;
  latestCurationSubtitle: string;
  archiveTitle: string;
  archiveSubtitle: string;
  blueprintTitle: string;
  blueprintSubtitle: string;
  showProductVideo: boolean;
  showSizeChart: boolean;
  showBrand: boolean;
  showShippingReturn: boolean;
  showCare: boolean;
  showSizeFit: boolean;
  showDetails: boolean;
  pdpBackground: string;
  instagramUrl: string;
  appleUrl: string;
  spotifyUrl: string;
  youtubeUrl: string;
  showHeroText: boolean;
  showLatestCuration: boolean;
  showArchive: boolean;
  showBlueprint: boolean;
  featuredMedia: string;
  featuredMediaImage: string;
  collectionsMedia: string;
  footerVideo: string;
  mainMenuHandle: string;
  secondaryMenuHandle: string;
  showTreeText: boolean;
  kineticMeshProducts: string;
  showCommunity: boolean;
  communityTitle: string;
  communitySubtitle: string;
  spotlightTitle: string;
  spotlightSubtitle: string;
  spotlightCollection: string;
  spotlightProducts: string;
  kineticMeshTitle: string;
  enabledCollectionsHeader: string;
  enabledCollectionsPage: string;
  enabledCollectionsMenu: string;
  flipbookImage: string;
  flipbookVideo: string;
  flipbookTitle: string;
  flipbookTag: string;
  flipbookDesc: string;
  showRingCarousel: boolean;
  ringCarouselTitle: string;
  ringCarouselItems: string;
  footerLogo3dUrl: string;
}

function SettingsRow({
  label,
  children,
  icon: Icon,
  description
}: {
  label: string;
  children: React.ReactNode;
  icon?: any;
  description?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between py-5 border-b border-foreground/[0.05] last:border-0 gap-4 md:gap-0">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="w-8 h-8 rounded-md bg-foreground/[0.02] flex items-center justify-center text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 border border-foreground/[0.05]">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-[12px] font-medium text-foreground tracking-tight mb-0.5">{label}</span>
          {description && <span className="text-[9px] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">{description}</span>}
        </div>
      </div>
      <div className="flex-1 w-full md:max-w-md flex justify-end">
        {children}
      </div>
    </div>
  );
}

function InputField({
  value,
  onChange,
  placeholder,
  className
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-foreground/[0.02] px-3 py-2.5 rounded-md border border-foreground/[0.05] focus:border-foreground/20 text-right text-[11px] font-medium text-foreground placeholder:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30 outline-none transition-colors ${className}`}
    />
  );
}

function SettingsGroup({ title, children, icon: Icon }: { title?: string; children: React.ReactNode; icon?: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="space-y-4 relative z-10"
    >
      {title && (
        <div className="flex items-center gap-2 px-6">
           {Icon && <Icon className="w-3.5 h-3.5 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40" />}
           <h3 className="text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50">{title}</h3>
        </div>
      )}
      <div className="bg-background border border-foreground/[0.05] rounded-xl px-6 py-2 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
           {children}
        </div>
      </div>
    </motion.div>
  );
}

function ToggleField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-foreground' : 'bg-foreground/10'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

function MediaPicker({
  value,
  onChange,
  label,
  type = 'image'
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  type?: 'image' | 'video';
}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={`https://... or upload ${type}`}
          className="flex-1 bg-foreground/[0.02] px-3 py-2.5 rounded-md border border-foreground/[0.05] focus:border-foreground/20 text-right text-[11px] font-medium text-foreground placeholder:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/50 dark:text-foreground/30 outline-none transition-colors"
        />
        <label className="shrink-0 flex items-center justify-center w-10 h-10 rounded-md bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors">
          {isUploading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40" />
          ) : (
            <Upload className="w-4 h-4 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40" />
          )}
          <input type="file" className="hidden" accept={type === 'image' ? "image/*" : "video/*"} onChange={handleUpload} />
        </label>
      </div>
      {value && (
        <div className="relative aspect-video w-full rounded-md overflow-hidden bg-foreground/[0.03] border border-foreground/[0.05]">
          {type === 'image' ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <video src={value} className="w-full h-full object-cover" muted />
          )}
          <button 
            onClick={() => onChange('')}
            className="absolute top-1 right-1 p-1 rounded-full bg-background/50 text-white hover:bg-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

const safeParseArray = (val: any) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export default function StorefrontSettingsPage() {
  const [settings, setSettings] = useState<Partial<SettingsData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allCollections, setAllCollections] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });

    fetch('/api/shopify/products?pageSize=250')
      .then(r => r.json())
      .then(data => data.products && setAllProducts(data.products));

    fetch('/api/shopify/collections')
      .then(r => r.json())
      .then(data => Array.isArray(data) && setAllCollections(data));
  }, []);

  const handleSave = async () => {
    if (saving) return; 
    setSaving(true);
    setSaveStatus('idle');

    const storefrontKeys: (keyof SettingsData)[] = [
        'heroImage', 'heroVideo', 'heroTitle', 'heroSubtitle', 'heroButtonText',
        'latestCurationTitle', 'latestCurationSubtitle', 'archiveTitle', 'archiveSubtitle',
        'blueprintTitle', 'blueprintSubtitle', 'showHeroText', 'showLatestCuration',
        'showArchive', 'showBlueprint', 'showProductVideo', 'showSizeChart',
        'showBrand', 'showShippingReturn', 'showCare', 'showSizeFit', 'showDetails',
        'pdpBackground', 'instagramUrl', 'appleUrl', 'spotifyUrl', 'youtubeUrl',
        'featuredMedia', 'featuredMediaImage', 'collectionsMedia', 'footerVideo',
        'mainMenuHandle', 'secondaryMenuHandle', 'showTreeText', 'showCommunity',
        'communityTitle', 'communitySubtitle', 'spotlightTitle', 'spotlightSubtitle',
        'spotlightCollection', 'spotlightProducts',
        'kineticMeshTitle', 'kineticMeshProducts', 'enabledCollectionsHeader', 
        'enabledCollectionsPage', 'enabledCollectionsMenu',
        'flipbookImage', 'flipbookVideo', 'flipbookTitle', 'flipbookTag', 'flipbookDesc',
        'showRingCarousel', 'ringCarouselTitle', 'ringCarouselItems', 'footerLogo3dUrl'
    ];

    const partialUpdate: any = { shopId: settings.id };
    storefrontKeys.forEach(key => {
        if (settings[key] !== undefined) partialUpdate[key] = settings[key];
    });

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialUpdate),
      });
      if (!res.ok) throw new Error('Update failed');
      setSaveStatus('success');
    } catch (err: any) {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  const set = (key: keyof SettingsData) => (value: any) => setSettings(prev => ({ ...prev, [key]: value }));

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-5 h-5 text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40 animate-spin" />
      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/80 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/80 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/60 dark:text-foreground/40">Loading Storefront...</span>
    </div>
  );

   return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto space-y-10 pb-20 relative z-10"
    >
      
      {/* Header */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2 pt-4 relative z-10">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Storefront
          </h1>
          <p className="text-[11px] text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 tracking-wide max-w-xl">
            Content curation and visual configuration.
          </p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-[10px] font-medium tracking-[0.15em] uppercase transition-all ${
            saveStatus === 'success' ? 'bg-green-500 text-white' : 'bg-foreground text-background hover:opacity-90'
          } disabled:opacity-50`}
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved' : 'Save Config'}
        </button>
      </div>

       <div className="grid grid-cols-1 gap-8">
        
        {/* Cinematic Assets */}
        <SettingsGroup title="Media Assets" icon={Layers}>
          <SettingsRow label="Hero Image" icon={ImageIcon} description="Main landing image link">
             <MediaPicker value={settings.heroImage!} onChange={set('heroImage')} label="Hero Image" type="image" />
          </SettingsRow>
          <SettingsRow label="Hero Video" icon={Video} description="Hero background MP4 link">
             <MediaPicker value={settings.heroVideo!} onChange={set('heroVideo')} label="Hero Video" type="video" />
          </SettingsRow>
          <SettingsRow label="Footer Video" icon={Monitor} description="Footer video background">
             <MediaPicker value={settings.footerVideo!} onChange={set('footerVideo')} label="Footer Video" type="video" />
          </SettingsRow>
          <SettingsRow label="Featured Media" icon={ImageIcon} description="Image above Spotlight section">
             <MediaPicker value={settings.featuredMediaImage!} onChange={set('featuredMediaImage')} label="Featured Media Image" type="image" />
          </SettingsRow>
          <SettingsRow label="Footer 3D Logo" icon={Monitor} description="GLB model for footer logo">
             <InputField value={settings.footerLogo3dUrl!} onChange={set('footerLogo3dUrl')} placeholder="https://...glb" />
          </SettingsRow>
        </SettingsGroup>

        {/* Hero Narrative */}
        <SettingsGroup title="Hero Content" icon={MessageSquare}>
          <SettingsRow label="Main Title">
             <InputField value={settings.heroTitle!} onChange={set('heroTitle')} placeholder="e.g. Redefine The Standard" />
          </SettingsRow>
          <SettingsRow label="Subtitle">
             <InputField value={settings.heroSubtitle!} onChange={set('heroSubtitle')} placeholder="Atmospheric subtitle text" />
          </SettingsRow>
          <SettingsRow label="Button Text">
             <InputField value={settings.heroButtonText!} onChange={set('heroButtonText')} placeholder="CTA text (e.g. Discover)" />
          </SettingsRow>
          <SettingsRow label="Show Text" description="Toggle hero text visibility">
             <ToggleField checked={settings.showHeroText!} onChange={set('showHeroText')} />
          </SettingsRow>
        </SettingsGroup>

        {/* SPOTLIGHT SECTION */}
        <SettingsGroup title="Spotlight Section (Streetwear)" icon={Sparkles}>
          <div className="px-4 py-3 bg-foreground/[0.02] rounded-md border border-foreground/[0.05] flex items-center gap-3 mt-1">
             <Info className="w-4 h-4 text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 shrink-0" />
             <p className="text-[10px] font-medium text-foreground/70 uppercase tracking-widest">
                Configure the "Authentic Streetwear" grid.
             </p>
          </div>
          <SettingsRow label="Section Title">
             <InputField value={settings.spotlightTitle!} onChange={set('spotlightTitle')} placeholder="e.g. AUTHENTIC STREETWEAR" />
          </SettingsRow>
          <SettingsRow label="Subtitle">
             <InputField value={settings.spotlightSubtitle!} onChange={set('spotlightSubtitle')} placeholder="Supporting text..." />
          </SettingsRow>
          <SettingsRow label="Collection Handle" description="Shopify collection to show (e.g. tshirts)">
             <select 
               value={settings.spotlightCollection || ''} 
               onChange={e => set('spotlightCollection')(e.target.value)}
               className="w-full bg-foreground/[0.02] px-3 py-2.5 rounded-md border border-foreground/[0.05] focus:border-foreground/20 text-right text-[11px] font-medium text-foreground outline-none transition-colors"
             >
               <option value="">Select a collection</option>
               {allCollections.map(c => (
                 <option key={c.id} value={c.handle}>{c.title}</option>
               ))}
             </select>
          </SettingsRow>
          <SettingsRow label="Specific Products" description="Optional: Comma-separated Shopify IDs">
             <InputField value={settings.spotlightProducts!} onChange={set('spotlightProducts')} placeholder="GID1, GID2..." />
          </SettingsRow>
        </SettingsGroup>

        {/* 3D PAPER TEAR (FLIPBOOK) */}
        <SettingsGroup title="Feature Section" icon={Sparkles}>
          <div className="px-4 py-3 bg-foreground/[0.02] rounded-md border border-foreground/[0.05] flex items-center gap-3 mt-1">
             <Info className="w-4 h-4 text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 shrink-0" />
             <p className="text-[10px] font-medium text-foreground/70 uppercase tracking-widest">
                Configure the scroll reveal section.
             </p>
          </div>
          <SettingsRow label="Image URL" icon={ImageIcon} description="Main revealing image (used if no video)">
             <MediaPicker value={settings.flipbookImage!} onChange={set('flipbookImage')} label="Flipbook Image" type="image" />
          </SettingsRow>
          <SettingsRow label="Video URL" icon={Video} description="MP4 video for reveal (overrides image)">
             <MediaPicker value={settings.flipbookVideo!} onChange={set('flipbookVideo')} label="Flipbook Video" type="video" />
          </SettingsRow>
          <SettingsRow label="Label Tag" description="Small tag above title">
             <InputField value={settings.flipbookTag!} onChange={set('flipbookTag')} placeholder="e.g. Core Manifest" />
          </SettingsRow>
          <SettingsRow label="Title" description="Main large heading">
             <InputField value={settings.flipbookTitle!} onChange={set('flipbookTitle')} placeholder="e.g. Archival Vision" />
          </SettingsRow>
          <SettingsRow label="Description" description="Supporting technical text">
             <InputField value={settings.flipbookDesc!} onChange={set('flipbookDesc')} placeholder="Technical description..." />
          </SettingsRow>
        </SettingsGroup>

        {/* RING CAROUSEL */}
        <SettingsGroup title="Ring Collection Carousel" icon={Sparkles}>
          <div className="px-4 py-3 bg-foreground/[0.02] rounded-md border border-foreground/[0.05] flex items-center gap-3 mt-1">
             <Info className="w-4 h-4 text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 shrink-0" />
             <p className="text-[10px] font-medium text-foreground/70 uppercase tracking-widest">
                Configure the minimal ring carousel.
             </p>
          </div>
          <SettingsRow label="Show Carousel" description="Toggle visibility on storefront">
             <ToggleField checked={settings.showRingCarousel!} onChange={set('showRingCarousel')} />
          </SettingsRow>
          <SettingsRow label="Section Title" description="Heading above carousel">
             <InputField value={settings.ringCarouselTitle!} onChange={set('ringCarouselTitle')} placeholder="e.g. RING COLLECTION" />
          </SettingsRow>
          <SettingsRow label="Items JSON" description="Array of objects {id, image, link}">
             <InputField value={settings.ringCarouselItems!} onChange={set('ringCarouselItems')} placeholder='[{"id":"1","image":"..."}]' />
          </SettingsRow>
        </SettingsGroup>

        {/* Curation Visibility */}
        <SettingsGroup title="Section Visibility" icon={Layout}>
          <SettingsRow label="Latest Collections" description="Showcase latest curation grid">
             <ToggleField checked={settings.showLatestCuration!} onChange={set('showLatestCuration')} />
          </SettingsRow>
          <SettingsRow label="Archive" description="Enable portal to past collections">
             <ToggleField checked={settings.showArchive!} onChange={set('showArchive')} />
          </SettingsRow>
          <SettingsRow label="Blueprint" description="Product anatomy visual section">
             <ToggleField checked={settings.showBlueprint!} onChange={set('showBlueprint')} />
          </SettingsRow>
          <SettingsRow label="Community" description="Enable featured community looks">
             <ToggleField checked={settings.showCommunity!} onChange={set('showCommunity')} />
          </SettingsRow>
        </SettingsGroup>

        {/* Global Connectivity */}
        <SettingsGroup title="Social Links" icon={Globe}>
          <SettingsRow label="Instagram" description="Social redirection">
             <InputField value={settings.instagramUrl!} onChange={set('instagramUrl')} placeholder="https://instagram.com/..." />
          </SettingsRow>
          <SettingsRow label="Spotify" description="Audio link">
             <InputField value={settings.spotifyUrl!} onChange={set('spotifyUrl')} placeholder="https://open.spotify..." />
          </SettingsRow>
        </SettingsGroup>

        {/* Navigation Architecure */}
        <SettingsGroup title="Header Navigation" icon={Navigation}>
          <div className="pt-2 pb-4">
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest px-1">Selected Collections</p>
                   <span className="text-[9px] font-semibold text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 uppercase tracking-widest">{safeParseArray(settings.enabledCollectionsHeader).length} Collections</span>
                </div>
                <div className="flex flex-wrap gap-2">
                   {allCollections.map(c => {
                      const active = safeParseArray(settings.enabledCollectionsHeader).includes(c.handle);
                      return (
                         <button 
                            key={c.id}
                            onClick={() => {
                               const current = safeParseArray(settings.enabledCollectionsHeader);
                               const next = active ? current.filter((h: any) => h !== c.handle) : [...current, c.handle];
                               set('enabledCollectionsHeader')(JSON.stringify(next));
                            }}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest transition-colors border ${active ? 'bg-foreground text-background border-transparent' : 'bg-background text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50 border-foreground/[0.05] hover:border-foreground/20'}`}
                         >
                            {c.title}
                         </button>
                      );
                   })}
                </div>
             </div>
          </div>
        </SettingsGroup>

      </div>

      <div className="text-center pt-8">
         <div className="inline-flex items-center gap-2 px-4 py-2 border border-foreground/[0.05] rounded-md bg-background shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/70 dark:text-foreground/50">Storefront Active</span>
         </div>
      </div>
    </motion.div>
  );
}
