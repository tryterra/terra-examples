import { createCodeTool } from "@cloudflare/codemode/ai";
import { DynamicWorkerExecutor } from "@cloudflare/codemode";
import type { ToolSet } from "ai";

const ANALYSIS_TOOL_DESCRIPTION = `Run a statistical analysis or calculation. Write JavaScript to compute metrics and return results.

IMPORTANT: Fetch health data BEFORE calling this tool using your MCP tools (get_daily_data, get_sleep_data, etc.). Then pass the fetched data into your code as literal values. Do NOT try to fetch data inside this tool.

Use this tool when you need to:
- Compute statistics: mean, median, min, max, standard deviation, percentiles
- Aggregate data across date ranges (weekly/monthly averages, totals)
- Calculate derived health metrics: BMI, heart rate zones, calorie targets, sleep efficiency
- Find trends, correlations, or comparisons between metrics
- Perform any calculation that requires precision (do NOT do mental arithmetic)

Available tools and types:
{{types}}

Write an async arrow function. Use data you already fetched in previous tool calls.

EXAMPLE (statistics on fetched data):
async () => {
  const values = [62, 64, 61, 68, 65, 63, 60];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return { mean: Math.round(mean * 10) / 10, median, min: sorted[0], max: sorted.at(-1), stddev: Math.round(stddev * 10) / 10 };
}

Return a JSON object with your results. The user will see your text explanation, not the raw return value.`;

export function buildAnalysisTool(loader: WorkerLoader, tools: ToolSet) {
  const executor = new DynamicWorkerExecutor({ loader });
  return createCodeTool({
    tools,
    executor,
    description: ANALYSIS_TOOL_DESCRIPTION,
  });
}
