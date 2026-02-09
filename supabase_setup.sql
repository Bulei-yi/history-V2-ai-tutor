
-- 1. 基础扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 表结构 (确保 RLS 开启但允许匿名插入)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select" ON students FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    score FLOAT NOT NULL,
    total_questions INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select" ON attempts FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS attempt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES attempts(id),
    question_id TEXT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    score FLOAT,
    ai_grading JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE attempt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON attempt_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select" ON attempt_items FOR SELECT USING (true);

-- 3. 成长指标视图 (优化版：处理 NULL 和计算逻辑)
CREATE OR REPLACE VIEW user_progress AS
SELECT 
    s.id as student_id,
    s.name,
    s.class_name,
    COUNT(a.id) as total_exams,
    ROUND(AVG(a.score)::numeric, 1) as avg_score,
    ROUND(AVG(a.duration_sec)::numeric, 0) as avg_time_per_exam,
    MAX(a.score) as highest_score,
    COALESCE(
        (SELECT score FROM attempts WHERE student_id = s.id ORDER BY submitted_at DESC LIMIT 1) -
        (SELECT score FROM attempts WHERE student_id = s.id ORDER BY submitted_at DESC LIMIT 1 OFFSET 1),
        0
    ) as recent_growth
FROM students s
LEFT JOIN attempts a ON s.id = a.student_id
GROUP BY s.id, s.name, s.class_name;
