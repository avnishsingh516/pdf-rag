import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from 'bullmq';
import { QdrantVectorStore } from '@langchain/qdrant';
import {
  ollama,
  CHAT_MODEL,
  createEmbeddings,
  QDRANT_URL,
  COLLECTION_NAME,
  redisConnection,
} from './config.js';

const queue = new Queue('file-upload-queue', {
  connection: redisConnection,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  return res.json({ status: 'All Good!' });
});

app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  await queue.add(
    'file-ready',
    JSON.stringify({
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    })
  );
  return res.json({ message: 'uploaded' });
});

app.get('/chat', async (req, res) => {
  const userQuery = req.query.message;

  try {
    const embeddings = createEmbeddings();

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        collectionName: COLLECTION_NAME,
      }
    );
    const ret = vectorStore.asRetriever({
      k: 4,
    });
    const result = await ret.invoke(userQuery);

    const context = result.map((doc) => doc.pageContent).join('\n\n');

    const SYSTEM_PROMPT = `
    You must answer ONLY using the context below. Do not use any outside knowledge.
    If the answer is not in the context, say "I don't have enough information in the document to answer that."

    Context:
    ${context}
  `;

    const chatResult = await ollama.chat({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userQuery },
      ],
    });

    return res.json({
      message: chatResult.message.content,
      docs: result,
    });
  } catch (err) {
    console.error('Chat request failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(8000, () => console.log(`Server started on PORT:${8000}`));
