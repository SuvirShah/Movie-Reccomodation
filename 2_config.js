import dotenv from "dotenv";
import { Pinecone } from '@pinecone-database/pinecone';
import { ChatOpenAI } from "@langchain/openai";
import neo4j from "neo4j-driver";
import OpenAI from "openai";


dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
});

const client=new OpenAI();

async function closeConnections() {
  await driver.close();
  console.log("All connections closed.");
}
export { driver, pinecone, pineconeIndex, model,client,closeConnections };