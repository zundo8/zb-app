'use client';

export default function TemplatePreviewModal({ template, onClose, onUse }: { template: any, onClose: () => void, onUse: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-[700px] flex flex-col h-[90vh] shadow-2xl">
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161616] rounded-t-2xl">
          <div>
            <h2 className="text-base font-medium text-black dark:text-white">{template.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{template.subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white p-2">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-black flex justify-center">
          <div className="bg-white w-[600px] max-w-full shadow-2xl overflow-hidden h-full">
            <iframe
              title="Template Preview"
              srcDoc={template.htmlBody}
              className="w-full h-full border-none"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-3 bg-gray-50 dark:bg-[#161616] rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
            Close
          </button>
          <button onClick={onUse} className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-lg font-bold text-sm hover:bg-black/80 dark:hover:bg-gray-200 transition shadow-md">
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );
}
