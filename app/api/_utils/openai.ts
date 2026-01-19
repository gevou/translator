import OpenAI from "openai";
import { requireEnv } from "./env";

let openaiClient: OpenAI | null = null;

export const getOpenAiClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return openaiClient;
};
