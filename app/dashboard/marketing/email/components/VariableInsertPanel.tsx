'use client';

import { useCallback } from 'react';
import {
  EMAIL_VARIABLES,
  getVariableGroups,
  getVariablesByGroup,
} from '@/lib/email-templates/variables';

/**
 * A grouped, clickable variable-picker panel for template authoring.
 *
 * Shows all available email variables as chips grouped by category.
 * Clicking a chip inserts {{key}} at the textarea's cursor position
 * (or appends at the end if cursor position isn't available).
 *
 * This is distinct from VariableSubstitutionPanel, which lets the user
 * *fill in values* for variables already present in a template (used in
 * ComposeTab). This panel is for *inserting* new variable tokens while
 * editing HTML.
 */
export default function VariableInsertPanel({
  textareaRef,
  onInsert,
}: {
  /** Ref to the HTML textarea element for cursor-position insertion */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Called after a variable is inserted, with the updated full text value */
  onInsert: (newValue: string) => void;
}) {
  const groups = getVariableGroups();

  const handleInsert = useCallback(
    (key: string) => {
      const tag = `{{${key}}}`;
      const textarea = textareaRef.current;

      if (textarea) {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        const newValue = before + tag + after;
        onInsert(newValue);

        // Restore focus & cursor position after the inserted tag
        requestAnimationFrame(() => {
          textarea.focus();
          const newCursor = start + tag.length;
          textarea.setSelectionRange(newCursor, newCursor);
        });
      } else {
        // Fallback: can't access textarea, just append
        onInsert(tag);
      }
    },
    [textareaRef, onInsert]
  );

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-xl bg-black/[0.01] dark:bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-black/10 dark:border-white/10 bg-gray-50 dark:bg-black/30">
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[2px]">
          Insert Variable
        </span>
      </div>
      <div className="p-3 space-y-3 max-h-[280px] overflow-y-auto">
        {groups.map((group) => {
          const vars = getVariablesByGroup(group);
          return (
            <div key={group}>
              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[1.5px] mb-1.5 block">
                {group}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleInsert(v.key)}
                    title={`Insert {{${v.key}}} — ${v.label}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono
                      bg-black/[0.04] dark:bg-white/[0.07]
                      border border-black/[0.06] dark:border-white/[0.08]
                      text-gray-700 dark:text-gray-300
                      hover:bg-black/[0.08] dark:hover:bg-white/[0.12]
                      hover:border-black/15 dark:hover:border-white/20
                      active:scale-[0.97]
                      transition-all duration-100 cursor-pointer select-none"
                  >
                    <span className="text-gray-400 dark:text-gray-500">{'{'}{'{'}​</span>
                    <span>{v.key}</span>
                    <span className="text-gray-400 dark:text-gray-500">​{'}'}{'}'}​</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
