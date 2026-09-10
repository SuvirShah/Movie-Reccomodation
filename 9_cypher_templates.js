const ALLOWED_LABELS = new Set(["Movie", "Director", "Actor", "Genre", "Theme", "Award"]);
const ALLOWED_RELATIONSHIPS = new Set(["DIRECTED", "ACTED_IN", "BELONGS_TO", "EXPLORES", "WON"]);

const ALLOWED_PROPERTIES = {
  Movie: ["title", "year"],
  Director: ["name"],
  Actor: ["name"],
  Genre: ["name"],
  Theme: ["name"],
  Award: ["name", "category"],
};

const ALLOWED_OPERATORS = new Set(["=", "<>", ">", "<", ">=", "<=", "CONTAINS", "STARTS WITH"]);

const LABEL_VAR_MAP = {
  Movie: "m", Director: "d", Actor: "a", Genre: "g", Theme: "t", Award: "aw",
};

function validateStep(step) {
  switch (step.type) {
    case "traversal":
      if (step.from && !ALLOWED_LABELS.has(step.from)) throw new Error(`Invalid label: ${step.from}`);
      if (step.to && !ALLOWED_LABELS.has(step.to)) throw new Error(`Invalid label: ${step.to}`);
      if (step.rel && !ALLOWED_RELATIONSHIPS.has(step.rel)) throw new Error(`Invalid relationship: ${step.rel}`);
      break;
    case "filter":
      if (step.field) {
        const [label, prop] = step.field.split(".");
        if (!ALLOWED_LABELS.has(label)) throw new Error(`Invalid label: ${label}`);
        if (!ALLOWED_PROPERTIES[label]?.includes(prop)) throw new Error(`Invalid property: ${step.field}`);
      }
      if (step.op && !ALLOWED_OPERATORS.has(step.op)) throw new Error(`Invalid operator: ${step.op}`);
      break;
    default:
      break;
  }
}

function buildCypher(plan) {
  const steps = plan.steps || [];
  steps.forEach(validateStep);

  const matchClauses = [];
  const whereClauses = [];
  let returnClause = "";
  let limitClause = "";
  const params = {};
  let paramCounter = 0;

  for (const step of steps) {
    if (step.type === "traversal" && step.from && step.to && step.rel) {
      const fromVar = LABEL_VAR_MAP[step.from];
      const toVar = LABEL_VAR_MAP[step.to];
      matchClauses.push(`MATCH (${fromVar}:${step.from})-[:${step.rel}]->(${toVar}:${step.to})`);
    } else if (step.type === "filter" && step.field && step.op && step.value !== null) {
      const [label, prop] = step.field.split(".");
      const varName = LABEL_VAR_MAP[label];
      const paramName = `p${paramCounter++}`;
      params[paramName] = step.value;
      whereClauses.push(`${varName}.${prop} ${step.op} $${paramName}`);
    } else if (step.type === "projection" && step.fields && step.fields.length > 0) {
      const fields = step.fields.map((f) => {
        const [lbl, prp] = f.split(".");
        return `${LABEL_VAR_MAP[lbl]}.${prp}`;
      });
      returnClause = `RETURN ${step.distinct ? "DISTINCT " : ""}${fields.join(", ")}`;
    } else if (step.type === "limit" && step.value) {
      limitClause = `LIMIT ${step.value}`;
    }
  }

  // If there are no MATCH clauses, do not return invalid Cypher
  if (matchClauses.length === 0) {
    return { cypher: "", params: {} };
  }

  const cypher = [
    ...matchClauses,
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "",
    returnClause || "RETURN *",
    limitClause,
  ].filter((p) => p.length > 0).join("\n");

  return { cypher, params };
}

export { buildCypher };