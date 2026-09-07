import {client} from "../Movie reccomodation/2_config";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
const MovieSchema =z.object({
  movie: z.object({
    title: z.string(),
    year: z.number(),
  }),
  director: z.object({
    name: z.string(),
  }),
  actors: z.array(z.string()),
  genres: z.array(z.string()),
  themes: z.array(z.string()),
  awards: z.array(z.string()),
});
const ExtractionSchema = z.object({
  movies: z.array(MovieSchema)
});
const Max_Retries=3;

const EXTRACTION_PROMPT = `You are a precise entity extractor for a movie knowledge graph.

From the attached PDF, extract movies {START} through {END} (by their order in the document).

For EACH movie, output this EXACT JSON structure:
{
  "movie": {"title": "string", "year": number},
  "director": {"name": "string"},
  "actors": ["string"],
  "genres": ["string"],
  "themes": ["string"],
  "awards": ["string"]
}

Rules:
- If awards say "None", return awards as empty array []
- Keep exact names as written in the PDF
- Year must be a number, not string
- Return a JSON ARRAY of objects: [{...}, {...}, ...]
- Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

async function extractEntity(textChunk, attempt = 1){
    try{
        const response=await client.responses.parse({
            model: 'gpt-4o-mini',
            input:[{
                    role:'system',
                    content:EXTRACTION_PROMPT
                },
                {
                    role:'user',
                    content:`Extract data from this text:\n\n${textChunk}`
                }
            ],
            text: {
                format:zodTextFormat(ExtractionSchema, "movie_extraction"),
            },
        });
        for(const output of response.output){
            if(output.type==='message'){
                for(const item of output.content){
                    if(item.type==='refusal'){
                        console.warn("Model refused to extract:",item.refusal);
                        return [];
                    }
                }
            }
        }
        return response.output_parsed.movies;
    }
    catch(error){
        if (error.status === 429&&attempt<=Max_Retries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited. Retrying in ${waitTime/1000}s...`);
        await delay(waitTime);
        return extractEntity(textChunk, attempt + 1);
        }
        console.error("Failed:",error.message);
        return [];
    }
}

export {extractEntity};