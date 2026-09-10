import { client, pineconeIndex } from "./2_config.js";

async function createVectorDB(entities) {
    console.log(`\nGenerating embeddings and pushing ${entities.length} movies to Pinecone...\n`);

    const BATCH_SIZE = 100;
    let vectors = [];

    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];

        const textContent = `
            Title: ${entity.movie.title} (${entity.movie.year})
            Director: ${entity.director.name}
            Actors: ${entity.actors.join(", ")}
            Genres: ${entity.genres.join(", ")}
            Themes: ${entity.themes.join(", ")}
            Awards: ${entity.awards.join(", ")}
        `.trim();

        const embedding = await client.embeddings.create({
            model: "text-embedding-3-small",
            dimensions: 1024,
            input: textContent,
            encoding_format: "float"
        });

        const vectorValues = embedding.data[0].embedding;

        vectors.push({
            id: `movie_${i + 1}`,
            values: vectorValues,
            metadata: {
                title: entity.movie.title,
                year: entity.movie.year,
                director: entity.director.name,
                genres: entity.genres,
            },
        });

        if (vectors.length === BATCH_SIZE) {
            await pineconeIndex.upsert({
                records: vectors
            });

            console.log(
                `   Uploaded batch up to movie ${i + 1}/${entities.length}`
            );

            vectors = [];
        }
    }

    if (vectors.length > 0) {
        await pineconeIndex.upsert({
            records: vectors
        });

        console.log(
            `   Uploaded final batch of ${vectors.length} movies.`
        );
    }

    console.log("\nAll movie vectors successfully pushed to Pinecone!");
}

export { createVectorDB };