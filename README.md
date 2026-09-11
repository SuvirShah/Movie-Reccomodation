🎬 Movie Recommendation AI Agent

A Retrieval-Augmented Generation (RAG) movie recommendation agent built with Node.js, OpenAI, Neo4j, Pinecone, and semantic caching.

The project combines a Knowledge Graph and a Vector Database to answer natural-language movie questions. It also uses conversational query contextualization and a semantic cache so repeated or semantically similar questions can be answered without repeatedly querying Neo4j, Pinecone, and the LLM.

Important dataset note: The movie names in this project are intentionally not the real-world movie names. The source dataset uses titles such as Movie 0006, Movie 0178, Movie 0831, etc. These are legitimate titles from the provided dataset and are not IDs that should be replaced with titles such as Inception, Interstellar, Jaws, etc. The application therefore correctly returns dataset titles such as Movie 0178.

✨ Features

Natural-language movie queries

Conversational context resolution

LLM-based entity extraction

Entity resolution against Neo4j

Structured query planning

Safe Cypher generation with an allowlist

Neo4j Knowledge Graph retrieval

Pinecone semantic/vector retrieval

OpenAI embeddings

RAG-based final answer generation

Semantic response caching

Cache similarity thresholding

Cache poisoning protection for failed/insufficient answers

Local extraction cache for movie data

Separate ingestion and agent execution pipelines

🏗️ Architecture

The overall system works like this:

                         ┌─────────────────────┐
                         │      User Query     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Contextualization   │
                         │  Resolve follow-ups │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Semantic Cache     │
                         │  Pinecone Namespace │
                         └───────┬─────────┬───┘
                                 │         │
                          Cache HIT         │ Cache MISS
                                 │         ▼
                                 │  ┌──────────────────┐
                                 │  │ Entity Extraction│
                                 │  └────────┬─────────┘
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ Entity Resolution│
                                 │  │     Neo4j        │
                                 │  └────────┬─────────┘
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ Query Planner    │
                                 │  └────────┬─────────┘
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ Safe Cypher      │
                                 │  │ Builder           │
                                 │  └────────┬─────────┘
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ Neo4j Knowledge  │
                                 │  │ Graph            │
                                 │  └────────┬─────────┘
                                 │           │
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ Pinecone Vector  │
                                 │  │ Search            │
                                 │  └────────┬─────────┘
                                 │           │
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ OpenAI LLM       │
                                 │  │ Final Answer     │
                                 │  └────────┬─────────┘
                                 │           │
                                 │           ▼
                                 │  ┌──────────────────┐
                                 │  │ Save Answer to   │
                                 │  │ Semantic Cache   │
                                 │  └──────────────────┘
                                 │
                                 ▼
                         ┌─────────────────────┐
                         │   Cached Answer     │
                         └─────────────────────┘

🧩 Technologies Used

Technology

Purpose

Node.js

Application runtime

OpenAI

Entity extraction, query contextualization, query planning, final answer generation, embeddings

Neo4j

Knowledge Graph

Pinecone

Vector search + semantic cache

PDF parser

Extract movie records from the source PDF

JavaScript / ES Modules

Application code

📁 Project Structure

A typical project layout is:

Movie-recommendation/
│
├── 1_pipeline_runner.js
├── 2_config.js
├── 3_pdf_parser.js
├── 4_batch_maker.js
├── 5_entity_extractor.js
├── 6_graph_builder.js
├── 7_vector_builder.js
├── 9_cypher_templates.js
├── 10_entity_resolver.js
├── 11_query_planner.js
├── 12_agent.js
├── 13_semantic_cache.js
│
├── movies.pdf
├── movies_cache.json
├── package.json
├── package-lock.json
├── .env
├── .env.example
├── .gitignore
└── README.md

Keep the numbered filenames consistent with the imports in the project.

🔄 Data Ingestion Pipeline

The ingestion pipeline is responsible for preparing the databases before the agent is used.

Run:

node 1_pipeline_runner.js

The pipeline performs these steps:

movies.pdf
   ↓
PDF parsing
   ↓
Movie blocks
   ↓
OpenAI structured extraction
   ↓
movies_cache.json
   ↓
Neo4j Knowledge Graph
   ↓
Pinecone Vector Database

The extracted movie objects are cached locally in:

movies_cache.json

This prevents the project from repeatedly extracting the same movie information from the PDF.

🤖 Agent Pipeline

After the databases are populated, run:

node 12_agent.js

The interactive agent follows this process:

User question
    ↓
Conversation contextualization
    ↓
Semantic cache lookup
    ↓
Entity extraction
    ↓
Neo4j entity resolution
    ↓
Query plan generation
    ↓
Safe Cypher generation
    ↓
Neo4j query
    ↓
Pinecone semantic search
    ↓
LLM response generation
    ↓
Save response to semantic cache

💬 Example Queries

tell me some movies of nolan

can you tell me some movies of nolan

tell me some movies of steven spielberg

i want to know about movies by steven spielberg

show me movies directed by Christopher Nolan

The agent can also resolve conversational references such as:

What movies did Christopher Nolan direct?

What about Spielberg?

The second question can be converted into a standalone query using the conversation history.

🧠 Knowledge Graph

The Neo4j graph contains the following node types:

Movie
Director
Actor
Genre
Theme
Award

Relationships:

Director ──DIRECTED──> Movie

Actor ──ACTED_IN──> Movie

Movie ──BELONGS_TO──> Genre

Movie ──EXPLORES──> Theme

Movie ──WON──> Award

Example structure:

(Director {name: "Christopher Nolan"})
             |
             | DIRECTED
             ▼
(Movie {title: "Movie 0178", year: 2008})
             |
             | BELONGS_TO
             ▼
(Genre {name: "Action"})

🔎 Safe Cypher Generation

The application does not directly execute arbitrary Cypher generated by the LLM.

The project uses an allowlist of valid:

labels

relationships

properties

operators

The query planner first produces a structured plan.

That plan is validated and then converted into Cypher.

For example:

MATCH (d:Director)-[:DIRECTED]->(m:Movie)
WHERE d.name = $p0
RETURN DISTINCT m.title AS movie_title, m.year AS movie_year

Parameters are passed separately:

{
  p0: "Christopher Nolan"
}

This helps reduce unsafe query generation and keeps database access constrained to the supported schema.

🧠 Semantic Cache

The project uses Pinecone for two purposes:

Movie vector search

Semantic response caching

The semantic cache stores:

Question
Embedding
Generated Answer
Timestamp

The current cache configuration uses:

const SIMILARITY_THRESHOLD = 0.90;

The flow is:

New question
     ↓
Create embedding
     ↓
Search cache
     ↓
Similarity >= 0.90 ?
     │
 ┌───┴────┐
 YES      NO
 │         │
 ▼         ▼
Return    Run full
cached    RAG pipeline
answer        │
              ▼
           Save answer
           to cache

Example

First query:

tell me some movies of steven spielberg

Possible result:

Cache similarity score: 0.5899
Cache MISS

The full pipeline runs and the answer is cached.

A later paraphrase:

i want to know about movies by steven spielberg

may produce:

Cache similarity score: 0.9383
CACHE HIT
Skipping Neo4j, Pinecone and LLM.

This demonstrates that the cache works semantically rather than only using exact string matching.

🚫 Cache Poisoning Protection

The system does not save an answer when the LLM responds with:

I don't have enough information in my database to answer that.

This prevents an incorrect/empty answer from becoming a cached answer for future queries.

A separate cache namespace can also be used while developing new cache logic, for example:

query-cache-v2

This is useful when an older cache contains incorrect answers.

📌 Why the Movie Names Look Like Movie 0178

This project uses a source dataset in which movie titles are intentionally represented using values such as:

Movie 0006
Movie 0157
Movie 0178
Movie 0831

The real movie names are not mentioned in the source dataset.

Therefore, the application must not infer or substitute famous real-world titles.

For example:

Movie 0178

must remain:

Movie 0178

and must not be changed to:

The Dark Knight
Inception
Interstellar

unless those real names are explicitly present in the source data.

This is intentional behavior and not a data-cleaning bug.

The LLM prompt explicitly tells the model that these Movie XXXX titles are valid database titles.

⚙️ Running the Project on Any Machine

To make the project portable, do not hard-code local paths, API keys, database URLs, or personal credentials.

A new machine should only need:

Node.js
Git
OpenAI API key
Neo4j database
Pinecone account/index
Project files
Source dataset

1. Install Node.js

Install a modern Node.js LTS release.

Check:

node --version
npm --version

Then install dependencies:

npm install

Because package-lock.json should be committed, a fresh clone can also use:

npm ci

2. Clone the Repository

git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Movie-recommendation

3. Create the Environment File

Create:

.env

Do not commit this file to GitHub.

A recommended .env.example is:

OPENAI_API_KEY=your_openai_api_key

NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_pinecone_index_name

The exact variable names must match the names used by 2_config.js.

The important rule is that all machine-specific secrets and endpoints should come from environment variables.

4. Configure Neo4j

Create a Neo4j database using either:

Neo4j Aura

or a local Neo4j installation.

Then put the connection details into .env.

Example:

NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

The application creates indexes for the graph entities during ingestion.

5. Configure Pinecone

Create a Pinecone index with the same embedding dimension used by the project.

The project currently uses:

Embedding model: text-embedding-3-small
Dimensions: 1024

Make sure the Pinecone index is configured to accept:

1024 dimensions

Then add:

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name

6. Add the Dataset

The ingestion pipeline expects:

movies.pdf

in the project root.

The PDF is the source used by the parser and entity extractor.

If the dataset is not included in the GitHub repository, document where a new user should obtain it and place it at:

./movies.pdf

Because the source dataset intentionally does not mention real-world movie names, the application should preserve titles such as:

Movie 0178
Movie 0831

7. Build the Databases

Run:

node 1_pipeline_runner.js

This will:

Parse PDF
   ↓
Extract movies using OpenAI
   ↓
Save movies_cache.json
   ↓
Build Neo4j graph
   ↓
Create Pinecone vectors

You should see progress such as:

PDF parsed...
Found ... movie blocks
Finished! Extracted ... movies.
Building graph...
Graph built!
Pushing movies to Pinecone...
Vectors pushed to Pinecone DB

8. Start the Agent

After ingestion completes:

node 12_agent.js

You should see:

Movie Recommendation AI Agent Ready
Type your question below, or type 'exit' to quit.

Then enter a question:

tell me some movies of nolan

🧪 Testing the Semantic Cache

A simple cache test:

First request

tell me some movies of steven spielberg

Expected:

Cache MISS

Then:

Neo4j query
Pinecone search
LLM generation
Saved response to semantic cache

Second request

Use a semantically similar question:

i want to know about movies by steven spielberg

Expected:

Cache similarity score: 0.9383
CACHE HIT
Skipping Neo4j, Pinecone and LLM.

That confirms the semantic cache is functioning.

🔧 Configuration Recommendations

The current semantic cache threshold is:

const SIMILARITY_THRESHOLD = 0.90;

For this project, 0.90 is a good starting point.

A lower threshold increases cache hits but also increases the risk of returning an answer for a query that is only loosely related.

A higher threshold makes the cache more conservative.

For this project, prioritize:

Correctness > Cache hit rate

before optimizing performance.

🛑 Common Problems

Must pass in at least 1 record to upsert

Make sure the Pinecone upsert uses the current records format:

await pineconeIndex.namespace(CACHE_NAMESPACE).upsert({
  records: [
    {
      id: cacheId,
      values: queryEmbedding,
      metadata: {
        question: standaloneQuery,
        answer: aiAnswer,
        timestamp: new Date().toISOString()
      }
    }
  ]
});

Old incorrect answer keeps appearing

The semantic cache may contain an older bad response.

Use a new namespace during development:

const CACHE_NAMESPACE = "query-cache-v2";

Alternatively, delete the old cache namespace/index records.

Cache hit happens for unrelated questions

Increase:

const SIMILARITY_THRESHOLD = 0.90;

to something more conservative, such as:

const SIMILARITY_THRESHOLD = 0.93;

Then test again.

Unknown year

If Neo4j returns:

RETURN DISTINCT m.title AS movie_title

the year is not available to the LLM.

Prefer:

RETURN DISTINCT m.title AS movie_title, m.year AS movie_year

For a general movie query, including the year in the projection gives the LLM more useful information.

LLM says it has no information even though Neo4j returned records

Check:

========== DATA SENT TO LLM ==========

The retrieved records must appear there.

If Neo4j returns records but the section is empty, the issue is in the data formatting/retrieval layer rather than the final LLM.

🔐 GitHub Security

Never commit:

.env

or API credentials.

A recommended .gitignore:

node_modules/
.env
.env.*
!.env.example

movies_cache.json

*.log

.DS_Store
Thumbs.db

Whether movies.pdf should be committed depends on the dataset's licensing/distribution rights.

If the PDF is not redistributable, do not upload it to GitHub. Instead, explain in the README where an authorized user should obtain it.

🌍 Making the Repository Machine-Independent

Avoid code such as:

fs.readFileSync("C:\\Users\\suvir\\...")

or:

fs.readFileSync("C:/Users/suvir/...")

Use project-relative paths:

"./movies.pdf"

or construct paths with Node's path module:

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfPath = path.join(__dirname, "movies.pdf");

This makes the application work across:

Windows
Linux
macOS

without changing the source code.

📦 Recommended GitHub Files

A clean public repository should contain:

README.md
package.json
package-lock.json
.env.example
.gitignore
1_pipeline_runner.js
2_config.js
3_pdf_parser.js
4_batch_maker.js
5_entity_extractor.js
6_graph_builder.js
7_vector_builder.js
9_cypher_templates.js
10_entity_resolver.js
11_query_planner.js
12_agent.js
13_semantic_cache.js

Do not commit:

.env
node_modules/

and only commit movies.pdf if you have permission to redistribute it.

🚀 Quick Start

For a new machine:

git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Movie-recommendation
npm ci

Create .env:

OPENAI_API_KEY=...
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=...

Place the authorized source dataset here:

movies.pdf

Build the databases:

node 1_pipeline_runner.js

Start the agent:

node 12_agent.js

Test:

tell me some movies of nolan

📈 Example Runtime

A successful request may look like:

User Query
    ↓
Standalone Query
    ↓
Cache MISS
    ↓
Entity Extraction
    ↓
Neo4j
    ↓
70 Knowledge Graph Records
    ↓
Pinecone
    ↓
5 Vector Matches
    ↓
OpenAI
    ↓
Final Answer
    ↓
Save to Semantic Cache

A repeated request:

User Query
    ↓
Standalone Query
    ↓
Cache HIT
    ↓
Return Cached Answer

The second path avoids unnecessary database and LLM work.

📌 Design Decisions

Knowledge Graph as primary source

Neo4j is used for structured relationships such as:

director → movie
actor → movie
movie → genre
movie → theme
movie → award

Vector search as semantic context

Pinecone helps retrieve semantically related movie information that may not be represented by a direct structured query.

LLM as reasoning/generation layer

OpenAI is responsible for:

Entity extraction
Query contextualization
Query planning
Embedding generation
Final answer generation

Semantic cache for performance

Repeated or semantically similar questions can be answered from the cache without running the full retrieval and generation pipeline.

⚠️ Important Data Limitation

The application can only answer using information available in the supplied dataset.

Most importantly:

The real movie names are not mentioned in the source dataset.

Therefore, the project cannot reliably map:

Movie 0178

to a real movie title unless such a mapping exists in the source data.

This is intentional and should not be treated as a failure of the recommendation system.

🛠️ Future Improvements

Possible improvements include:

Better deterministic query planning

Consistent projection of movie_title and movie_year

Intent-aware cache keys

Cache evaluation using precision/false-hit metrics

Streaming LLM responses

Better ranking of graph + vector results

Automated tests

Docker support

CI/CD

Hosted Neo4j and Pinecone configuration

Web UI for the agent

Authentication and rate limiting

👤 Author

Suvir Shah

GitHub: <YOUR_GITHUB_PROFILE_URL>

📄 License

Add the license appropriate for your code and dataset.

For example:

MIT License

If the source movie dataset has different licensing restrictions, those restrictions must be respected independently of the application code.
