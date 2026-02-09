
import { createClient } from '@supabase/supabase-js';
import { Student, Attempt, AttemptItem } from '../types';

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

  // 保存答题记录 (核心：包含用时和成长数据)
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
      ai_grading: item.ai_grading // 存储 AI 详细反馈
    }));

    const { error: itemsError } = await supabase
      .from('attempt_items')
      .insert(itemsToInsert);

    if (itemsError) console.error('Details Save Warning:', itemsError);

    return attemptData as Attempt;
  }
};
