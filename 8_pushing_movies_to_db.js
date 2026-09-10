import fs from "fs";
import { createVectorDB} from "./7_vector_builder.js";
import { buildGraph } from "./6_graph_builder.js";
// import { extractEntity} from "./5_entity_extractor.js";
import { processAllMovies } from "./4_batch_maker.js";
import { closeConnections } from "./2_config.js";

async function runPipeline() {
    let extractedMovies=[];
    const cacheFile="./movies_cache.json";
    if(fs.existsSync(cacheFile)){
        console.log(" Found local cache! Loading movies from movies_cache.json...");
        const data=fs.readFileSync(cacheFile,"utf-8");
        extractedMovies=JSON.parse(data);
        console.log(` Loaded ${extractedMovies.length} movies from cache in 1 second.`);
    }
    else{
        try{
            console.log("Step 1: Parsing PDF and extracting structured data via OpenAI...");
            extractedMovies = await processAllMovies();
            fs.writeFileSync(cacheFile, JSON.stringify(extractedMovies, null, 2));
            console.log(`Extracted ${extractedMovies.length} movies successfully.`);
        }
        catch(err){
            console.error(" Extraction failed:", err);
            await closeConnections();
            return;
        }
    }
    if (extractedMovies.length===0) {
        console.log("  No movies found to process.");
        await closeConnections();
        return;
    }
    try{
        console.log("\n Step 2: Building Neo4j Knowledge Graph...");
        await buildGraph(extractedMovies);
        console.log("Graph Built Sucessfully \n");
    }
    catch(err){
        console.error("Neo4j Insertion Failed");
    }
    try{
        console.log("\n Step 3:Pushing Moivies To Pinecone\n");
        await createVectorDB(extractedMovies);
        console.log("Vectors pushed to Pinecone DB");
    }
    catch(err){
        console.error("Pinecone upload failed",err);
    }
    await closeConnections();
}
await runPipeline();