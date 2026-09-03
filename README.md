# PDF RAG

Upload a PDF, ask questions about it, get answers grounded in the document with page-level citations.

The system is a **Retrieval-Augmented Generation (RAG)** pipeline: instead of fine-tuning a model on your document, it stores the document as searchable vectors, retrieves only the passages relevant to each question, and hands those to an LLM as context. The LLM is instructed to answer *only* from that context, so it cites real pages instead of hallucinating.

Chat runs on **Ollama Cloud**. Embeddings run **locally in-process** via ONNX, so an Ollama API key is the only credential required.
