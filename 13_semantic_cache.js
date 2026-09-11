import { client, pineconeIndex } from "./2_config.js";
const CACHE_NAMESPACE = "query-cache-v2";
const SIMILARITY_THRESHOLD = 0.90;
async function getCachedAnswer(standaloneQuery) {
    let queryEmbedding = null;
    try {
        const embeddingResponse = await client.embeddings.create({
                model: "text-embedding-3-small",
                dimensions: 1024,
                input: standaloneQuery,
                encoding_format: "float"
            });
        queryEmbedding=embeddingResponse.data[0].embedding;
        if (!queryEmbedding ||!Array.isArray(queryEmbedding)||queryEmbedding.length === 0){
            console.warn(" Invalid embedding generated.");
            return {cached: false,queryEmbedding: null};
        }
        const cacheResult =await pineconeIndex.namespace(CACHE_NAMESPACE).query({
                    vector: queryEmbedding,
                    topK: 1,
                    includeMetadata: true
                });
        if (cacheResult.matches &&cacheResult.matches.length > 0){
            const bestMatch =cacheResult.matches[0];
            const score =bestMatch.score ?? 0;
            console.log(` Cache similarity score: ${score.toFixed(4)}`);
            if (score >= SIMILARITY_THRESHOLD &&bestMatch.metadata?.answer){
                return {cached: true,answer:bestMatch.metadata.answer,score,queryEmbedding};
            }
        }
        return {cached: false,queryEmbedding};
    } 
    catch (err) {
        console.warn(" Cache check failed, proceeding with full execution:",err.message);
        return {cached: false, queryEmbedding};
    }
}
async function saveToCache(standaloneQuery,queryEmbedding,aiAnswer){
    if (!aiAnswer ||aiAnswer.toLowerCase().includes("i don't have enough information in my database")){
        console.log(" Skipping cache save for insufficient-information response.");
        return;
    }
    if (!queryEmbedding||!Array.isArray(queryEmbedding) ||queryEmbedding.length=== 0){
        console.warn(" Skipping cache save: Invalid query embedding.");
        return;
    }
    try {
        const cacheId = `cache_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await pineconeIndex.namespace(CACHE_NAMESPACE).upsert({
                records: [
                    {
                        id: cacheId,
                        values: queryEmbedding,
                        metadata: {
                             question:standaloneQuery,
                            answer:aiAnswer,
                            timestamp:new Date().toISOString()
                        }
                    }
                ]
            });
        console.log(" Saved response to semantic cache.");
    } catch (err) {
        console.warn("Failed to write to cache:",err.message);
    }
}
export {getCachedAnswer,   saveToCache};