
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { QuestionCard } from './components/QuestionCard';
import { Student, Region, Question, GradingResult, AttemptItem } from './types';
import { storageService } from './services/storageService';
import { aiService } from './services/aiService';
import { UI_STRINGS } from './constants';

type View = 'login' | 'dashboard' | 'quiz' | 'result' | 'recharge' | 'mistake_book';

const App: React.FC = () => {
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

  useEffect(() => {
    const savedStudent = localStorage.getItem('current_student');
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('usage_date');

    if (lastDate !== today) {
      localStorage.setItem('usage_count', '0');
      localStorage.setItem('usage_date', today);
      setUsageCount(0);
    } else {
      setUsageCount(parseInt(localStorage.getItem('usage_count') || '0'));
    }

    if (savedStudent) {
      const s = JSON.parse(savedStudent);
      setStudent(s);
      setView('dashboard');
      loadMistakes(s.id);
    }
  }, []);

  const loadMistakes = async (uid: string) => {
    const cached = localStorage.getItem(`mistakes_${uid}`);
    if (cached) setLocalMistakes(JSON.parse(cached));
  };

  const startExpertQuiz = async () => {
    if (usageCount >= 5) {
      setView('recharge');
      return;
    }
    
    setIsLoadingQuestion(true);
    try {
      const qs = await aiService.getExpertQuestionSet(region);
      setQuestions(qs);
      setCurrentIndex(0);
      setAnswers({});
      setAiResults({});
      setQuizStartTime(Date.now()); // 开始计时
      setView('quiz');
    } catch (e: any) {
      if (e.message?.includes('429')) {
        alert("系统当前访问人数较多，请 1 分钟后再试。");
      } else {
        alert("试卷获取失败，请重试");
      }
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const isMaterialValid = () => {
    const materialQ = questions.find(q => q.type === 'material');
    if (!materialQ) return true;
    return (answers[materialQ.id] || "").trim().length > 0;
  };

  const handleSubmit = async () => {
    if (!isMaterialValid() || !student) {
      alert(UI_STRINGS.SUBMIT_ERROR);
      return;
    }

    setIsSubmitting(true);
    const results: Record<string, GradingResult> = {};
    const dbItems: any[] = [];
    const newMistakes = [...localMistakes];
    let totalScore = 0;
    
    try {
      // 1. 逐题批改（选择题自动，材料题 AI）
      for (const q of questions) {
        const userAns = answers[q.id] || "";
        let grading: GradingResult;

        if (q.type === 'choice') {
          const correct = userAns === q.answer;
          grading = {
            score: correct ? (q.fullScore || 20) : 0,
            maxScore: q.fullScore || 20,
            pointsHit: [],
            pointsMissed: [],
            analysis: q.analysis,
            advice: correct ? "正确" : "错误"
          };
          if (!correct && !newMistakes.find(m => m.id === q.id)) newMistakes.push(q);
        } else {
          grading = await aiService.gradeAsExpert(region, userAns, q);
          if (grading.score < (q.fullScore || 20) * 0.6 && !newMistakes.find(m => m.id === q.id)) newMistakes.push(q);
        }

        results[q.id] = grading;
        totalScore += grading.score;

        // 准备 DB 数据项
        dbItems.push({
          question_id: q.id,
          user_answer: userAns,
          is_correct: q.type === 'choice' ? userAns === q.answer : grading.score > 0,
          score: grading.score,
          ai_grading: grading
        });
      }

      // 2. 同步到 Supabase (关键修复点)
      const duration = Math.floor((Date.now() - quizStartTime) / 1000);
      await storageService.saveAttempt({
        student_id: student.id,
        score: totalScore,
        total_questions: questions.length,
        duration_sec: duration
      }, dbItems);

      // 3. 更新本地 UI 状态
      setAiResults(results);
      setLocalMistakes(newMistakes);
      localStorage.setItem(`mistakes_${student.id}`, JSON.stringify(newMistakes));
      setUsageCount(prev => prev + 1);
      localStorage.setItem('usage_count', (usageCount + 1).toString());
      
      setView('result');
    } catch (err: any) {
      console.error("Submit error:", err);
      alert(err.message?.includes('429') ? "批改次数超限，请稍等片刻。" : "数据同步失败，请检查网络。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalScore = Object.values(aiResults).reduce((acc: number, curr: GradingResult) => acc + curr.score, 0);
  const maxPossible = questions.reduce((acc, curr) => acc + (curr.fullScore || 20), 0);

  return (
    <Layout title={view === 'quiz' ? `模拟考 ${currentIndex + 1}/5` : '智学练测'}>
      
      {view === 'login' && (
        <div className="py-20 px-8 space-y-8 animate-in fade-in">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg rotate-3">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">智学练测</h2>
            <p className="text-gray-400 font-bold text-sm">广东中考历史·专家系统</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const s = await storageService.saveStudent(fd.get('name') as string, fd.get('class') as string);
            setStudent({ ...s, role: 'student' });
            localStorage.setItem('current_student', JSON.stringify(s));
            setView('dashboard');
          }} className="space-y-4">
            <input required name="name" placeholder="学生姓名" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold" />
            <input required name="class" placeholder="班级 (如: 初三1班)" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-bold" />
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100">开启练习</button>
          </form>
        </div>
      )}

      {view === 'dashboard' && student && (
        <div className="space-y-8 py-4 animate-in fade-in">
          <div className="mx-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-3xl font-black">{student.name}</h3>
              <p className="opacity-70 font-bold mt-1 text-sm">{student.class_name}</p>
              <div className="mt-6 flex gap-3">
                <div className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider">今日剩余: {5 - usageCount}</div>
                <div className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider">错题: {localMistakes.length}</div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          </div>

          <div className="px-4 space-y-4">
            <div className="bg-gray-100 p-1.5 rounded-2xl flex">
              {(['通用', '广州', '深圳'] as Region[]).map(r => (
                <button key={r} onClick={() => setRegion(r)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${region === r ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{r}卷</button>
              ))}
            </div>

            <div className="space-y-4">
              <button onClick={startExpertQuiz} disabled={isLoadingQuestion} className="w-full group flex items-center gap-6 p-8 bg-white border-2 border-gray-50 rounded-[2.5rem] shadow-sm active:scale-[0.98] transition-all text-left">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  {isLoadingQuestion ? <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                </div>
                <div>
                  <h4 className="font-black text-xl text-gray-900 leading-tight">随机专家抽题</h4>
                  <p className="text-xs text-gray-400 font-bold mt-1">4 选择 + 1 材料题，全卷批改</p>
                </div>
              </button>

              <button onClick={() => setView('mistake_book')} className="w-full flex items-center gap-6 p-8 bg-white border-2 border-gray-50 rounded-[2.5rem] shadow-sm active:scale-[0.98] transition-all text-left">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <div>
                  <h4 className="font-black text-xl text-gray-900 leading-tight">错题本强化</h4>
                  <p className="text-xs text-gray-400 font-bold mt-1">巩固薄弱点，高效提分</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'quiz' && (
        <div className="space-y-6 pb-40 animate-in slide-in-from-right-10">
          <QuestionCard 
            question={questions[currentIndex]} 
            userAnswer={answers[questions[currentIndex].id]} 
            onAnswer={(ans) => setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: ans }))} 
          />
          <div className="fixed bottom-8 left-6 right-6 flex gap-3 max-w-md mx-auto z-50">
            <button onClick={() => currentIndex > 0 ? setCurrentIndex(prev => prev - 1) : setView('dashboard')} className="flex-1 bg-white border-2 border-gray-100 p-5 rounded-2xl font-black text-xs shadow-lg">{currentIndex === 0 ? '退出' : '上一题'}</button>
            {currentIndex < 4 ? (
              <button onClick={() => setCurrentIndex(prev => prev + 1)} className="flex-[2] bg-blue-600 text-white p-5 rounded-2xl font-black text-xs shadow-lg">下一题</button>
            ) : (
              <button onClick={handleSubmit} disabled={isSubmitting} className={`flex-[2] text-white p-5 rounded-2xl font-black text-xs shadow-lg ${isSubmitting ? 'bg-gray-400' : 'bg-green-600'}`}>{isSubmitting ? '批改中...' : '提交试卷'}</button>
            )}
          </div>
        </div>
      )}

      {view === 'result' && (
        <div className="space-y-10 py-6 px-4 animate-in fade-in">
          <div className="text-center p-12 bg-white rounded-[3.5rem] shadow-2xl border-2 border-blue-50 relative overflow-hidden">
            <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] mb-4">{UI_STRINGS.SCORE_TOTAL}</p>
            <h2 className="text-8xl font-black text-blue-600 leading-none">{totalScore}</h2>
            <p className="text-blue-200 text-xs font-black mt-2">/ {maxPossible}</p>
          </div>
          
          <div className="space-y-12">
            {questions.map((q, idx) => (
              <QuestionCard key={q.id} index={idx} question={q} userAnswer={answers[q.id]} showFeedback={true} aiGrading={aiResults[q.id]} onAnswer={() => {}} />
            ))}
          </div>
          <button onClick={() => setView('dashboard')} className="w-full bg-blue-600 text-white py-6 rounded-[2.5rem] font-black text-xl sticky bottom-8 shadow-2xl z-50">返回主页</button>
        </div>
      )}

      {view === 'mistake_book' && (
        <div className="space-y-8 px-4 py-4 animate-in fade-in">
          <header className="flex items-center gap-4">
             <button onClick={() => setView('dashboard')} className="p-3 bg-gray-50 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
             <h2 className="text-2xl font-black">专家错题本</h2>
          </header>
          {localMistakes.length === 0 ? <p className="text-center py-20 opacity-30 font-bold italic">暂无错题记录，继续保持！</p> : (
            <div className="space-y-8">
              {localMistakes.map(q => <QuestionCard key={q.id} question={q} onAnswer={() => {}} showFeedback={false} />)}
            </div>
          )}
        </div>
      )}

      {view === 'recharge' && (
        <div className="py-24 text-center space-y-8 animate-in slide-in-from-bottom-10">
          <div className="w-24 h-24 bg-orange-50 text-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="space-y-2 px-10">
            <h2 className="text-2xl font-black text-gray-900">{UI_STRINGS.RECHARGE_TITLE}</h2>
            <p className="text-gray-400 font-medium leading-relaxed">{UI_STRINGS.RECHARGE_DESC}</p>
          </div>
          <button onClick={() => setView('dashboard')} className="text-blue-600 font-black text-sm uppercase tracking-widest">返回主页</button>
        </div>
      )}
    </Layout>
  );
};

export default App;
