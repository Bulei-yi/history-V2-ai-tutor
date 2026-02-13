import React from 'react';
import knowledgeData from '../data/knowledgePoints.tsx';

interface ReviewPageProps {
  knowledgePointName: string;
  onBack: () => void;
}

export default function ReviewPage({ knowledgePointName, onBack }: ReviewPageProps) {
  const point = knowledgeData.knowledgePoints.find(p => p.name === knowledgePointName);

  if (!point) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="text-gray-500 font-bold mb-6">抱歉，暂未收录该知识点详情</p>
        <button onClick={onBack} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black">返回报告</button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-md mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={onBack} className="p-3 bg-gray-100 rounded-2xl active:scale-90 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-2xl font-black text-gray-900">🧠 知识点带背</h2>
        </div>

        <div className="bg-gradient-to-br from-white to-blue-50/30 p-8 rounded-[2.5rem] border-2 border-blue-50 shadow-sm space-y-8">
          <div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">核心要点</span>
            <h3 className="text-2xl font-black text-gray-900">{point.name}</h3>
          </div>

          <div className="space-y-6">
            <section>
              <h4 className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span> 概念解析
              </h4>
              <p className="text-gray-700 leading-relaxed font-medium">{point.easyExplain}</p>
            </section>

            <section>
              <h4 className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span> ⏱ 时间线
              </h4>
              <p className="text-indigo-900/80 font-bold bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">{point.timeline}</p>
            </section>

            <section>
              <h4 className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <span className="w-1.5 h-4 bg-red-500 rounded-full"></span> 记忆口诀
              </h4>
              <div className="bg-red-50 p-5 rounded-2xl border-2 border-red-100 border-dashed">
                <p className="text-red-700 font-black text-lg italic text-center">“{point.mnemonic}”</p>
              </div>
            </section>

            <section className="bg-gray-900 p-6 rounded-[2rem] text-white">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 opacity-60">10秒回忆测试</h4>
              <p className="text-[15px] font-bold leading-snug">{point.reviewQuestion}</p>
            </section>
          </div>
        </div>

        <button
          onClick={onBack}
          className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100 active:scale-[0.98] transition-all"
        >
          掌握了，返回报告
        </button>
      </div>
    </div>
  );
}