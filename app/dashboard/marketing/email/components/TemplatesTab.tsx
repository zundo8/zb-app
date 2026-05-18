'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import TemplatePreviewModal from './TemplatePreviewModal';

export default function TemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'transactional', subject: '', htmlBody: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleUseTemplate = (id: string) => {
    router.push(`?tab=compose&templateId=${id}`);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Template saved');
        setShowCreateModal(false);
        setForm({ name: '', category: 'transactional', subject: '', htmlBody: '' });
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to save template');
      }
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Email Templates</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-white text-black px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-200 transition"
        >
          + Add Template
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-white/5 animate-pulse rounded-xl border border-white/10" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-base font-medium text-white truncate">{t.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.category === 'marketing' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {t.category}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate mb-4">{t.subject}</p>
                
                {t.variables && t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {t.variables.map((v: string) => (
                      <span key={v} className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleUseTemplate(t.id)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white text-sm py-2 rounded transition"
                >
                  Use Template
                </button>
                <button
                  onClick={() => setPreviewTemplate(t)}
                  className="flex-1 border border-white/20 hover:bg-white/5 text-white text-sm py-2 rounded transition"
                >
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal 
          template={previewTemplate} 
          onClose={() => setPreviewTemplate(null)} 
          onUse={() => handleUseTemplate(previewTemplate.id)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-lg font-medium text-white">Add Custom Template</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleCreateTemplate} className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-white/30 outline-none"
                  placeholder="e.g. Black Friday Sale"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                <select
                  value={form.category}
                  onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-2 text-white text-sm focus:border-white/30 outline-none"
                >
                  <option value="transactional">Transactional</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Subject</label>
                <input
                  required
                  value={form.subject}
                  onChange={e => setForm({...form, subject: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-white/30 outline-none"
                  placeholder="e.g. Your exclusive access"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">HTML Body</label>
                <textarea
                  required
                  rows={10}
                  value={form.htmlBody}
                  onChange={e => setForm({...form, htmlBody: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm font-mono focus:border-white/30 outline-none"
                  placeholder="Paste your raw HTML here..."
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button disabled={isSaving} type="submit" className="bg-white text-black px-6 py-2 rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-gray-200 transition">
                  {isSaving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
