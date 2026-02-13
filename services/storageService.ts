import { createClient } from '@supabase/supabase-js';
import { Student, Attempt, AttemptItem, Question } from '../types.ts';

const SUPABASE_URL = 'https://ciogsreqplqmuxlryvve.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9gjIqs32oRP-AMIEgp-yiQ_8gUsVySA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const storageService = {
  // 登录/创建学生
  saveStudent: async (name: string, class_name: string): Promise<Student> => {
    try {
      const { data: existing, error: findError } = await supabase
        .from('students')
        .select('*')
        .eq('name', name)
        .eq('class_name', class_name)
        .maybeSingle();

      if (existing) return existing as Student;

      const { data: created, error: createError } = await supabase
        .from('students')
        .insert([{ name, class_name }])
        .select()
        .single();

      if (createError) throw createError;
      return created as Student;
    } catch (err) {
      console.error('Database Connection Error:', err);
      throw new Error("DB_002");
    }
  },

  // 获取云端错题 ID
  getUserMistakeIds: async (student_id: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('user_mistakes')
      .select('question_id')
      .eq('student_id', student_id);
    
    if (error) return [];
    return data.map(item => item.question_id);
  },

  // 同步/更新错题 (利用唯一索引 idx_unique_student_question)
  upsertMistake: async (student_id: string, question_id: string) => {
    await supabase
      .from('user_mistakes')
      .upsert({ 
        student_id, 
        question_id, 
        last_error_at: new Date().toISOString() 
      }, { 
        onConflict: 'student_id,question_id' 
      });
  },

  // 保存答题记录
  saveAttempt: async (
    attempt: Omit<Attempt, 'id' | 'submitted_at'>, 
    items: Omit<AttemptItem, 'id' | 'attempt_id'>[]
  ): Promise<Attempt> => {
    const { data: attemptData, error: attemptError } = await supabase
      .from('attempts')
      .insert([{
        student_id: attempt.student_id,
        score: attempt.score,
        total_questions: attempt.total_questions,
        duration_sec: attempt.duration_sec
      }])
      .select()
      .single();

    if (attemptError) throw new Error(`SAVE_FAIL: ${attemptError.message}`);

    const newAttemptId = attemptData.id;

    const itemsToInsert = items.map(item => ({
      attempt_id: newAttemptId,
      question_id: item.question_id,
      user_answer: item.user_answer,
      is_correct: item.is_correct,
      score: item.score,
      ai_grading: item.ai_grading 
      student_id: attemptData.student_id,
    }));

    const { error: itemsError } = await supabase
      .from('attempt_items')
      .insert(itemsToInsert);

    if (itemsError) console.error('Details Save Warning:', itemsError);

    return attemptData as Attempt;
  },

  // 提交反馈
  submitFeedback: async (student_id: string, content: string) => {
    const { error } = await supabase
      .from('student_feedbacks')
      .insert([{ student_id, content }]);
    if (error) throw error;
  },

  // 获取管理员看板聚合数据
  getAdminStats: async () => {
    const { data: attempts } = await supabase.from('attempts').select('score, submitted_at');
    const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
    const { data: items } = await supabase.from('attempt_items').select('is_correct, ai_grading');
    const { data: mistakes } = await supabase.from('user_mistakes').select('question_id');

    const totalAttempts = attempts?.length || 0;
    const avgScore = totalAttempts ? (attempts!.reduce((acc, cur) => acc + cur.score, 0) / totalAttempts).toFixed(1) : 0;
    const aiCount = items?.filter(i => i.ai_grading)?.length || 0;

    return {
      totalAttempts,
      totalStudents,
      avgScore,
      aiCount,
      mistakesCount: mistakes?.length || 0
    };
  }
};