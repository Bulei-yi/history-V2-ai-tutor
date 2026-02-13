import React, { useState, useEffect } from 'react';
import { Question, GradingResult } from '../types.ts';

interface QuestionCardProps {
  question: Question & { hint?: string };
  userAnswer?: string;
  onAnswer: (ans: string) => void;
  showFeedback?: boolean;
  index?: number;
  aiGrading?: GradingResult;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  userAnswer, 
  onAnswer, 
  showFeedback,
  index,
  aiGrading
}) => {
  const [essayText, setEssayText] = useState(userAnswer || '');

  useEffect(() => {
    setEssayText(userAnswer || '');
  }, [userAnswer, question.id]);

  const renderMaterial = () => {
    if (!question.material) return null;
    let text = question.material;
    if (showFeedback && question.highlights) {
      question.highlights.forEach(phrase => {
        const regex = new RegExp(`(${phrase})`, 'gi');
        text = text.replace(regex, '<span class="bg-yellow-200 text-yellow-900 px-1 rounded font-bold underline decoration-yellow-500">$1</span>');
      });
    }
    return <div dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const isCorrect = userAnswer === question.answer;

  return (
    <div className={`space-y-5 animate-in fade-in duration-500 ${showFeedback ? 'bg-white p-6 rounded-[2.5rem] border-2 border-gray-50 shadow-sm mb-8' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-black">{question.region || '专家'}卷</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{question.type === 'choice' ? '选择题' : '材料题'}</span>
        </div>
        {showFeedback && (
          <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${isCorrect || question.type === 'material' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {question.type === 'choice' ? (isCorrect ? '正确' : '错误') : `得分: ${aiGrading?.score || 0}/${question.fullScore || 6}`}
          </span>
        )}
      </div>

      <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100">
        {question.material && (
          <div className="text-[15px] text-gray-600 mb-6 p-5 bg-white/80 rounded-2xl border border-gray-100/50 whitespace-pre-wrap leading-relaxed italic max-h-60 overflow-y-auto custom-scrollbar">
            {renderMaterial()}
          </div>
        )}
        <div className="text-[17px] leading-snug text-gray-800 font-bold">
          {question.stem}
        </div>
        {question.hint && !showFeedback && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
            <span className="text-[10px] font-black text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-100">作答提示</span>
            <p className="text-[12px] text-blue-800 font-medium italic">{question.hint}</p>
          </div>
        )}
      </div>

      {question.type === 'choice' && question.options && (
        <div className="grid grid-cols-1 gap-3">
          {question.options.map((opt, idx) => {
            const letter = opt.split('.')[0].trim();
            const isSelected = userAnswer === letter;
            let theme = isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white';
            if (showFeedback) {
              if (letter === question.answer) theme = 'border-green-500 bg-green-50';
              else if (isSelected && !isCorrect) theme = 'border-red-500 bg-red-50';
            }
            return (
              <button key={idx} onClick={() => !showFeedback && onAnswer(letter)} className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${theme}`}>
                <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border-2 font-black ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-300 border-gray-100'}`}>{letter}</span>
                <span className="font-bold">{opt.split('.').slice(1).join('.').trim()}</span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'material' && (
        <div className="space-y-2">
          <textarea
            value={essayText}
            onChange={(e) => { setEssayText(e.target.value); onAnswer(e.target.value); }}
            readOnly={showFeedback}
            placeholder="材料解析题：请根据史实分点回答（必填）..."
            className={`w-full h-40 p-6 rounded-[2rem] border-2 transition-all text-[16px] leading-relaxed outline-none ${showFeedback ? 'bg-gray-50 border-transparent' : essayText.trim() === "" ? 'bg-red-50/30 border-red-100 focus:border-red-400' : 'bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white'}`}
          />
          {!showFeedback && essayText.trim() === "" && <p className="text-[10px] text-red-400 font-black ml-4 uppercase tracking-widest">请填写此项以提交试卷</p>}
        </div>
      )}

      {showFeedback && (
        <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4">
          <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100 border-dashed">
            <h4 className="font-black text-orange-800 text-[11px] uppercase tracking-widest mb-3">
              {question.type === 'choice' ? '题目解析' : '专家阅卷反馈'}
            </h4>
            <div className="space-y-3">
              {question.type === 'material' && (
                <p className="text-orange-900 text-[14px] leading-relaxed font-bold italic">批语：{aiGrading?.advice || "作答已记录。"}</p>
              )}
              <div className="pt-3 border-t border-orange-200/50">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">标准答案</p>
                <p className="text-gray-800 text-sm font-bold">{question.answer}</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">思路解析</p>
                <p className="text-gray-800 text-sm leading-relaxed">{question.analysis}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};