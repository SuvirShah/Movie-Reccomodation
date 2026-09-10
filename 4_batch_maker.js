import {parsePDF} from "./3_pdf_parser.js";
import { extractEntity } from "./5_entity_extractor.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunkArray(array,chunkSize){
    const chunks=[];
    for(let i=0;i<array.length;i+=chunkSize){
        chunks.push(array.slice(i,i+chunkSize));
    }
    return chunks;
}

async function processAllMovies(){
    const movieblocks=await parsePDF("./movies.pdf");

    const CONCURRENCY_LIMIT = 10; 
    const batches = chunkArray(movieblocks, CONCURRENCY_LIMIT);
    
    const allExtractedMovies=[];
    console.log("Chunking movies into 10 a block");
    for(let i=0;i<batches.length;i++){
        const batchedPromises=batches[i].map(block=>extractEntity(block));
        const batchResult=await Promise.all(batchedPromises);
        batchResult.forEach(moviesArr => {
            if (moviesArr && moviesArr.length > 0) {
                allExtractedMovies.push(...moviesArr);
            }
        });
        if(i<batches.length-1){
            await delay(1500); 
        }
    }
    console.log(`Finished! Extracted ${allExtractedMovies.length} movies.`);
    return allExtractedMovies;
}
export {processAllMovies};