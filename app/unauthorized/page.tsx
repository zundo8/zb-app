import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 rounded-[2rem] border border-foreground/[0.06] shadow-2xl text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-foreground/60 text-sm">
            You do not have the required permissions to view this module. 
            If you believe this is an error, please contact your Super Admin.
          </p>
        </div>

        <div className="pt-4">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
