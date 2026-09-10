import { client, driver } from "./2_config.js";

const NODE_TYPES = [
  { label: "Movie", property: "title" },
  { label: "Director", property: "name" },
  { label: "Actor", property: "name" },
  { label: "Genre", property: "name" },
  { label: "Theme", property: "name" }
];

async function extractEntities(query) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract ALL names, titles, and specific terms from the query. 
        Respond ONLY with a JSON array of strings. No markdown.
        Example: "Action movies with Tom Hardy" -> ["Action", "Tom Hardy"]`
      },
      { role: "user", content: query }
    ]
  });

  try {
    let raw = response.choices[0].message.content.trim();
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function resolveEntity(entityName) {
  const session = driver.session({ defaultAccessMode: "READ" });
  const matches = [];

  try {
    for (const { label, property } of NODE_TYPES) {
      const result = await session.run(
        `MATCH (n:${label})
         WHERE toLower(n.${property}) CONTAINS toLower($name)
         RETURN n.${property} AS nodeName, labels(n)[0] AS label
         LIMIT 3`,
        { name: entityName }
      );

      for (const record of result.records) {
        matches.push({
          searchTerm: entityName,
          label: record.get("label"),
          nodeName: record.get("nodeName")
        });
      }
    }
  } finally {
    await session.close();
  }
  return matches;
}

async function resolveQueryEntities(query) {
  console.log(" Extracting entities from query...");
  const entityNames = await extractEntities(query);
  
  if (entityNames.length === 0) return { query, entities: [] };

  console.log(`Found terms: [${entityNames.join(", ")}]. Checking graph...`);
  const resolved = [];

  for (const name of entityNames) {
    const matches = await resolveEntity(name);
    if (matches.length > 0) {
      resolved.push(...matches);
    }
  }

  return { query, entities: resolved };
}

export { resolveQueryEntities };