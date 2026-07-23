'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ComposeTab from './components/ComposeTab';
import TemplatesTab from './components/TemplatesTab';
import SentTab from './components/SentTab';
import AutomationsTab from './components/AutomationsTab';

function EmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const currentTab = searchParams.get('tab') || 'compose';

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white font-heading">Email Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and send marketing or transactional emails.</p>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-black/10 dark:border-white/10">
        {['compose', 'templates', 'automations', 'sent'].map((tab) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              currentTab === tab
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-black/30 dark:hover:border-white/30'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {currentTab === 'compose' && <ComposeTab />}
        {currentTab === 'templates' && <TemplatesTab />}
        {currentTab === 'automations' && <AutomationsTab />}
        {currentTab === 'sent' && <SentTab />}
      </div>
    </div>
  );
}

export default function EmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-black dark:text-white">Loading...</div>}>
      <EmailPageContent />
    </Suspense>
  );
}
