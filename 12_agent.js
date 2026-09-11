import readlineSync from "readline-sync";
import {client,pineconeIndex,driver,closeConnections} from "./2_config.js";
import {getCachedAnswer,saveToCache} from "./13_semantic_cache.js";
import {buildCypher} from "./9_cypher_templates.js";
import {resolveQueryEntities} from "./10_entity_resolver.js";
import {generateQueryPlan} from "./11_query_planner.js";
const MAX_GRAPH_RESULTS_FOR_LLM = 50;

const MAX_VECTOR_RESULTS_FOR_LLM = 5;

const MAX_HISTORY_MESSAGES = 6;

async function contextualizeQuery(userQuery,chatHistory) {
    if (chatHistory.length === 0) {
        return userQuery;
    }
    console.log("\n Resolving conversational context...");
    try {
        const response=await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role:"system",
                        content: `You are a query contextualization assistant.Your ONLY job is to rewrite the latest user question into a standalone question.
                    Use the conversation history to resolve references such as:
                    - he
                    - she
                    - they
                    - those movies
                    - that movie
                    - the first movie
                    - his movies
                    - her movies
                    - similar movies
                    IMPORTANT:
                    1. Do NOT answer the question.
                    2. Do NOT add information that is not present in the conversation.
                    3. If the question is already standalone, return it unchanged.
                    4. Return ONLY the rewritten question.`.trim()
                    },
                    ...chatHistory,
                    {
                        role: "user",
                        content: userQuery
                    }
                ]
            });
        const standaloneQuery =response.choices[0].message.content.trim();
        if (standaloneQuery !== userQuery){
            console.log(` Contextualized Query: "${standaloneQuery}"`);
        }
        return standaloneQuery;
    } 
    catch (err) {
        console.warn(" Contextualization failed:",err.message );
        return userQuery;
    }
}
function formatGraphData(graphData) {
    if (!graphData ||graphData.length === 0) {
        return "No Knowledge Graph records were returned.";
    }
    return graphData.map((record, index)=>{
            const movieTitle =
                record.movie_title ??
                record.m_title ??
                record.title ??
                "Unknown title";
            const movieYear =
                record.movie_year ??
                record.m_year ??
                record.year ??
                "Unknown year";
            return `${index + 1}. ${movieTitle} (${movieYear})`;
        }).join("\n");
}
function formatVectorData(vectorData) {

    if (!vectorData ||vectorData.length === 0) {
        return "No Vector Search records were returned.";
    }
    return vectorData.map((item, index) => { return `${index + 1}. ${JSON.stringify(item)}`;}).join("\n");
}
async function askMovieAgent(userQuery,chatHistory) {
    const startTime = Date.now();
    console.log(`\n==================================================`);
    console.log(` USER QUERY: "${userQuery}"` );
    console.log(`==================================================\n`);
    const standaloneQuery =await contextualizeQuery( userQuery,chatHistory);
    console.log(` Standalone query: "${standaloneQuery}"`);
    console.log("\n Checking semantic cache...");
    const cacheCheck =await getCachedAnswer(standaloneQuery);
    if(cacheCheck.cached) {
        const timeTaken =Date.now()-startTime;
        console.log( `\n CACHE HIT (Similarity: ${cacheCheck.score.toFixed(4)})!`);
        console.log(" Skipping Neo4j, Pinecone and LLM.");
        console.log(` Response served in: ${timeTaken}ms`);
        console.log("\n FINAL ANSWER (From Cache):\n");
        console.log(cacheCheck.answer);
        console.log("\n==================================================\n");
        return cacheCheck.answer;
    }
    console.log(" Cache MISS. Running full pipeline...");
    const resolution =await resolveQueryEntities(standaloneQuery);
     console.log(`\nFound terms: [${resolution.entities.map(entity => entity.searchTerm).join(", ")}]. Checking graph...`);
    let graphData = [];
    if (resolution.entities.length > 0){
        console.log("\n Generating Zod Query Plan...");
        const plan =await generateQueryPlan(standaloneQuery,resolution.entities);
        try {
            const {cypher,params} =buildCypher(plan);
            if (cypher &&cypher.trim() !== ""){
                console.log("\n Executing Safe Cypher Query:");
                console.log(cypher);
                console.log( "\n Query Parameters:", params);
                const session =driver.session({defaultAccessMode:"READ"});
                try {
                    const result =await session.run(cypher,params );
                    graphData =result.records.map(record =>record.toObject());
                    console.log(`\n Knowledge Graph returned ${graphData.length} records.`);
                } 
                finally {
                    await session.close();
                }
            } 
            else {
                console.log("\n Plan produced no valid Cypher query.");
            }
        } 
        catch (err){
            console.warn("\n Cypher execution skipped:",err.message);
        }
    } 
    else {
        console.log("\n No graph entities found.");
    }
    const graphDataForLLM =graphData.slice(0, MAX_GRAPH_RESULTS_FOR_LLM);
    console.log("\n Running Semantic Search on Pinecone...");
    let queryEmbedding = null;
    let vectorData = [];
    try {
        const embeddingResponse =await client.embeddings.create({
                model: "text-embedding-3-small",
                dimensions: 1024,
                input: standaloneQuery,
                encoding_format: "float"
            });
        queryEmbedding=embeddingResponse.data[0].embedding;
        const searchResult =await pineconeIndex.query({
                vector:queryEmbedding,
                topK:MAX_VECTOR_RESULTS_FOR_LLM,
                includeMetadata:true
            });
        if (searchResult.matches&&searchResult.matches.length > 0) {
            vectorData =searchResult.matches.map(match => match.metadata || {});
        }
        console.log(` Vector DB returned ${vectorData.length} matches.`);
    } 
    catch (err) {
        console.warn(" Vector search failed:",err.message);
    }
    const formattedGraphData =formatGraphData( graphDataForLLM);
    const formattedVectorData =formatVectorData(vectorData);
    console.log("\n========== DATA SENT TO LLM ==========");
    console.log("\nKNOWLEDGE GRAPH:");
    console.log(formattedGraphData );
    console.log("\nVECTOR SEARCH:");
    console.log(formattedVectorData);
    console.log("\n======================================");
    const systemPrompt = `
                You are a movie recommendation assistant.
                You have access to information retrieved from a
                Knowledge Graph and a Vector Database.
                The Knowledge Graph is the PRIMARY source of truth.
                ==================================================
                KNOWLEDGE GRAPH
                ==================================================
                ${formattedGraphData}
                ==================================================
                VECTOR SEARCH
                ==================================================
                ${formattedVectorData}
                ==================================================
                IMPORTANT INSTRUCTIONS
                ==================================================
                1. Answer the user's question using the supplied data.

                2. The Knowledge Graph contains factual relationships
                between movies, directors, actors, genres, themes
                and awards.

                3. If the Knowledge Graph contains relevant records,
                you SHOULD answer the question using those records.

                4. Movie titles such as "Movie 0157", "Movie 0831",
                "Movie 0260", etc. are VALID movie titles in this
                database. Do NOT assume they are errors or IDs.

                5. Do NOT replace database movie titles with real-world
                movie titles from your own knowledge.

                6. Do NOT invent information.

                7. You do NOT need both Knowledge Graph and Vector
                Search information. Relevant information from either
                source is sufficient.

                8. If the Knowledge Graph contains movies directed by
                the requested director, list those movies.

                9. If the user asks for "some movies", provide up to
                5 relevant movies.

                10. If year information is available, include the year.

                11. If genre information is available, include genres.

                12. Only say:

                "I don't have enough information in my database to answer that."

                when the supplied Knowledge Graph and Vector Search
                contain NO information relevant to the question.

                13. Keep the answer concise.

                ==================================================

                Now answer the user's question.`.trim();
    console.log("\n Generating Final Response...");
    let aiAnswer;
    try {
        const messages =[
            {
                role: "system",
                content:systemPrompt
            },
            {
                role: "user",
                content:standaloneQuery
            }
        ];
        const completion =await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages
            });
        aiAnswer=completion.choices[0].message.content.trim();
    } 
    catch (err) {
        console.error("\n LLM generation failed:",err.message);
        throw err;
    }
    const timeTaken =Date.now() - startTime;
    console.log("\n FINAL ANSWER:\n");
    console.log(aiAnswer);
    console.log(`\n Total Execution Time: ${timeTaken}ms`);
    console.log("\n==================================================\n");
    await saveToCache(standaloneQuery,queryEmbedding,aiAnswer);
    return aiAnswer;
}
async function startInteractiveSession() {
    const chatHistory = [];
    console.log("\n Movie Recommendation AI Agent Ready");
    console.log(" Type your question below, or type 'exit' to quit.\n");
    while (true) {
        const userQuery =readlineSync.question("Ask a question: ");
        const trimmedQuery =userQuery.trim();
        if (trimmedQuery.toLowerCase() ==="exit"){
            console.log("\n Closing database connections and exiting... Goodbye!\n");
            break;
        }
        if(!trimmedQuery) {
            console.log(" Please enter a valid query.");
            continue;
        }
        try {
            const aiAnswer =await askMovieAgent(trimmedQuery,chatHistory);
            chatHistory.push({
                role: "user",
                content:trimmedQuery
            });
            chatHistory.push({
                role: "assistant",
                content:aiAnswer
            });
            if (chatHistory.length >MAX_HISTORY_MESSAGES) {
                chatHistory.splice(0,chatHistory.length-MAX_HISTORY_MESSAGES);
            }
        } 
        catch (err) {
            console.error("\n Error processing query:",err.message,"\n");
        }
    }
    await closeConnections();
}
await startInteractiveSession();