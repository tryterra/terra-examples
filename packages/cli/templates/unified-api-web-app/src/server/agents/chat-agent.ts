import { AIChatAgent } from "@cloudflare/ai-chat";
import type { OnChatMessageOptions } from "@cloudflare/ai-chat";
import { createAnthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, stepCountIs } from "ai";
import type { StreamTextOnFinishCallback, ToolSet } from "ai";
import type { Connection, ConnectionContext } from "agents";
import { and, eq } from "drizzle-orm";
import { chat, terraConnection, userInfo } from "../../../db/schema";
import type { Env } from "../lib/auth";
import { getAuth } from "../lib/auth";
import { buildAnalysisTool } from "../lib/chat/analysis-tool";
import { renderChartTool } from "../lib/chat/chart-tool";
import {
  CHAT_MAX_PERSISTED_MESSAGES,
  CHAT_MAX_STEPS,
  CHAT_MCP_TIMEOUT_MS,
  CHAT_MODEL,
} from "../lib/config";
import { createDb } from "../lib/db";

/** Hydrated in onConnect from the DB; drives the system prompt and Terra MCP connection. */
type ChatAgentState = {
  userId: string | null;
  terraUserId: string | null;
  userName: string | null;
  userProfile: {
    age: number | null;
    gender: string | null;
    heightCm: number | null;
    weightKg: number | null;
    lifestyleGoals: string | null;
  } | null;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Assembles the system prompt with optional user name and profile context. */
function buildSystemPrompt(state: ChatAgentState): string {
  const parts = [
    "You are a friendly, knowledgeable health assistant. You have access to the user's health data from their connected wearable devices via Terra.",
    "Be conversational, empathetic, and evidence-based. When you lack data, say so honestly.",
    "When presenting numerical health data or trends, use the render_chart tool to show a visual chart. For time-series data use line charts, for comparisons use bar charts, for distributions use pie charts. Multi-series charts are supported — combine related metrics in one chart rather than showing separate charts when the data shares the same time axis.",
    "You have an analyze tool for statistical computation. Use it whenever you need precise calculations — never do mental arithmetic. First fetch health data using your MCP tools, then pass the data into the analyze tool for computation. It can compute averages, min/max, standard deviations, correlations, BMI, heart rate zones, and any other derived metric.",
    "Always respect user privacy and remind them you are not a medical professional when giving health advice.",
  ];

  if (state.userName) {
    parts.push(`The user's name is ${state.userName}.`);
  }

  if (state.userProfile) {
    const p = state.userProfile;
    const profileParts: string[] = [];
    if (p.age) profileParts.push(`Age: ${p.age}`);
    if (p.gender) profileParts.push(`Gender: ${p.gender}`);
    if (p.heightCm) profileParts.push(`Height: ${p.heightCm}cm`);
    if (p.weightKg) profileParts.push(`Weight: ${p.weightKg}kg`);
    if (p.lifestyleGoals) profileParts.push(`Goals: ${p.lifestyleGoals}`);
    if (profileParts.length > 0) {
      parts.push(`User profile: ${profileParts.join(", ")}`);
    }
  }

  return parts.join("\n\n");
}

/* -------------------------------------------------------------------------- */
/*                                    Agent                                   */
/* -------------------------------------------------------------------------- */

export class ChatAgent extends AIChatAgent<Env, ChatAgentState> {
  initialState: ChatAgentState = {
    userId: null,
    terraUserId: null,
    userName: null,
    userProfile: null,
  };

  chatRecovery = true;

  maxPersistedMessages = CHAT_MAX_PERSISTED_MESSAGES;

  waitForMcpConnections = { timeout: CHAT_MCP_TIMEOUT_MS };

  async onConnect(connection: Connection, { request }: ConnectionContext) {
    const origin = new URL(request.url).origin;
    const auth = getAuth(this.env, origin);
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      connection.close(4001, "Unauthorized");
      return;
    }

    const userId = session.user.id;
    const db = createDb(this.env.DATABASE_URL);

    const [chatRow] = await db
      .select({ userId: chat.userId })
      .from(chat)
      .where(and(eq(chat.id, this.name), eq(chat.userId, userId)))
      .limit(1);

    if (!chatRow) {
      connection.close(4003, "Forbidden");
      return;
    }

    const [[profile], [activeConn]] = await Promise.all([
      db.select().from(userInfo).where(eq(userInfo.userId, userId)).limit(1),
      db
        .select({ terraUserId: terraConnection.terraUserId })
        .from(terraConnection)
        .where(eq(terraConnection.userId, userId))
        .limit(1),
    ]);

    this.setState({
      userId,
      terraUserId: activeConn?.terraUserId ?? null,
      userName: session.user.name ?? null,
      userProfile: profile
        ? {
            age: profile.age,
            gender: profile.gender,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            lifestyleGoals: profile.lifestyleGoals,
          }
        : null,
    });

    await this.connectMcp();
  }

  private async connectMcp() {
    const { terraUserId } = this.state;
    if (!terraUserId || !this.env.TERRA_DEV_ID || !this.env.TERRA_API_KEY)
      return;
    try {
      const url = `https://access.tryterra.co/api/v2/mcp/${terraUserId}`;
      await this.addMcpServer("terra", url, {
        transport: {
          headers: {
            "dev-id": this.env.TERRA_DEV_ID,
            "x-api-key": this.env.TERRA_API_KEY,
          },
        },
      });
    } catch (error) {
      console.error("Failed to connect Terra MCP:", error);
    }
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: OnChatMessageOptions,
  ) {
    if (!this.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const anthropic = createAnthropic({
      apiKey: this.env.ANTHROPIC_API_KEY,
    });

    const rawMcpTools = this.mcp.getAITools();
    const mcpToolNames = new Map(
      this.mcp
        .listTools()
        .map((t) => [`tool_${t.serverId.replace(/-/g, "")}_${t.name}`, t.name]),
    );
    const mcpTools = Object.fromEntries(
      Object.entries(rawMcpTools).map(([key, def]) => [
        key,
        { ...def, title: def.title ?? mcpToolNames.get(key) ?? key },
      ]),
    );

    const analysisTools: Record<string, unknown> = {};
    if (this.env.LOADER) {
      const analysisTool = buildAnalysisTool(this.env.LOADER, {
        render_chart: renderChartTool,
      } as ToolSet);
      analysisTools.analyze = analysisTool;
    }

    const localTools = {
      render_chart: renderChartTool,
    };

    const modelMessages = await convertToModelMessages(this.messages);

    const result = streamText({
      model: anthropic(CHAT_MODEL),
      system: buildSystemPrompt(this.state),
      messages: modelMessages,
      tools: { ...localTools, ...mcpTools, ...analysisTools },
      stopWhen: stepCountIs(CHAT_MAX_STEPS),
      abortSignal: options?.abortSignal,
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }

  async destroyChat() {
    await this.destroy();
  }
}
