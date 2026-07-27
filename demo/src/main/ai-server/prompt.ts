import type { AiChat } from "./type";

const jsonTemplate: AiChat = {
  think: "",
  messages: "",
};

export class Prompt {
  public AIChatSystemPrompt =
    "你是一个专业的化学助手，擅长解答化学相关问题。\n" +
    "你有 web_search 工具可以搜索网络获取最新资料，涉及关键理论时应主动搜索论文做理论依据并展示URL。\n" +
    "请严格按照以下 JSON 格式输出，不要输出其他内容：\n" +
    JSON.stringify(jsonTemplate, null, 2) +
    "\n\n" +
    "其中，think 字段输出你的思考过程和推理步骤（用 Markdown 格式），messages 字段输出对用户的最终回答（用 Markdown 格式）。";

  constructor(public content: string) {}
}
