import { driver, pinecone, pineconeIndex, model, closeConnections } from "./2_config.js";


async function testConnections(){
    console.log("Testing all connections");
    try{
        const session=driver.session();
        const result = await session.run("RETURN 'Neo4j Connected!' AS message");
        console.log("Neo4j:", result.records[0].get("message"));
        await session.close();
    }
    catch(err){
        console.log("Error with Neo4J"+err);
    }


    try{
    const stats = await pineconeIndex.describeIndexStats();
    console.log("Pinecone: Connected | Vectors:", stats.totalRecordCount || 0);
    } 
    catch (err) {
    console.error("Pinecone:", err.message);
    }


    try{
        const response = await model.invoke("Checking connection just say 'Open Ai connected' nothing else");
        console.log(response.content.trim());
    }
    catch(err){
        console.log("Open Ai error"+err);
    }
    await closeConnections();
}
await testConnections();
