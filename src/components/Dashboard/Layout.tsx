import React from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', background: '#111112' }}>
      {/* Sidebar placeholder - will be replaced with Sidebar component */}
      <aside style={{ width: 320, minWidth: 320, maxWidth: 320, background: '#000000', height: '100vh', overflowY: 'auto', borderRight: '1px solid #232323', boxShadow: '2px 0 8px 0 rgba(0,0,0,0.08)', zIndex: 10, color: '#FFFFFF' }} />
      <main style={{ flex: 1, minWidth: 0, background: '#18181b', padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
} 
