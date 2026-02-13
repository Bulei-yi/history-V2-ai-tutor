
import { GoogleGenAI } from "@google/genai";
import { Question, GradingResult, Region, QuestionType } from "../types.ts";
import { questionBank } from "../data/question_bank";

// Complex tasks should use gemini-3-pro-preview
const DEFAULT_MODEL = 'gemini-3-pro-preview';

const EXPERT_SYSTEM_INSTRUCTION = `你是广东省中考历史阅卷专家。你的任务是根据提供的标准答案和阅卷规则，对学生的作答进行精准批改。

批改规则：
1. 必须返回 JSON 格式：{"score": 分值, "total": 满分, "feedback": "具体扣分项及改进建议", "answer": "标准答案", "analysis": "思路解析"}。
2. 语言必须为简体中文。
3. 材料题批改逻辑：
   - 广州卷：注重层次性、史论结合。
   - 深圳/通用卷：注重关键词命中。
   - 严格按踩点给分，满分为 20 分。`;

// Fisher-Yates Shuffle Algorithm for deep randomization
function shuffle<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export const aiService = {
  /**
   * 抽取 4 + 1 试卷 (4选择 + 1材料)
   * 严格隔离地区库，深度随机，并处理去重
   */
  getExpertQuestionSet: async (region: Region, excludeIds: Set<string>): Promise<Question[]> => {
    const regionKey = (region.includes('卷') ? region : `${region}卷`) as keyof typeof questionBank;
    const regionalBank = questionBank[regionKey];

    if (!regionalBank) {
      console.error(`[Drawing Engine] regionKey error: ${regionKey}`);
      throw new Error(`未找到 ${regionKey} 的题库数据，请切换地区。`);
    }

    // Map raw data to Question interface
    // Fixed Type 'string' is not assignable to type 'QuestionType' error by casting the type property
    const pool: Question[] = regionalBank.map((q: any) => ({
      id: q.id,
      type: (q.question_text.includes('A.') ? 'choice' : 'material') as QuestionType,
      region: region as Region,
      stem: q.question_text,
      answer: q.standard_answer,
      analysis: q.analysis,
      fullScore: q.max_score || (q.question_text.includes('A.') ? 2 : 20),
      options: q.question_text.match(/[A-D]\.\s?[^A-D]+/g) || []
    }));

    // Filter used questions
    let available = pool.filter(q => !excludeIds.has(q.id));
    // If pool is exhausted or too small, reset or use the full pool to ensure availability
    if (available.length < 5) {
      available = pool;
    }

    const shuffled = shuffle(available);
    const choices = shuffled.filter(q => q.type === 'choice');
    const materials = shuffled.filter(q => q.type === 'material');

    if (choices.length < 4 || materials.length < 1) {
       console.error(`[Drawing Engine] ${regionKey} 资源不足 (C:${choices.length} M:${materials.length})`);
       throw new Error(`${regionKey} 题库资源不足，无法组成 4+1 试卷。`);
    }

    return [...choices.slice(0, 4), materials[0]];
  },

  /**
   * AI 专家批改
   */
  gradeAsExpert: async (region: Region, userAnswer: string, question: Question): Promise<GradingResult> => {
    // Initializing GoogleGenAI with named parameter apiKey from environment variable
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `【阅卷任务】
        地区：${region}
        题目：${question.stem}
        参考答案：${question.answer}
        满分：${question.fullScore || 20}
        学生作答：${userAnswer}`,
        config: {
          systemInstruction: EXPERT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json"
        }
      });

      // Getting text output from GenerateContentResponse using .text property
      const res = JSON.parse(response.text.trim());
      return {
        score: parseFloat(res.score),
        maxScore: parseFloat(res.total),
        pointsHit: [],
        pointsMissed: [],
        analysis: res.analysis || question.analysis,
        advice: res.feedback
      };
    } catch (e) {
      console.error("AI Grading Error:", e);
      throw new Error("ERROR_AI_GRADE: 批改失败");
    }
  }
};
