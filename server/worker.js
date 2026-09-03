import { Worker } from 'bullmq';
import { QdrantVectorStore } from '@langchain/qdrant';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
  createEmbeddings,
  QDRANT_URL,
  COLLECTION_NAME,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  redisConnection,
} from './config.js';

const worker = new Worker(
  'file-upload-queue',
  async (job) => {
    console.log(`Job:`, job.data);
    const data = JSON.parse(job.data);
    /*
    Path: data.path
    read the pdf from path,
    chunk the pdf,
    call the embedding model for every chunk,
    store the chunk in qdrant db
    */

    // Load the PDF -- one Document per page
    const loader = new PDFLoader(data.path);
    const pages = await loader.load();

    // Split pages into chunks. Recursive splitting prefers paragraph, then
    // line, then word boundaries, so chunks break at natural seams instead of
    // mid-sentence. Page metadata (source, pageNumber) is carried onto every
    // chunk, so the citations in the UI keep working.
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const docs = await splitter.splitDocuments(pages);

    console.log(`Split ${pages.length} pages into ${docs.length} chunks`);

    const embeddings = createEmbeddings();

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        collectionName: COLLECTION_NAME,
      }
    );
    await vectorStore.addDocuments(docs);
    console.log(`All ${docs.length} chunks are added to vector store`);
  },
  {
    concurrency: 100,
    connection: redisConnection,
  }
);
