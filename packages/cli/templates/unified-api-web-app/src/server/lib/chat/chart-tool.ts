import { tool } from "ai";
import { z } from "zod";

export const CHART_PALETTE = {
  blue: "#4269d0",
  yellow: "#efb118",
  coral: "#ff725c",
  teal: "#6cc5b0",
  green: "#3ca951",
  pink: "#ff8ab7",
  purple: "#a463f2",
  skyblue: "#97bbf5",
  brown: "#9c6b4e",
  grey: "#9498a0",
} as const;

export type ChartColor = keyof typeof CHART_PALETTE;

const PALETTE_NAMES = Object.keys(CHART_PALETTE) as [
  ChartColor,
  ...ChartColor[],
];

const CHART_TOOL_DESCRIPTION = `Render an inline chart in the chat. Use this when presenting numerical health data, trends, comparisons, or distributions.

AVAILABLE COLORS: blue, yellow, coral, teal, green, pink, purple, skyblue, brown, grey

EXAMPLES:

1. Single time-series (heart rate over a week):
{"title":"Resting Heart Rate","data":[{"date":"Mon","rhr":62},{"date":"Tue","rhr":64},{"date":"Wed","rhr":61}],"series":[{"dataKey":"rhr","name":"Resting HR","color":"coral"}],"xAxisDataKey":"date","unit":"bpm"}

2. Multi-series with dual y-axis (steps + calories):
{"title":"Steps vs Active Calories","data":[{"day":"Mon","steps":8500,"calories":320},{"day":"Tue","steps":12000,"calories":480}],"series":[{"dataKey":"steps","name":"Steps","type":"bar","color":"blue"},{"dataKey":"calories","name":"Active Cal","type":"line","yAxisId":"right","color":"coral"}],"xAxisDataKey":"day","yAxisLabel":"Steps","yAxisRightLabel":"kcal"}

3. Pie chart (macronutrient split):
{"title":"Today's Macros","chartType":"pie","data":[{"name":"Protein","grams":120},{"name":"Carbs","grams":200},{"name":"Fat","grams":65}],"series":[{"dataKey":"grams"}],"nameKey":"name","unit":"g"}

RULES:
- Use chartType "cartesian" (default) for time-series, trends, and comparisons. Use "pie" only for part-of-whole distributions.
- Always set xAxisDataKey when your x-axis key is not obvious.
- Use referenceLines to mark targets or thresholds (e.g. step goal of 10000, resting HR zone).
- Use yAxisId "right" + yAxisRightLabel when mixing series with different units or scales.
- Set unit to keep tooltip values meaningful.
- Choose colors that are semantically meaningful (e.g. coral for heart rate, green for activity, blue for sleep).
- For multi-series, pick colors with high contrast against each other.`;

export const renderChartTool = tool({
  description: CHART_TOOL_DESCRIPTION,
  inputSchema: z.object({
    title: z.string().describe("Chart title shown above the chart"),
    chartType: z
      .enum(["cartesian", "pie"])
      .default("cartesian")
      .describe(
        "Use 'cartesian' for line/bar/area/scatter charts. Use 'pie' for pie/donut charts.",
      ),
    data: z
      .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
      .describe(
        "Flat array of data objects. Each object has a shared x-axis key and one or more numeric value keys. Use null for missing values.",
      ),
    series: z
      .array(
        z.object({
          dataKey: z
            .string()
            .describe("Key in each data object for this series' values"),
          name: z
            .string()
            .optional()
            .describe("Display name for legend/tooltip. Defaults to dataKey."),
          type: z
            .enum(["line", "bar", "area", "scatter"])
            .default("line")
            .describe("Visual type for this series"),
          color: z
            .enum(PALETTE_NAMES)
            .optional()
            .describe("Color name from the palette. Auto-assigned if omitted."),
          yAxisId: z
            .enum(["left", "right"])
            .default("left")
            .describe(
              "Which y-axis this series binds to. Use 'right' for a second scale.",
            ),
          stackId: z
            .string()
            .optional()
            .describe("Series with the same stackId are stacked together"),
        }),
      )
      .min(1)
      .describe("One or more data series to render"),
    xAxisDataKey: z
      .string()
      .optional()
      .describe(
        "Key in each data object for x-axis labels. Defaults to the first string-valued key found.",
      ),
    yAxisLabel: z.string().optional().describe("Label for the left y-axis"),
    yAxisRightLabel: z
      .string()
      .optional()
      .describe(
        "Label for the right y-axis (only if a series uses yAxisId 'right')",
      ),
    unit: z
      .string()
      .optional()
      .describe("Unit suffix shown in tooltips (e.g. 'bpm', 'steps', 'kg')"),
    referenceLines: z
      .array(
        z.object({
          axis: z
            .enum(["x", "y"])
            .default("y")
            .describe("Which axis the line is perpendicular to"),
          value: z
            .union([z.string(), z.number()])
            .describe("Position on the axis"),
          label: z
            .string()
            .optional()
            .describe("Text label for the reference line"),
          color: z
            .enum(PALETTE_NAMES)
            .optional()
            .describe("Color name from the palette. Defaults to grey."),
        }),
      )
      .optional()
      .describe(
        "Optional horizontal or vertical reference lines (e.g. target heart rate, goal weight)",
      ),
    nameKey: z
      .string()
      .optional()
      .describe(
        "For pie charts: the key in each data object for slice labels. Defaults to 'name'.",
      ),
    donut: z
      .boolean()
      .default(false)
      .describe(
        "For pie charts: render as a donut (hollow center) instead of a filled pie",
      ),
  }),
  execute: async (params) => ({ rendered: true, ...params }),
});
