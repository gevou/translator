import OpenAI from "openai";
import { getOpenAiClient } from "./openai";
import { createLogger } from "./logger";

export interface Turn {
  id: string;
  session_id: string;
  text: string;
  turn_type: string;
  timestamp: string;
  language_code: string;
  actor: "user" | "assistant" | "system";
  original_item_id?: string | null;
}

// Define a more flexible type for JSON schema properties
interface JSONSchemaProperty {
  type: string;
  description: string;
  items?: { type: string; enum?: string[] };
  enum?: string[];
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, JSONSchemaProperty>;
      required?: string[];
    };
  };
}

export type SummaryResult = {
  summary: string;
  actions: any[];
};

const logger = createLogger("summarize-session");

const systemInstruction = `You are a healthcare conversation analyzer. Your primary task is to identify specific intents and ALWAYS trigger corresponding tools.

Given a conversation between a healthcare provider and a patient:

1. ALWAYS select ONE of these tools to call, even if you need to make a best guess:
   * "send_lab_order" - Use when ANY lab test is mentioned or implied
   * "schedule_followup_appointment" - Use when ANY follow-up visit is mentioned or implied

2. Extract any relevant details for your selected tool, using defaults or placeholders when specifics are not mentioned:
   * For lab orders: Use ["general lab work"] for test names if specific tests aren't mentioned
   * For appointments: Use "unspecified" for any missing details

3. CALL ONE OF THESE TOOLS, even if the intent seems ambiguous or minimal.`;

const availableTools: OpenAITool[] = [
  {
    type: "function",
    function: {
      name: "send_lab_order",
      description:
        "Call this function when a 'send lab order' intent (either explicit or implicit) is detected. Extract relevant details like test names, patient instructions, fasting requirements, and urgency.",
      parameters: {
        type: "object",
        properties: {
          tests: {
            type: "array",
            items: { type: "string" },
            description:
              "List of specific tests to be ordered (e.g., 'blood pressure', 'blood sugar levels', 'thyroid function').",
          },
          instructions: {
            type: "string",
            description:
              "Any specific patient instructions for the lab tests (e.g., 'fast for 8 hours').",
          },
          fasting_required: {
            type: "boolean",
            description: "Whether fasting is required for the tests.",
          },
          urgency: {
            type: "string",
            description:
              "The urgency of the lab order (e.g., 'routine', 'stat', 'urgent').",
          },
        },
        required: ["tests"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_followup_appointment",
      description:
        "Call this function when a 'schedule followup appointment' intent (either explicit or implicit) is detected. Extract relevant details like date, time, provider, reason, and duration.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "The date for the followup appointment in YYYY-MM-DD format, or 'unspecified'.",
          },
          time: {
            type: "string",
            description:
              "The time for the followup appointment in HH:MM format, or 'unspecified'.",
          },
          provider: {
            type: "string",
            description:
              "The name or specialty of the healthcare provider for the followup.",
          },
          reason: {
            type: "string",
            description: "The reason for the followup visit.",
          },
          duration: {
            type: "string",
            description:
              "The expected duration of the appointment in minutes, or 'unspecified'.",
          },
        },
        required: [],
      },
    },
  },
];

export const summarizeSession = async (
  sessionId: string,
  turns: Turn[],
): Promise<SummaryResult> => {
  const openai = getOpenAiClient();
  const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemInstruction },
  ];

  const conversationTurns = turns.filter(
    (turn) => turn.actor === "user" || turn.actor === "assistant",
  );
  if (conversationTurns.length === 0) {
    return {
      summary: "No user or assistant messages found to summarize.",
      actions: [],
    };
  }

  openAiMessages.push({
    role: "user",
    content:
      "Let's analyze this conversation and extract any appointment scheduling or lab order intents.",
  });

  conversationTurns.forEach((turn) => {
    openAiMessages.push({
      role: turn.actor as "user" | "assistant",
      content: turn.text,
    });
  });

  logger.log(`Calling OpenAI for session_id: ${sessionId}`);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: openAiMessages,
    tools: availableTools as OpenAI.Chat.Completions.ChatCompletionTool[],
    tool_choice: "auto",
    temperature: 0.3,
  });

  let responseMessage = completion.choices[0]?.message;
  let llmResponseContent: string | null = null;

  if (responseMessage?.tool_calls) {
    logger.log(
      `LLM responded with tool_calls for session_id: ${sessionId}`,
      responseMessage.tool_calls,
    );
    openAiMessages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      const webhookUrl =
        process.env.TOOL_WEBHOOK_URL ||
        "https://webhook.site/10cd3de3-dccd-4733-950c-13e62b3b3b9e";
      let toolResponseText = "";
      let parsedArgs: any = { details: "No details parsed." };
      let actionName = "";
      let callingToolName = "";

      try {
        if (toolCall.function.arguments) {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        }
      } catch (e: any) {
        logger.error(
          `Failed to parse tool arguments for '${toolCall.function.name}', session_id: ${sessionId}`,
          e,
          "Arguments:",
          toolCall.function.arguments,
        );
      }

      if (toolCall.function.name === "send_lab_order") {
        actionName = "send_lab_order";
        callingToolName = "send_lab_order_tool";
      } else if (
        toolCall.function.name === "schedule_followup_appointment"
      ) {
        actionName = "schedule_followup_appointment";
        callingToolName = "schedule_followup_appointment_tool";
      } else {
        logger.warn(
          `Unknown tool call requested: ${toolCall.function.name} for session_id: ${sessionId}`,
        );
        toolResponseText = `Unknown tool requested: ${toolCall.function.name}.`;
        openAiMessages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: toolResponseText,
        });
        continue;
      }

      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: actionName,
            callingTool: callingToolName,
            details: parsedArgs,
          }),
        });
        const responseBodyText = await webhookResponse.text();
        if (webhookResponse.ok) {
          toolResponseText = `Webhook for '${actionName}' called successfully. Status: ${webhookResponse.status}.`;
          logger.log(
            `Webhook for '${actionName}' success, session_id: ${sessionId}`,
            toolResponseText,
          );
        } else {
          toolResponseText = `Webhook for '${actionName}' failed with status: ${webhookResponse.status}. Response: ${responseBodyText}`;
          logger.error(
            `Webhook for '${actionName}' failed, session_id: ${sessionId}`,
            toolResponseText,
          );
        }
      } catch (e: any) {
        toolResponseText = `Error calling webhook for ${actionName}: ${e.message}`;
        logger.error(
          `Error calling webhook for '${actionName}', session_id: ${sessionId}`,
          e,
        );
      }

      openAiMessages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        content: toolResponseText,
      });
    }

    const messagesForSecondCall: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        ...openAiMessages,
        {
          role: "user",
          content:
            "Thank you for performing the tool actions. Now, please provide the final conversation summary and the list of all actions taken (including tool invocations and their results) in the specified JSON format as outlined in the initial system instructions. Ensure the entire response is a single, valid JSON object.",
        },
      ];

    logger.log(`Calling OpenAI again for session_id: ${sessionId}`);
    const secondCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messagesForSecondCall,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    llmResponseContent = secondCompletion.choices[0]?.message?.content;
  } else {
    logger.log(
      `LLM responded directly (no tool_calls) for session_id: ${sessionId}`,
    );
    llmResponseContent = responseMessage?.content;
  }

  if (!llmResponseContent) {
    throw new Error("LLM returned empty content.");
  }

  logger.log(
    `Raw LLM content for session_id: ${sessionId}: ${llmResponseContent}`,
  );

  let summaryData = {
    summary: "Failed to parse summary from LLM.",
    actions: [] as any[],
  };
  try {
    const parsedLlmResponse = JSON.parse(llmResponseContent);
    summaryData.summary =
      parsedLlmResponse.conversation_summary ||
      parsedLlmResponse.summary ||
      "Summary not provided by LLM.";
    summaryData.actions =
      parsedLlmResponse.actions_taken || parsedLlmResponse.actions || [];

    if (!Array.isArray(summaryData.actions)) {
      summaryData.actions = [];
    }
  } catch (parseError) {
    logger.error(
      `Failed to parse JSON from LLM response for session_id: ${sessionId}`,
      parseError,
      "Raw content:",
      llmResponseContent,
    );
  }

  return summaryData;
};
