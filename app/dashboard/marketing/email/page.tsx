'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ComposeTab from './components/ComposeTab';
import TemplatesTab from './components/TemplatesTab';
import SentTab from './components/SentTab';

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
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Email Center</h1>
          <p className="text-sm text-gray-400 mt-1">Manage and send marketing or transactional emails.</p>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-white/10">
        {['compose', 'templates', 'sent'].map((tab) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              currentTab === tab
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-white hover:border-white/30'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {currentTab === 'compose' && <ComposeTab />}
        {currentTab === 'templates' && <TemplatesTab />}
        {currentTab === 'sent' && <SentTab />}
      </div>
    </div>
  );
}

export default function EmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading...</div>}>
      <EmailPageContent />
    </Suspense>
  );
}
