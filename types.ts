
export type QuestionType = 'choice' | 'material';
export type UserRole = 'student' | 'teacher' | 'admin';
export type Region = '广州' | '深圳' | '通用';

export interface GradingResult {
  score: number;
  maxScore: number;
  pointsHit: string[];
  pointsMissed: string[];
  analysis: string;
  advice: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  region: Region;
  stem: string; 
  material?: string;
  options?: string[];
  answer: string;
  analysis: string;
  point_name?: string;
  highlights?: string[];
  category?: string;
  fullScore?: number;
}

export interface Student {
  id: string;
  name: string;
  class_name: string;
  role: UserRole;
  created_at: string;
}

export interface Attempt {
  id: string;
  student_id: string;
  score: number;
  total_questions: number;
  duration_sec: number;
  submitted_at: string;
}

export interface AttemptItem {
  id: string;
  attempt_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  score: number;
  ai_grading?: GradingResult;
}