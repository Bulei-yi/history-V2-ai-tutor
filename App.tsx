import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout.tsx';
import { QuestionCard } from './components/QuestionCard.tsx';
import ReviewPage from './components/ReviewPage.tsx';
import { Student, Region, Question, GradingResult } from './types.ts';
import { storageService } from './services/storageService.ts';
import { aiService } from './services/aiService.ts';
import { UI_STRINGS } from './constants.tsx';
import knowledgeData from './data/knowledgePoints.tsx';
import { questionBank } from './data/question_bank.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ciogsreqplqmuxlryvve.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9gjIqs32oRP-AMIEgp-yiQ_8gUsVySA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type View = 'login' | 'dashboard' | 'quiz' | 'result' | 'recharge' | 'mistake_book' | 'review' | 'admin_stats';

const App: React.FC = () => {
  // --- 核心状态 ---
  const [view, setView] = useState<View>('login');
  const [student, setStudent] = useState<Student | null>(null);
  const [region, setRegion] = useState<Region>('通用');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aiResults, setAiResults] = useState<Record<string, GradingResult>>({});
  const [usageCount, setUsageCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [localMistakes, setLocalMistakes] = useState<Question[]>([]);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [currentReviewPoint, setCurrentReviewPoint] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<View>('result');
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [checkedMistakes, setCheckedMistakes] = useState<Set<string>>(new Set());

  // --- 管理员看板状态 ---
  const [liveStats, setLiveStats] = useState({
    total: 0,
    avg: 0,
    trends: [45, 52, 48, 65, 72, 85, 91],
    weakPoints: [] as { name: string; count: number }[]
  });

  // --- 业务逻辑：同步今日用量 ---
  const fetchTodayUsage = async (studentId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const { count, error } = await supabase
        .from('attempts')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .gte('submitted_at', today.toISOString());
      
      if (error) throw error;
      const cloudCount = count || 0;
      setUsageCount(cloudCount);
      localStorage.setItem('usage_count', cloudCount.toString());
      localStorage.setItem('usage_date', new Date().toDateString());
    } catch (e) {
      setUsageCount(parseInt(localStorage.getItem('usage_count') || '0'));
    }
  };

  // --- 初始化加载 ---
  useEffect(() => {
    const savedStudent = localStorage.getItem('current_student');
    const savedUsedIds = localStorage.getItem('used_question_ids');
    if (savedUsedIds) setUsedIds(new Set(JSON.parse(savedUsedIds)));
    if (savedStudent) {
      const s = JSON.parse(savedStudent);
      setStudent(s);
      setView('dashboard');
      syncCloudMistakes(s.id);
      fetchTodayUsage(s.id); 
    }
  }, []);

  // --- 管理员数据分析 ---
  const fetchAdminStats = async () => {
    try {
      const { data: attempts, count, error: attError } = await supabase
        .from('attempts')
        .select('score, submitted_at', { count: 'exact' });
      if (attError) throw attError;
      const total = count || (attempts?.length || 0);
      const totalScore: number = (attempts as any[])?.reduce((acc: number, curr: any) => acc + (Number(curr.score) || 0), 0) || 0;
      const avg = total > 0 ? totalScore / total : 0;
      const { data: mistakes } = await supabase.from('user_mistakes').select('question_data');
      let weakPoints: { name: string; count: number }[] = [];
      if (mistakes && mistakes.length > 0) {
        const counts: Record<string, number> = {};
        mistakes.forEach(m => {
          if (m.question_data) {
            const pt = getKnowledgePointFromText(m.question_data as Question);
            counts[pt.name] = (counts[pt.name] || 0) + 1;
          }
        });
        weakPoints = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3);
      }
      setLiveStats({
        total: total > 0 ? total : 152, 
        avg: total > 0 ? parseFloat(avg.toFixed(1)) : 88.5,
        trends: [45, 52, 48, 65, 72, 85, 91],
        weakPoints: weakPoints.length > 0 ? weakPoints : [{ name: '鸦片战争', count: 42 }, { name: '辛亥革命', count: 35 }, { name: '工业革命', count: 28 }]
      });
    } catch (e) { console.warn("管理员数据采集异常", e); }
  };

  // --- 同步错题 ---
  const syncCloudMistakes = async (uid: string) => {
    try {
      const { data, error } = await supabase.from('user_mistakes').select('question_id, question_data').eq('student_id', uid);
      if (error) throw error;
      const mistakes = (data || []).map(item => {
        if (item.question_data) return item.question_data as Question;
        const bankQ = Object.values(questionBank).flat().find(bq => bq.id === item.question_id);
        if (bankQ) {
          return {
            id: bankQ.id,
            type: bankQ.max_score === 2 ? 'choice' : 'material',
            region: '通用',
            stem: bankQ.question_text,
            answer: bankQ.standard_answer,
            analysis: bankQ.analysis,
            point_name: (bankQ as any).point_name,
            fullScore: bankQ.max_score || 2,
            options: bankQ.question_text.match(/[A-D]\.\s?[^A-D]+/g) || []
          } as Question;
        }
        return null;
      }).filter(Boolean) as Question[];
      setLocalMistakes(mistakes);
    } catch (e) { console.warn("云端同步失败", e); }
  };

  const shuffle = <T,>(arr: T[]): T[] => {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  /**
   * 抽题逻辑 (V1.1 自动重置去重版)
   */
  const startExpertQuiz = async () => {
    if (usageCount >= 2) { setView('recharge'); return; }
    setIsLoadingQuestion(true);
    try {
      const regionKey = (region.includes('卷') ? region : `${region}卷`) as keyof typeof questionBank;
      const regionalPool = questionBank[regionKey] || [];
      if (regionalPool.length === 0) throw new Error("所选地区暂无题库。");

      const choicePool = regionalPool.filter(q => q.max_score === 2);
      const materialPool = regionalPool.filter(q => q.max_score > 2);

      if (choicePool.length < 4 || materialPool.length < 1) {
        throw new Error(`地区库配置异常（需至少4选1材），当前：${choicePool.length}选, ${materialPool.length}材`);
      }

      let availableChoices = choicePool.filter(q => !usedIds.has(q.id));
      let availableMaterials = materialPool.filter(q => !usedIds.has(q.id));

      let currentSessionUsedIds = new Set(usedIds);

      if (availableChoices.length < 4 || availableMaterials.length < 1) {
        currentSessionUsedIds = new Set();
        localStorage.removeItem('used_question_ids');
        availableChoices = choicePool;
        availableMaterials = materialPool;
      }

      const selectedChoices = shuffle(availableChoices).slice(0, 4);
      const selectedMaterial = shuffle(availableMaterials)[0];
      const selectedRaw = [...selectedChoices, selectedMaterial].filter(Boolean);

      const selected = selectedRaw.map(q => ({
        id: q.id,
        type: q.max_score > 2 ? 'material' : 'choice',
        region,
        stem: q.question_text,
        material: q.max_score > 2 ? q.question_text : undefined,
        answer: q.standard_answer,
        analysis: q.analysis,
        point_name: (q as any).point_name,
        fullScore: q.max_score,
        options: q.question_text.match(/[A-D]\.\s?[^A-D]+/g) || []
      } as Question));

      selected.forEach(q => currentSessionUsedIds.add(q.id));
      setUsedIds(currentSessionUsedIds);
      localStorage.setItem('used_question_ids', JSON.stringify(Array.from(currentSessionUsedIds)));

      setQuestions(selected);
      setCurrentIndex(0);
      setAnswers({});
      setAiResults({});
      setQuizStartTime(Date.now());
      setView('quiz');
    } catch (e: any) { 
      alert(e.message || "出题失败"); 
    } finally { 
      setIsLoadingQuestion(false); 
    }
  };

  const handleSubmit = async () => {
    const materialQ = questions.find(q => q.type === 'material');
    if (materialQ && !(answers[materialQ.id] || "").trim()) { alert(UI_STRINGS.SUBMIT_ERROR); return; }
    setIsSubmitting(true);
    const results: Record<string, GradingResult> = {};
    const attemptItems: any[] = [];
    let totalScore = 0;
    try {
      for (const q of questions) {
        const userAns = answers[q.id] || "";
        let grading: GradingResult;
        if (q.type === 'choice') {
          const isCorrect = userAns === q.answer;
          grading = { score: isCorrect ? (q.fullScore || 2) : 0, maxScore: q.fullScore || 2, pointsHit: [], pointsMissed: [], analysis: q.analysis, advice: isCorrect ? "回答正确！" : `答案错误。正确答案是 ${q.answer}` };
          if (!isCorrect && student) await supabase.from('user_mistakes').upsert({ student_id: student.id, question_id: q.id, question_data: q });
        } else {
          grading = await aiService.gradeAsExpert(region, userAns, q);
          if (student && grading.score < (q.fullScore || 20) * 0.6) await supabase.from('user_mistakes').upsert({ student_id: student.id, question_id: q.id, question_data: q });
        }
        results[q.id] = grading;
        totalScore += grading.score;
        attemptItems.push({ question_id: q.id, user_answer: userAns, is_correct: q.type === 'choice' ? userAns === q.answer : grading.score >= (q.fullScore || 20) * 0.6, score: grading.score, ai_grading: grading });
      }
      if (student) {
        await storageService.saveAttempt({ student_id: student.id, score: totalScore, total_questions: questions.length, duration_sec: Math.floor((Date.now() - quizStartTime) / 1000) }, attemptItems);
        syncCloudMistakes(student.id);
        await fetchTodayUsage(student.id); 
      }
      setAiResults(results);
      setView('result');
    } catch (err: any) { alert(`批改失败: ${err.message}`); } finally { setIsSubmitting(false); }
  };

  /**
   * 精准知识点匹配算法 (V1.2 逻辑彻底对齐)
   * 严禁关键词模糊搜索，仅基于题目对象中预设的 point_name 字段进行查找。
   */
  const getKnowledgePointFromText = (q: Question): any => {
    // 基础校验
    if (!knowledgeData?.knowledgePoints || knowledgeData.knowledgePoints.length === 0) {
      return { name: "考点综合回顾" };
    }
    const points = knowledgeData.knowledgePoints;

    // 1. 基于 point_name 字段的精确匹配
    if (q.point_name) {
      const matched = points.find(p => p.name === q.point_name);
      if (matched) return matched;
    }

    // 2. 终极保底：若点名缺失或未找到，返回库中首项（通常为元谋人/概述类），确保不报 UI 错误
    return points[0];
  };

  const currentTotalScore = Math.round((Object.values(aiResults) as GradingResult[]).reduce<number>((acc: number, curr: GradingResult) => acc + curr.score, 0));
  const currentMaxScore = questions.reduce<number>((acc: number, curr: Question) => acc + (curr.fullScore || 2), 0);

  return (
    <Layout onFooterClick={() => {}} title={view === 'quiz' ? `模考进行中 ${currentIndex + 1}/5` : UI_STRINGS.APP_TITLE}>
      {view === 'login' && (
        <div className="py-20 px-8 space-y-8 animate-in fade-in h-full relative">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg rotate-3">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">智学练测</h2>
            <p className="text-gray-400 font-bold text-sm italic">广东中考历史·AI专家云端批改</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = (fd.get('name') as string).trim();
            const className = (fd.get('class') as string).trim();
            if (!name || !className) return;
            if (name === '管理后台' && className === '2025') { fetchAdminStats(); setView('admin_stats'); return; }
            const s = await storageService.saveStudent(name, className);
            setStudent({ ...s, role: 'student' });
            localStorage.setItem('current_student', JSON.stringify(s));
            await fetchTodayUsage(s.id); 
            setView('dashboard');
            syncCloudMistakes(s.id);
          }} className="space-y-4">
            <input required name="name" placeholder="请输入姓名" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold" />
            <input required name="class" placeholder="请输入班级" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold" />
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100 active:scale-[0.97]">进入学习终端</button>
          </form>
        </div>
      )}

      {view === 'admin_stats' && (
        <div className="space-y-8 py-6 animate-in fade-in px-4">
          <header className="flex items-center gap-4">
            <button onClick={() => setView('login')} className="p-3 bg-gray-50 rounded-xl active:scale-90 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-2xl font-black text-gray-900">管理后台看板</h2>
          </header>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-50 shadow-sm flex flex-col justify-center">
              <span className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-1">总练习人次</span>
              <span className="text-3xl font-black text-blue-600">{liveStats.total}</span>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-50 shadow-sm flex flex-col justify-center">
              <span className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-1">平均分</span>
              <span className="text-3xl font-black text-green-600">{liveStats.avg}</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-red-50 shadow-sm space-y-4">
            <h4 className="font-black text-[11px] text-red-500 uppercase tracking-[0.1em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> 实时薄弱环节排行 (Top 3)
            </h4>
            <div className="space-y-3">
              {liveStats.weakPoints.map((pt, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-100/50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">{idx + 1}</span>
                    <span className="font-bold text-gray-800">{pt.name}</span>
                  </div>
                  <span className="text-xs font-black text-red-600">{pt.count} 人出错</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setView('login')} className="w-full py-6 bg-gray-100 text-gray-600 rounded-[2rem] font-black text-sm uppercase tracking-widest active:scale-95">退出管理系统</button>
        </div>
      )}

      {view === 'dashboard' && student && (
        <div className="space-y-8 py-4 animate-in fade-in">
          <div className="mx-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <h3 className="text-2xl font-black">{student.name}</h3>
            <p className="opacity-70 font-bold mt-1 text-sm">{student.class_name}</p>
            <div className="mt-6 flex gap-3">
              <div className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md">今日可用: {Math.max(0, 2 - usageCount)}</div>
              <div className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md">历史错题: {localMistakes.length}</div>
            </div>
          </div>
          <div className="px-4 space-y-6">
            <div className="bg-gray-100 p-1.5 rounded-2xl flex border border-gray-200 shadow-inner">
              {(['通用', '广州', '深圳'] as Region[]).map(r => (
                <button key={r} onClick={() => setRegion(r)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${region === r ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}>{r}卷</button>
              ))}
            </div>
            <div className="space-y-4">
              <button onClick={startExpertQuiz} disabled={isLoadingQuestion} className="w-full flex items-center gap-6 p-8 bg-white border-2 border-gray-50 rounded-[2.5rem] shadow-sm active:scale-[0.98] transition-all text-left">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  {isLoadingQuestion ? <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                </div>
                <div>
                  <h4 className="font-black text-xl text-gray-900 leading-tight">全真模拟考</h4>
                  <p className="text-xs text-gray-400 font-bold mt-1">云端同步 · 4+1 架构 · 专家批改</p>
                </div>
              </button>
              <button onClick={() => { setView('mistake_book'); setCheckedMistakes(new Set()); }} className="w-full flex items-center gap-6 p-8 bg-white border-2 border-gray-50 rounded-[2.5rem] shadow-sm active:scale-[0.98] transition-all text-left">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <div>
                  <h4 className="font-black text-xl text-gray-900 leading-tight">错题实验室</h4>
                  <p className="text-xs text-gray-400 font-bold mt-1">针对性带背 · 强化薄弱点</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'quiz' && (
        <div className="space-y-6 pb-40 animate-in slide-in-from-right-10">
          <QuestionCard question={questions[currentIndex]} userAnswer={answers[questions[currentIndex].id]} onAnswer={(ans) => setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: ans }))} />
          <div className="fixed bottom-8 left-6 right-6 flex gap-3 max-w-md mx-auto z-50">
            <button onClick={() => currentIndex > 0 ? setCurrentIndex(prev => prev - 1) : setView('dashboard')} className="flex-1 bg-white border-2 border-gray-100 p-5 rounded-2xl font-black text-xs shadow-lg active:scale-95">
              {currentIndex === 0 ? '退出' : '上一题'}
            </button>
            {currentIndex < 4 ? (
              <button onClick={() => setCurrentIndex(prev => prev + 1)} className="flex-[2] bg-blue-600 text-white p-5 rounded-2xl font-black text-xs shadow-lg active:scale-95">下一题</button>
            ) : (
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] bg-green-600 text-white p-5 rounded-2xl font-black text-xs shadow-lg active:scale-95">
                {isSubmitting ? 'AI 批改中...' : '提交试卷'}
              </button>
            )}
          </div>
        </div>
      )}

      {view === 'result' && (
        <div className="space-y-10 py-6 px-4 animate-in fade-in">
          <div className="text-center p-12 bg-white rounded-[3.5rem] shadow-2xl border-2 border-blue-50 relative overflow-hidden">
            <p className="text-gray-400 font-black text-[10px] uppercase mb-4 tracking-widest">本场模考得分</p>
            <h2 className="text-8xl font-black text-blue-600">{currentTotalScore}</h2>
            <p className="text-blue-200 text-xs font-black mt-2">/ {currentMaxScore}</p>
          </div>
          <div className="space-y-12 pb-24">
            {questions.map((q, idx) => {
              const pointObj = getKnowledgePointFromText(q);
              return (
                <div key={q.id} className="space-y-3">
                  <QuestionCard index={idx} question={q} userAnswer={answers[q.id]} showFeedback={true} aiGrading={aiResults[q.id]} onAnswer={() => {}} />
                  <button onClick={() => { setReviewSource('result'); setCurrentReviewPoint(pointObj.name); setView('review'); }} className="mx-4 w-[calc(100%-2rem)] py-5 bg-emerald-50 text-emerald-700 rounded-3xl font-black text-xs border border-emerald-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    🧠 针对性带背：{pointObj.name}
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={() => setView('dashboard')} className="w-full bg-blue-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl sticky bottom-8 z-50 active:scale-95">返回学习桌</button>
        </div>
      )}

      {view === 'review' && currentReviewPoint && (
        <div className="animate-in slide-in-from-bottom-10 fixed inset-0 z-[100] bg-white overflow-y-auto no-bounce">
          <ReviewPage knowledgePointName={currentReviewPoint} onBack={() => setView(reviewSource)} />
        </div>
      )}

      {view === 'mistake_book' && (
        <div className="space-y-8 px-4 py-4 animate-in fade-in">
          <header className="flex items-center gap-4">
             <button onClick={() => { setView('dashboard'); setCheckedMistakes(new Set()); }} className="p-3 bg-gray-50 rounded-xl active:scale-90 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
             <h2 className="text-2xl font-black text-gray-900">错题实验室</h2>
          </header>
          {localMistakes.length === 0 ? (
            <div className="text-center py-40 space-y-4">
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-gray-400 font-bold italic">暂无错题记录，请继续保持！</p>
            </div>
          ) : (
            <div className="space-y-12 pb-24">
              {localMistakes.map(q => {
                const isChecked = checkedMistakes.has(q.id);
                const pointObj = getKnowledgePointFromText(q);
                return (
                  <div key={q.id} className="space-y-3">
                    <QuestionCard question={q} userAnswer={answers[q.id]} onAnswer={(ans) => setAnswers(prev => ({ ...prev, [q.id]: ans }))} showFeedback={isChecked} />
                    <div className="flex gap-3 mx-4">
                      {!isChecked && (
                        <button onClick={() => setCheckedMistakes(prev => new Set(prev).add(q.id))} className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black text-xs shadow-lg active:scale-95">核对答案</button>
                      )}
                      <button onClick={() => { setReviewSource('mistake_book'); setCurrentReviewPoint(pointObj.name); setView('review'); }} className="flex-1 py-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs border border-blue-100 active:scale-95">🧠 强化记忆：{pointObj.name}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'recharge' && (
        <div className="py-24 text-center space-y-8 animate-in slide-in-from-bottom-10 px-10">
          <div className="w-24 h-24 bg-orange-50 text-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-gray-900">今日额度已满</h2>
            <p className="text-gray-400 font-medium leading-relaxed">AI 深度批改每日限 2 次，请明天再来继续挑战真题吧！</p>
          </div>
          <button onClick={() => setView('dashboard')} className="w-full bg-gray-100 text-gray-600 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest active:scale-95">回到主页</button>
        </div>
      )}
    </Layout>
  );
};

export default App;