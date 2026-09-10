import { client } from "./2_config.js";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const StepSchema = z.object({
    type: z.enum(["traversal", "filter", "projection", "aggregation", "sort", "limit"]),
    from: z.string().nullable(),
    to: z.string().nullable(),
    rel: z.string().nullable(),
    field: z.string().nullable(),
    op: z.string().nullable(),
    value: z.union([z.string(), z.number()]).nullable(),
    fields: z.array(z.string()).nullable(),
    distinct: z.boolean().nullable(),
    function: z.string().nullable(),
    groupBy: z.string().nullable(),
    alias: z.string().nullable(),
    direction: z.string().nullable(),
});

const QueryPlanSchema = z.object({
    steps: z.array(StepSchema),
});

async function generateQueryPlan(query, resolvedEntities) {
    const prompt = `
You are a Cypher plan generator for a movie knowledge graph.
Construct a step-by-step execution plan using ONLY allowed step types.

STRICT RULES:
1. "from" and "to" MUST ALWAYS be Node Labels: "Movie", "Director", "Actor", "Genre", "Theme", "Award". NEVER put specific names like "Christopher Nolan" as a label!
2. To filter by a specific person or movie name, add a "filter" step! (e.g., field: "Director.name", op: "=", value: "Christopher Nolan").
3. IGNORE subjective adjectives like "good", "best", "great", "popular". Do NOT create arbitrary filters for them.
4. Always include a "projection" step specifying which fields to return (e.g., fields: ["Movie.title", "Movie.year"]).
5. If the query involves awards (e.g., "won an oscar", "award-winning"), ALWAYS include "Award.name" in the projection fields alongside "Movie.title".

Allowed step types & rules:
- traversal: "from" (Label), "to" (Label), "rel" ("DIRECTED", "ACTED_IN", "BELONGS_TO", "EXPLORES", "WON")
- filter: "field" ("Label.property", e.g. "Director.name", "Movie.title"), "op" ("=", "<>", ">", "<", "CONTAINS"), "value"
- projection: "fields" (array of "Label.property", e.g. ["Movie.title", "Movie.year", "Award.name"]), "distinct" (true/false)
- sort: "field" ("Label.property"), "direction" ("ASC" or "DESC")
- limit: "value" (number)

Example Plan for "Movies directed by Christopher Nolan":
[
  {"type": "traversal", "from": "Director", "to": "Movie", "rel": "DIRECTED", "field": null, "op": null, "value": null, "fields": null, "distinct": null, "function": null, "groupBy": null, "alias": null, "direction": null},
  {"type": "filter", "from": null, "to": null, "rel": null, "field": "Director.name", "op": "=", "value": "Christopher Nolan", "fields": null, "distinct": null, "function": null, "groupBy": null, "alias": null, "direction": null},
  {"type": "projection", "from": null, "to": null, "rel": null, "field": null, "op": null, "value": null, "fields": ["Movie.title", "Movie.year"], "distinct": true, "function": null, "groupBy": null, "alias": null, "direction": null}
]

User Query: "${query}"
Resolved Entities in Graph: ${JSON.stringify(resolvedEntities)}
    `.trim();

    try {
        const response = await client.responses.parse({
            model: 'gpt-4o-mini',
            input: [
                { role: 'system', content: "You generate strict database query execution plans." },
                { role: 'user', content: prompt }
            ],
            text: {
                format: zodTextFormat(QueryPlanSchema, "query_plan"),
            },
        });

        return response.output_parsed;
    } catch (err) {
        console.warn("⚠️ Query plan generation failed:", err.message);
        return { steps: [] };
    }
}

export { generateQueryPlan };