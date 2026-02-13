
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  onFooterClick?: () => void;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, onFooterClick, onLogout }) => {
  return (
    <div className="min-h-[100dvh] flex flex-col max-w-md mx-auto bg-white shadow-2xl relative overflow-x-hidden">
      {title && (
        <header className="sticky top-0 z-50 bg-blue-600 text-white px-6 py-5 flex items-center justify-between shadow-xl safe-top">
          <h2 className="text-base font-black tracking-tight truncate select-none cursor-default">
            {title}
          </h2>
          <div className="flex items-center gap-3">
            {onLogout && (
              <button 
                onClick={onLogout}
                className="p-1.5 hover:bg-white/10 active:scale-90 rounded-lg transition-all"
                title="退出登录"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400/40"></div>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1 p-6 pb-40">
        {children}
      </main>
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-gray-100 px-4 py-4 safe-bottom text-center z-40">
        <p 
          onClick={onFooterClick}
          className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] cursor-pointer active:text-blue-200 transition-colors py-2"
        >
          智学练测·广东中考历史 V0.4 • 管理终端增强
        </p>
      </footer>
    </div>
  );
};
