
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  return (
    <div className="min-h-[100dvh] flex flex-col max-w-md mx-auto bg-white shadow-2xl relative overflow-x-hidden">
      {title && (
        <header className="sticky top-0 z-50 bg-blue-600 text-white px-6 py-5 flex items-center justify-between shadow-xl safe-top">
          <h1 className="text-base font-black tracking-tight truncate">{title}</h1>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400/40"></div>
          </div>
        </header>
      )}
      <main className="flex-1 p-6 pb-40">
        {children}
      </main>
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-gray-100 px-4 py-4 safe-bottom text-center z-40">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">
          智学练测·广东中考历史 V0.2 • 智能驱动
        </p>
      </footer>
    </div>
  );
};
