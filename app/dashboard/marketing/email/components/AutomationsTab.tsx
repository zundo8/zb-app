'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ACTIVE_TRIGGERS } from '@/lib/email-templates/triggers';

/**
 * Automations Tab — a consolidated view of all automation triggers and
 * which email template (if any) is currently mapped to each.
 *
 * This is a read/write view over existing `/api/email/templates` data —
 * no new backend routes are needed.
 */
export default function AutomationsTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<string | null>(null); // trigger value being reassigned
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Map trigger value → template (if any)
  const triggerMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const t of templates) {
      if (t.automationTrigger) {
        map[t.automationTrigger] = t;
      }
    }
    return map;
  }, [templates]);

  // Templates eligible for reassignment (have HTML body)
  const eligibleTemplates = useMemo(
    () => templates.filter(t => t.htmlBody),
    [templates]
  );

  const handleToggleActive = async (template: any) => {
    setTogglingId(template.id);
    try {
      const res = await fetch(`/api/email/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          isActive: !template.isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Template ${!template.isActive ? 'activated' : 'deactivated'}`);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to toggle');
      }
    } catch {
      toast.error('Failed to toggle template status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleReassign = async (triggerValue: string, templateId: string) => {
    if (!templateId) return;
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;
      const res = await fetch(`/api/email/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          automationTrigger: triggerValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Trigger reassigned to "${template.name}"`);
        setReassigning(null);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to reassign');
      }
    } catch {
      toast.error('Failed to reassign trigger');
    }
  };

  const unmappedTriggers = ACTIVE_TRIGGERS.filter(t => !triggerMap[t.value]);

  return (
    <div className="space-y-8">
      {/* Unmapped triggers warning */}
      {!loading && unmappedTriggers.length > 0 && (
        <div className="p-4 bg-amber-50/80 dark:bg-amber-500/[0.08] border border-amber-200 dark:border-amber-500/20 rounded-xl">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
            <span>⚠</span> {unmappedTriggers.length} Unmapped Trigger{unmappedTriggers.length > 1 ? 's' : ''}
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400/80 leading-relaxed mb-2">
            The following lifecycle events have no email template mapped. When these events occur, no automated email will be sent.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unmappedTriggers.map(t => (
              <span key={t.value} className="text-[10px] font-mono bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                {t.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trigger → Template mapping cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-black dark:text-white">Automation Triggers</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {ACTIVE_TRIGGERS.length} triggers · {ACTIVE_TRIGGERS.length - unmappedTriggers.length} mapped
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-black/[0.02] dark:bg-white/5 animate-pulse rounded-xl border border-black/10 dark:border-white/10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACTIVE_TRIGGERS.map(trigger => {
              const mapped = triggerMap[trigger.value];
              const isMapped = !!mapped;

              return (
                <div
                  key={trigger.value}
                  className={`bg-white dark:bg-white/5 border rounded-xl p-5 flex flex-col shadow-sm transition-all ${
                    isMapped
                      ? 'border-black/10 dark:border-white/10'
                      : 'border-amber-300/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/[0.03]'
                  }`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded tracking-wide">
                          {trigger.value}
                        </span>
                        {isMapped ? (
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                            Mapped
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                            Unmapped
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-black dark:text-white">{trigger.label}</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{trigger.description}</p>
                    </div>

                    {/* Active toggle (only if mapped) */}
                    {isMapped && (
                      <button
                        onClick={() => handleToggleActive(mapped)}
                        disabled={togglingId === mapped.id}
                        title={mapped.isActive !== false ? 'Deactivate automation' : 'Activate automation'}
                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3 ${
                          mapped.isActive !== false ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                        } ${togglingId === mapped.id ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            mapped.isActive !== false ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Mapped template info */}
                  {isMapped ? (
                    <div className="mt-auto space-y-3">
                      <div className="bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Template</p>
                        <p className="text-sm font-medium text-black dark:text-white truncate">{mapped.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{mapped.subject}</p>
                        {mapped.isActive === false && (
                          <span className="inline-block mt-1.5 text-[9px] bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                            Inactive — emails won&apos;t send
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setReassigning(reassigning === trigger.value ? null : trigger.value)}
                          className="flex-1 border border-black/15 dark:border-white/15 hover:bg-black/[0.03] dark:hover:bg-white/5 text-gray-700 dark:text-white text-xs py-2 rounded-lg transition font-medium"
                        >
                          {reassigning === trigger.value ? 'Cancel' : 'Reassign'}
                        </button>
                      </div>

                      {/* Reassign dropdown */}
                      {reassigning === trigger.value && (
                        <div className="mt-1">
                          <select
                            defaultValue=""
                            onChange={e => handleReassign(trigger.value, e.target.value)}
                            className="w-full bg-white dark:bg-[#151515] border border-black/15 dark:border-white/15 rounded-lg p-2 text-black dark:text-white text-xs outline-none"
                          >
                            <option value="" disabled>
                              Select a template…
                            </option>
                            {eligibleTemplates.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} {t.id === mapped.id ? '(current)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-auto space-y-3">
                      <div className="bg-amber-50/50 dark:bg-amber-500/[0.05] border border-amber-200/50 dark:border-amber-500/10 rounded-lg p-3 text-center">
                        <p className="text-[11px] text-amber-600 dark:text-amber-400/70">
                          No template mapped — this event currently sends nothing.
                        </p>
                      </div>
                      <div>
                        <select
                          defaultValue=""
                          onChange={e => handleReassign(trigger.value, e.target.value)}
                          className="w-full bg-white dark:bg-[#151515] border border-black/15 dark:border-white/15 rounded-lg p-2 text-black dark:text-white text-xs outline-none"
                        >
                          <option value="" disabled>
                            Assign a template…
                          </option>
                          {eligibleTemplates.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
