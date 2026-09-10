import readlineSync from "readline-sync";
import { client, pineconeIndex, driver, closeConnections } from "./2_config.js";
import { buildCypher } from "./9_cypher_templates.js";
import { resolveQueryEntities } from "./10_entity_resolver.js";
import { generateQueryPlan } from "./11_query_planner.js";

async function contextualizeQuery(userQuery, chatHistory) {
    if (chatHistory.length === 0) return userQuery;

    console.log(" Resolving conversational context...");

    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Given a chat history and the latest user question (which might reference prior context like "those", "he", "the first movie", etc.), reformulate the user question into a clear, standalone question that can be understood without the chat history. 
DO NOT answer the question, just reformulate it if needed. Otherwise, return it as is.`
            },
            ...chatHistory,
            { role: "user", content: userQuery }
        ]
    });

    const standaloneQuery = response.choices[0].message.content.trim();
    if (standaloneQuery !== userQuery) {
        console.log(` Contextualized Query: "${standaloneQuery}"`);
    }
    return standaloneQuery;
}

async function askMovieAgent(userQuery, chatHistory) {
    console.log(`\n==================================================`);
    console.log(` USER QUERY: "${userQuery}"`);
    console.log(`==================================================\n`);

    const standaloneQuery = await contextualizeQuery(userQuery, chatHistory);

    const resolution = await resolveQueryEntities(standaloneQuery);
    
    let graphData = [];
    let vectorData = [];
    let truncatedGraphData = [];

    if (resolution.entities.length > 0) {
        console.log("\n Generating Zod Query Plan...");
        const plan = await generateQueryPlan(standaloneQuery, resolution.entities);
        
        try {
            const { cypher, params } = buildCypher(plan);

            if (cypher && cypher.trim() !== "") {
                console.log("\n Executing Safe Cypher Query:\n", cypher);
                console.log(" Query Parameters:", params);

                const session = driver.session({ defaultAccessMode: "READ" });
                try {
                    const result = await session.run(cypher, params);
                    
                    graphData = result.records.map(record => {
                        const obj = record.toObject();
                        const cleanObj = {};
                        for (const [key, value] of Object.entries(obj)) {
                            const cleanKey = key.includes('.') ? key.split('.')[1] : key;
                            cleanObj[cleanKey] = value;
                        }
                        return cleanObj;
                    });

                    console.log(`\n Knowledge Graph returned ${graphData.length} records.`);
                    truncatedGraphData = graphData.slice(0, 20);
                } finally {
                    await session.close();
                }
            } else {
                console.log("\nPlan produced no valid Cypher query. Proceeding with vector search...");
            }
        } catch (cypherErr) {
            console.warn("\n Cypher execution skipped:", cypherErr.message);
        }
    } else {
        console.log("\n No graph entities found. Relying on vector search...");
    }

    console.log("\n Running Semantic Search on Pinecone...");
    const embeddingResponse = await client.embeddings.create({
        model: 'text-embedding-3-small',
        dimensions: 1024,
        input: standaloneQuery,
        encoding_format: "float"
    });
    
    const searchResult = await pineconeIndex.query({
        vector: embeddingResponse.data[0].embedding,
        topK: 5,
        includeMetadata: true
    });
    
    vectorData = searchResult.matches ? searchResult.matches.map(m => m.metadata) : [];
    console.log(` Vector DB returned ${vectorData.length} matches.`);

    console.log("\n Generating Final Response...");
    const systemPrompt = `
        You are an expert movie recommendation assistant. Knowledge Graph Facts:${JSON.stringify(truncatedGraphData, null, 2)}
        Vector Search Context:${JSON.stringify(vectorData, null, 2)}
        STRICT RULES:
        - You may ONLY answer the user's question using the facts provided in the Knowledge Graph or Vector Context above.
        - NEVER use your own outside knowledge.
        - If the answer is not contained in the data above, say "I don't have enough information in my database to answer that."
            `.trim();
    const messages = [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: userQuery }
    ];

    const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages
    });

    const aiAnswer = completion.choices[0].message.content;
    console.log("DEBUG: Raw AI response length ->", aiAnswer ? aiAnswer.length : "EMPTY");

    console.log("\n FINAL ANSWER:\n");
    console.log(aiAnswer);
    console.log("\n==================================================\n");

    return aiAnswer;
}
async function startInteractiveSession() {
    const chatHistory = []; 
    const MAX_HISTORY_MESSAGES = 6;

    console.log("\n Movie Recommendation AI Agent Ready");
    console.log(" Type your question below, or type 'exit' to quit.\n");

    while (true) {
        const userQuery = readlineSync.question("Ask a question: ");
        const trimmedQuery = userQuery.trim();
        
        if (trimmedQuery.toLowerCase() === "exit") {
            console.log("\n Closing database connections and exiting... Goodbye!\n");
            break;
        }

        if (!trimmedQuery) {
            console.log(" Please enter a valid query.");
            continue;
        }

        try {
            const aiAnswer = await askMovieAgent(trimmedQuery, chatHistory);

            chatHistory.push({ role: "user", content: trimmedQuery });
            chatHistory.push({ role: "assistant", content: aiAnswer });

            if (chatHistory.length > MAX_HISTORY_MESSAGES) {
                chatHistory.splice(0, chatHistory.length - MAX_HISTORY_MESSAGES);
            }

        } catch (err) {
            console.error("\n Error processing query:", err.message, "\n");
        }
    }

    await closeConnections();
}

await startInteractiveSession();