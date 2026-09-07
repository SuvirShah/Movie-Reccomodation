import fs from "fs";
import { PDFParse } from "pdf-parse";

// const pdfPath = "./movies.pdf";

async function parsePDF(path) {
  const dataBuffer = fs.readFileSync(path);

  const parser = new PDFParse({ data: dataBuffer });
  
  try {
    const pdfData = await parser.getText();
    // console.log(pdfData);
    const rawText = pdfData.text;
    console.log(`PDF parsed: ${pdfData.total} pages, ${rawText.length} characters`);
    const movieBlocks = rawText
      .split(/-{10,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0&& block.includes("Movie Title"));
      
    console.log(`Found ${movieBlocks.length} movie blocks`);
    // console.log(movieBlocks);
    return movieBlocks;
  } finally {
    await parser.destroy();
  }
}

// await parsePDF(pdfPath);
export { parsePDF };