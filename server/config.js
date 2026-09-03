import { Ollama } from 'ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';

/*
  Central config for the RAG pipeline.

  Chat runs on Ollama Cloud (https://ollama.com) using an API key -- no local
  model, no GPU, nothing to pull.

  Embeddings are a separate choice because Ollama Cloud does not host embedding
  models: https://ollama.com/search?c=cloud&c=embedding returns nothing, and no
  embedding model in the library carries a "-cloud" tag. So the API key that
  serves chat cannot serve embeddings. Pick a provider with EMBEDDING_PROVIDER.
*/

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See server/.env.example.`
    );
  }
  return value;
};

// --- Chat: Ollama Cloud ------------------------------------------------------

export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'https://ollama.com';

// Cloud model names are used without the "-cloud" suffix when calling
// ollama.com directly; the suffix only applies to a local `ollama run`.
export const CHAT_MODEL = process.env.OLLAMA_MODEL ?? 'gpt-oss:120b';

export const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: {
    Authorization: `Bearer ${requireEnv('OLLAMA_API_KEY')}`,
  },
});

// --- Embeddings --------------------------------------------------------------

// Defaults to "local" so the Ollama Cloud key is the only credential this
// project needs. Embeddings then run in-process via ONNX -- no second API key,
// no ollama container.
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ?? 'local';

// Each provider emits a different vector width, and Qdrant fixes the width when
// a collection is created. Defaulting the collection name per provider keeps a
// switch from colliding with vectors written by the previous one.
const EMBEDDING_PROVIDERS = {
  local: {
    defaultModel: 'Xenova/all-MiniLM-L6-v2', // 384 dims
    defaultCollection: 'pdf-rag-local',
    // Runs the ONNX model inside this Node process. Weights (~25MB) download
    // from HuggingFace on first use, then cache to disk. No API key.
    create: (model) => new HuggingFaceTransformersEmbeddings({ model }),
  },
  openai: {
    defaultModel: 'text-embedding-3-small', // 1536 dims
    defaultCollection: 'pdf-rag-openai',
    create: (model) =>
      new OpenAIEmbeddings({
        model,
        apiKey: requireEnv('OPENAI_API_KEY'),
      }),
  },
  ollama: {
    defaultModel: 'nomic-embed-text', // 768 dims
    defaultCollection: 'pdf-rag-ollama',
    // Points at a self-hosted Ollama, not the cloud -- see the note above.
    create: (model) =>
      new OllamaEmbeddings({
        model,
        baseUrl: process.env.OLLAMA_EMBED_URL ?? 'http://localhost:11434',
      }),
  },
};

const provider = EMBEDDING_PROVIDERS[EMBEDDING_PROVIDER];

if (!provider) {
  throw new Error(
    `Unknown EMBEDDING_PROVIDER "${EMBEDDING_PROVIDER}". ` +
      `Expected one of: ${Object.keys(EMBEDDING_PROVIDERS).join(', ')}.`
  );
}

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? provider.defaultModel;

export const createEmbeddings = () => provider.create(EMBEDDING_MODEL);

// --- Chunking ----------------------------------------------------------------

/*
  PDF pages are split before embedding. Two reasons:

  1. Precision. One vector per page has to represent every topic on that page,
     so it matches none of them strongly, and k=4 then hands the LLM four whole
     pages when the answer is usually a couple of sentences.
  2. Truncation. all-MiniLM-L6-v2 hard-truncates at 512 tokens (measured), and
     pages in a dense PDF routinely run past that.

  1000 chars is roughly 250 tokens, comfortably inside the 512 ceiling with room
  for the longer-context providers too. The overlap keeps an answer that straddles
  a chunk boundary from being cut in half.
*/
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 1000);
export const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 200);

// --- Stores ------------------------------------------------------------------

export const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';

export const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION ?? provider.defaultCollection;

// Deliberately not REDIS_HOST/REDIS_PORT -- those are commonly already exported
// machine-wide for an unrelated Redis, which would silently hijack the queue.
export const redisConnection = {
  host: process.env.VALKEY_HOST ?? 'localhost',
  port: Number(process.env.VALKEY_PORT ?? 6380),
};
