
import { GoogleGenAI } from "@google/genai";
import { Question, GradingResult, Region } from "../types";
// @ts-ignore
import questionBank from "../data/questionBank.json";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DEFAULT_MODEL = 'gemini-3-flash-preview';

const EXPERT_SYSTEM_INSTRUCTION = `你是广东省中考历史阅卷专家。你的任务是根据提供的标准答案和阅卷规则，对学生的作答进行精准批改。

批改规则：
1. 必须返回 JSON 格式：{"score": 分值, "total": 满分, "feedback": "具体扣分项及改进建议", "answer": "标准答案", "analysis": "思路解析"}。
2. 语言必须为简体中文。
3. 材料题批改逻辑：
   - 广州卷：注重层次性、史论结合。
   - 深圳/通用卷：注重关键词命中。
   - 严格按踩点给分，满分为 20 分。`;

// Helper for shuffling array
function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

export const aiService = {
  /**
   * 从本地题库抽取试卷
   * 4 道选择题 + 1 道材料题
   */
  getExpertQuestionSet: async (region: Region): Promise<Question[]> => {
    // 1. 筛选对应地区的题目
    const regionQuestions = (questionBank as Question[]).filter(q => q.region === region || q.region === '通用');
    
    // 2. 分离题型
    const choices = regionQuestions.filter(q => q.type === 'choice');
    const materials = regionQuestions.filter(q => q.type === 'material');

    // 3. 随机抽取
    const selectedChoices = shuffle(choices).slice(0, 4);
    const selectedMaterials = shuffle(materials).slice(0, 1);

    const result = [...selectedChoices, ...selectedMaterials];

    // 4. 兜底处理（如果题库不足）
    if (result.length < 5) {
      console.warn("Local bank insufficient, fetching more from general...");
      const extra = (questionBank as Question[]).filter(q => !result.includes(q)).slice(0, 5 - result.length);
      result.push(...extra);
    }

    return result;
  },

  /**
   * 使用 Gemini 进行专家级批改
   */
  gradeAsExpert: async (region: Region, userAnswer: string, question: Question): Promise<GradingResult> => {
    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `【阅卷任务】
        地区：${region}卷
        题目：${question.stem}
        参考答案：${question.answer}
        满分：${question.fullScore || 20}
        学生作答：${userAnswer}
        
        请直接返回 JSON 批改结果。`,
        config: {
          systemInstruction: EXPERT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json"
        }
      });

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
      return {
        score: 0,
        maxScore: 20,
        pointsHit: [],
        pointsMissed: [],
        analysis: question.analysis,
        advice: "AI 阅卷繁忙，请对照标准答案自行评估。"
      };
    }
  }
};
