
import { Question } from './types';

export const UI_STRINGS = {
  APP_TITLE: '智学练测·中考历史',
  RECHARGE_TITLE: '额度已用完',
  RECHARGE_DESC: '每日 5 次 AI 深度批改额度已满，请明天再来或开通会员。',
  SUBMIT_ERROR: '请完成所有题目，材料解析题必须填写内容。',
  SCORE_TOTAL: '本次考试总分'
};

// 预置一些高质量汉化后的题目作为本地兜底（防止网络波动）
export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'local_1',
    type: 'choice',
    region: '广州',
    stem: '在近代中国，被称为“开眼看世界的第一人”的是（  ）',
    options: ["A. 林则徐", "B. 魏源", "C. 严复", "D. 康有为"],
    answer: "A",
    analysis: "林则徐在广东禁烟期间，注意收集外国信息，编译《四洲志》，被称为开眼看世界的第一人。",
    category: "近代化探索",
    fullScore: 20
  },
  {
    id: 'local_2',
    type: 'choice',
    region: '深圳',
    stem: '1980年，我国设立的四个经济特区中，位于珠江口东岸的是（  ）',
    options: ["A. 厦门", "B. 汕头", "C. 深圳", "D. 珠海"],
    answer: "C",
    analysis: "深圳位于珠江口东岸，毗邻香港。",
    category: "改革开放",
    fullScore: 20
  }
];
