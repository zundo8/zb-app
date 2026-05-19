'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import TemplatePreviewModal from './TemplatePreviewModal';

const AUTOMATION_TRIGGERS = [
  { value: '', label: 'None (Manual Send Only)' },
  { value: 'ORDER_CONFIRMATION', label: 'Order Confirmation (Auto-send on Place)' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancelled (Auto-send on Cancel)' },
  { value: 'PAYMENT_FAILED', label: 'Payment Failed (Auto-send on Failure)' },
  { value: 'WELCOME', label: 'Welcome Email (Auto-send on Signup)' },
  { value: 'ORDER_SHIPPED', label: 'Order Shipped (Auto-send on Shipped)' },
  { value: 'ORDER_DELIVERED', label: 'Order Delivered (Auto-send on Delivery)' },
  { value: 'RETURN_REFUND', label: 'Return & Refund (Auto-send on Refund)' },
  { value: 'PASSWORD_RESET', label: 'Password Reset (Auto-send on Reset Request)' },
];

export default function TemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'transactional', subject: '', htmlBody: '', automationTrigger: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', category: 'transactional', subject: '', htmlBody: '', automationTrigger: '' });
  const [isUpdating, setIsUpdating] = useState(false);

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
        setForm({ name: '', category: 'transactional', subject: '', htmlBody: '', automationTrigger: '' });
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

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/email/templates/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Template updated successfully');
        setShowEditModal(false);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to update template');
      }
    } catch (error) {
      toast.error('Failed to update template');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-black dark:text-white">Email Templates</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-md font-medium text-sm hover:bg-black/80 dark:hover:bg-gray-200 transition shadow-sm"
        >
          + Add Template
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-black/[0.02] dark:bg-white/5 animate-pulse rounded-xl border border-black/10 dark:border-white/10" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-base font-medium text-black dark:text-white truncate">{t.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.category === 'marketing' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'}`}>
                    {t.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-4">{t.subject}</p>
                
                {t.automationTrigger && (
                  <div className="mb-4">
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1 border border-emerald-200/50 dark:border-transparent">
                      ⚡ Trigger: {t.automationTrigger}
                    </span>
                  </div>
                )}

                {t.variables && t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {t.variables.map((v: string) => (
                      <span key={v} className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleUseTemplate(t.id)}
                  className="flex-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white text-sm py-2 rounded transition font-medium border border-black/[0.05] dark:border-none"
                >
                  Use
                </button>
                <button
                  onClick={() => {
                    setEditForm({
                      id: t.id,
                      name: t.name,
                      category: t.category || 'transactional',
                      subject: t.subject || '',
                      htmlBody: t.htmlBody || '',
                      automationTrigger: t.automationTrigger || ''
                    });
                    setShowEditModal(true);
                  }}
                  className="flex-1 border border-black/20 dark:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/5 text-gray-700 dark:text-white text-sm py-2 rounded transition font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => setPreviewTemplate(t)}
                  className="flex-1 border border-black/20 dark:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/5 text-gray-700 dark:text-white text-sm py-2 rounded transition font-medium"
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
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="p-5 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-transparent">
              <h2 className="text-lg font-medium text-black dark:text-white">Add Custom Template</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleCreateTemplate} className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none"
                  placeholder="e.g. Black Friday Sale"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none"
                  >
                    <option value="transactional">Transactional</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Automation Trigger</label>
                  <select
                    value={form.automationTrigger}
                    onChange={e => setForm({...form, automationTrigger: e.target.value})}
                    className="w-full bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none"
                  >
                    {AUTOMATION_TRIGGERS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subject</label>
                <input
                  required
                  value={form.subject}
                  onChange={e => setForm({...form, subject: e.target.value})}
                  className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none"
                  placeholder="e.g. Your exclusive access"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">HTML Body</label>
                <textarea
                  required
                  rows={10}
                  value={form.htmlBody}
                  onChange={e => setForm({...form, htmlBody: e.target.value})}
                  className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-3 text-black dark:text-white text-sm font-mono focus:border-black/30 dark:focus:border-white/30 outline-none"
                  placeholder="Paste your raw HTML here..."
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">Cancel</button>
                <button disabled={isSaving} type="submit" className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-black/80 dark:hover:bg-gray-200 transition shadow-md">
                  {isSaving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (Side-by-Side Premium Live Editor) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0c0c0c] border border-black/15 dark:border-white/15 rounded-2xl w-full max-w-7xl h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-black/30">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-white">Edit Template</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Refine and map your automation template in real-time</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="text-gray-400 hover:text-black dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 p-2 rounded-full transition"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column - Form Control (50%) */}
              <form onSubmit={handleUpdateTemplate} className="w-full md:w-1/2 p-6 overflow-y-auto space-y-4 border-r border-black/10 dark:border-white/10">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Name</label>
                    <input
                      required
                      value={editForm.name}
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2.5 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/20 outline-none transition"
                      placeholder="e.g. Order Confirmation Template"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Category</label>
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm({...editForm, category: e.target.value})}
                      className="w-full bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 rounded-lg p-2.5 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none transition"
                    >
                      <option value="transactional">Transactional</option>
                      <option value="marketing">Marketing</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Automation Trigger</label>
                  <select
                    value={editForm.automationTrigger}
                    onChange={e => setEditForm({...editForm, automationTrigger: e.target.value})}
                    className="w-full bg-white dark:bg-[#151515] border border-black/15 dark:border-white/15 rounded-lg p-2.5 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none transition font-medium"
                  >
                    {AUTOMATION_TRIGGERS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Mapping a trigger replaces any previously mapped template for that trigger.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Subject</label>
                  <input
                    required
                    value={editForm.subject}
                    onChange={e => setEditForm({...editForm, subject: e.target.value})}
                    className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2.5 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 focus:ring-1 focus:ring-black/20 outline-none transition"
                    placeholder="Subject line"
                  />
                </div>

                <div className="flex-1 flex flex-col min-h-[350px]">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">HTML Code</label>
                    <span className="text-[10px] text-gray-400 font-mono">Real-time Sandbox Enabled</span>
                  </div>
                  <textarea
                    required
                    value={editForm.htmlBody}
                    onChange={e => setEditForm({...editForm, htmlBody: e.target.value})}
                    className="w-full flex-1 bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-3 text-black dark:text-white text-xs font-mono focus:border-black/30 dark:focus:border-white/30 outline-none min-h-[350px] resize-y"
                    placeholder="Write or paste your custom HTML template body here..."
                  />
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t border-black/10 dark:border-white/10 sticky bottom-0 bg-white dark:bg-[#0c0c0c] z-10">
                  <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition">Cancel</button>
                  <button disabled={isUpdating} type="submit" className="bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-black/80 dark:hover:bg-gray-200 transition shadow-lg flex items-center gap-2">
                    {isUpdating ? 'Saving Changes...' : 'Save & Map Trigger'}
                  </button>
                </div>
              </form>

              {/* Right Column - Live sandboxed iframe preview (50%) */}
              <div className="w-full md:w-1/2 bg-gray-50 dark:bg-black/45 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Live Sandbox Preview</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Active Render</span>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl border border-black/10 dark:border-white/15 overflow-hidden shadow-sm flex">
                  {editForm.htmlBody ? (
                    <iframe
                      title="Email Live Preview"
                      sandbox="allow-same-origin"
                      srcDoc={
                        editForm.htmlBody
                          .replace(/\{\{customerName\}\}/g, 'Aria')
                          .replace(/\{\{orderId\}\}/g, 'ZB-10294')
                          .replace(/\{\{totalPrice\}\}/g, '₹4,500')
                          .replace(/\{\{itemsHtml\}\}/g, `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(255,255,255,0.15); border-radius:2px; overflow:hidden; margin-bottom: 15px;">
          <tr>
            <td class="item-img" width="110" style="vertical-align:top; padding:0;">
              <img src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=220&q=80&auto=format&fit=crop" width="110" height="130" style="display:block; object-fit:cover; opacity:0.8;" alt="Mock Product" />
            </td>
            <td style="vertical-align:top; padding:20px 20px 20px 22px; border-left:1px solid rgba(255,255,255,0.1);">
              <p style="margin:0 0 4px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.3); text-transform:uppercase;">Qty: 1</p>
              <p style="margin:0 0 6px; font-family:'DM Serif Display',serif; font-size:17px; color:rgba(255,255,255,0.7); line-height:1.3;">Oversized Obsidian Blazer</p>
              <p style="margin:0 0 14px; font-family:'DM Mono',monospace; font-size:10px; color:rgba(255,255,255,0.3);">Size: M</p>
              <p style="margin:0; font-family:'DM Mono',monospace; font-size:12px; color:rgba(255,255,255,0.5);">₹4,500</p>
            </td>
          </tr>
        </table>
                          `)
                          .replace(/\{\{collectionName\}\}/g, 'Midnight Mirage')
                      }
                      className="w-full h-full border-none bg-white"
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                      <svg className="w-12 h-12 stroke-current opacity-40" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-xs font-medium uppercase tracking-wider">Type HTML to start previewing</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
