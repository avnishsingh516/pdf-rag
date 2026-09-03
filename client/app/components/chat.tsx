'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Send } from 'lucide-react';
import * as React from 'react';

interface Doc {
  pageContent?: string;
  metadata?: {
    loc?: {
      pageNumber?: number;
    };
    source?: string;
  };
}

interface IMessage {
  role: 'assistant' | 'user';
  content?: string;
  documents?: Doc[];
}

// Mirrors the server pipeline: embed the query, hit Qdrant, then call Ollama
// Cloud. The last stage covers the first-request case, where the local ONNX
// embedding model is still downloading and the wait is much longer than usual.
const LOADING_STAGES = [
  { at: 0, label: 'Understanding your question…' },
  { at: 1500, label: 'Searching your document…' },
  { at: 4000, label: 'Writing the answer…' },
  { at: 12000, label: 'Still working — the first answer takes longer while the embedding model loads…' },
];

const fileNameFromSource = (source?: string) => {
  if (!source) return null;
  const raw = source.split(/[\\/]/).pop() ?? source;
  // strip the "timestamp-random-" upload prefix so it reads cleanly
  return raw.replace(/^\d+-\d+-/, '');
};

const ChatComponent: React.FC = () => {
  const [message, setMessage] = React.useState<string>('');
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingStage, setLoadingStage] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, loadingStage]);

  React.useEffect(() => {
    if (!isLoading) {
      setLoadingStage(0);
      return;
    }
    const timers = LOADING_STAGES.slice(1).map((stage, i) =>
      setTimeout(() => setLoadingStage(i + 1), stage.at)
    );
    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  const handleSendChatMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setMessage('');
    setIsLoading(true);

    try {
      const res = await fetch(
        `http://localhost:8000/chat?message=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data?.message ?? 'No response received.',
          documents: data?.docs,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Couldn't reach the server. Is it running on port 8000?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendChatMessage();
  };

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.length === 0 && (
            <div className="mt-24 text-center text-sm text-[#5c5c6e]">
              Upload a PDF, then ask a question about it.
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#6c47ff] text-white'
                    : 'bg-[#16161f] text-[#e8e8ec] border border-[#232332]'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.documents && msg.documents.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#232332] pt-3">
                    {msg.documents.map((doc, i) => (
                      <span
                        key={i}
                        title={doc.pageContent?.slice(0, 200)}
                        className="flex items-center gap-1.5 rounded-full bg-[#0a0a0f] border border-[#2a2a3a] px-2.5 py-1 font-mono text-[11px] text-[#8b8ba0]"
                      >
                        <FileText size={11} />
                        {fileNameFromSource(doc.metadata?.source)}
                        {doc.metadata?.loc?.pageNumber && (
                          <span className="text-[#6c47ff]">
                            · p.{doc.metadata.loc.pageNumber}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div
                role="status"
                aria-live="polite"
                className="flex max-w-[80%] items-center gap-2.5 rounded-2xl border border-[#232332] bg-[#16161f] px-4 py-3 text-sm text-[#8b8ba0]"
              >
                <Loader2 size={14} className="shrink-0 animate-spin text-[#6c47ff]" />
                <span>{LOADING_STAGES[loadingStage].label}</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t border-[#1a1a24] bg-[#0a0a0f] px-6 py-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something about your document…"
            disabled={isLoading}
            className="border-[#232332] bg-[#16161f] text-[#e8e8ec] placeholder:text-[#5c5c6e]"
          />
          <Button
            onClick={handleSendChatMessage}
            disabled={!message.trim() || isLoading}
            className="bg-[#6c47ff] hover:bg-[#5b3ce0] text-white shrink-0"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;