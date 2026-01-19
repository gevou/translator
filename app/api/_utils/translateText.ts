import { getOpenAiClient } from "./openai";
import { createLogger } from "./logger";
import { ApiError } from "./http";

const logger = createLogger("translate-text");

const detectLanguage = async (text: string): Promise<string | null> => {
  try {
    const openai = getOpenAiClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a language detection assistant. Respond with only the ISO 639-1 code for the detected language of the user's text (e.g., 'en', 'es', 'fr'). If unsure or if the text is too short/ambiguous, respond with 'und'.",
        },
        {
          role: "user",
          content: `Detect the language of the following text: "${text}"`,
        },
      ],
      temperature: 0,
      max_tokens: 10,
    });
    const detectedLang = completion.choices[0]?.message?.content
      ?.trim()
      .toLowerCase();

    if (
      detectedLang &&
      (/^[a-z]{2}$/.test(detectedLang) || detectedLang === "und")
    ) {
      logger.log(
        `Detected language '${detectedLang}' for text: "${text.substring(0, 50)}..."`,
      );
      return detectedLang;
    }
    logger.warn(
      `Could not reliably detect language or invalid code '${detectedLang}' for text: "${text.substring(
        0,
        50,
      )}...". Defaulting to 'und'.`,
    );
    return "und";
  } catch (error) {
    logger.error("Error during language detection", error);
    return null;
  }
};

const classifyRepeatIntent = async (
  text: string,
  originalLanguage: string,
): Promise<boolean> => {
  try {
    const openai = getOpenAiClient();
    const systemPrompt =
      "You are an intent classification assistant. Analyze the user's message. " +
      "If the message clearly indicates the user wants the previous statement to be repeated " +
      "(e.g., they misunderstood, didn't hear well, or explicitly asked for a repeat like 'what did you say?', " +
      "'say that again', '¿puedes repetirlo?', 'no entendí', 'qué', 'what?'), respond with only the word YES. " +
      "Otherwise, respond with only the word NO.";

    const userPrompt = `User message in ${originalLanguage}: "${text}"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 5,
    });
    const intentResponse = completion.choices[0]?.message?.content
      ?.trim()
      .toUpperCase();
    logger.log(
      `Repeat intent for "${text}": "${intentResponse}"`,
    );
    return intentResponse === "YES";
  } catch (error) {
    logger.error("Error during intent classification", error);
    return false;
  }
};

export type TranslationResult = {
  original_transcript: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  is_repeat_request: boolean;
  error?: string;
};

export const translateTranscript = async ({
  transcript,
  sourceLanguage,
}: {
  transcript: string;
  sourceLanguage?: string;
}): Promise<TranslationResult> => {
  const openai = getOpenAiClient();
  let source_language = sourceLanguage;

  if (!source_language || source_language.toLowerCase() === "und") {
    logger.warn(
      `Source language is '${source_language || "not provided"}'. Attempting auto-detection for: "${transcript.substring(
        0,
        50,
      )}..."`,
    );
    const detected = await detectLanguage(transcript);
    if (detected && detected !== "und") {
      source_language = detected;
      logger.log(`Auto-detected language: ${source_language}`);
    } else {
      logger.error(
        `Failed to auto-detect language for transcript: "${transcript}" (detection returned: ${detected})`,
      );
      throw new ApiError(
        `Failed to auto-detect language for translation. Original text: "${transcript}"`,
        400,
      );
    }
  }

  const is_repeat_request = await classifyRepeatIntent(
    transcript,
    source_language,
  );
  logger.log(
    `Repeat intent for "${transcript}": ${is_repeat_request}`,
  );

  let target_language: string | null = null;
  let system_prompt_translation: string | null = null;
  let translatedText: string | null = transcript;

  if (!is_repeat_request) {
    if (source_language.toLowerCase().startsWith("en")) {
      target_language = "es";
      system_prompt_translation =
        "Translate the following English text to Spanish. Output only the translation.";
    } else if (source_language.toLowerCase().startsWith("es")) {
      target_language = "en";
      system_prompt_translation =
        "Translate the following Spanish text to English. Output only the translation.";
    } else {
      logger.error(
        `Unsupported source language for translation: ${source_language}`,
      );
      return {
        original_transcript: transcript,
        translated_text: transcript,
        source_language,
        target_language: source_language,
        is_repeat_request,
        error: `Unsupported source language for translation: ${source_language}`,
      };
    }

    logger.log(
      `Translating from ${source_language} to ${target_language}: "${transcript}"`,
    );
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system_prompt_translation },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
    });
    translatedText =
      completion.choices[0]?.message?.content?.trim() || transcript;
    if (translatedText === transcript && source_language !== target_language) {
      logger.warn("Translation resulted in the same text as input or was empty.");
    }
    logger.log(`Translation successful: "${translatedText}"`);
  } else {
    target_language = source_language;
    logger.log(
      `Repeat request. Original: "${transcript}". No new translation performed.`,
    );
  }

  return {
    original_transcript: transcript,
    translated_text: translatedText,
    source_language,
    target_language,
    is_repeat_request,
  };
};
