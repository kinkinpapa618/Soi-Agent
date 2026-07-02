import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Bot, User, Volume2, VolumeX, ChevronDown } from "lucide-react";
import { useProcessChat } from "@/hooks/use-chat";
import { useSpeech } from "@/hooks/use-speech";

import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const STORAGE_KEY = "soi_chat_messages";

function loadMessages(): Message[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved, (k, v) => k === "timestamp" ? new Date(v) : v);
  } catch {}
  return [{
    id: "intro",
    role: "assistant" as const,
    content: "Xin chào! Tôi là SÓI Agent. Bạn có thể ra lệnh bằng giọng nói hoặc gõ phím để tạo mặt hàng, lên đơn, chốt đơn hoặc xem báo cáo.",
    timestamp: new Date()
  }];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const prevMessagesRef = useRef(messages);

  useEffect(() => {
    prevMessagesRef.current = messages;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState("gpt-5.2");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const chatMutation = useProcessChat();
  
  const handleSpeechResult = (text: string) => {
    setInput("");
    handleSend(text);
  };

  const { isListening, interimText, toggle, speak, supported } = useSpeech(handleSpeechResult);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSend = (textToSend = input) => {
    if (!textToSend.trim() || chatMutation.isPending) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    chatMutation.mutate({ message: textToSend, model: currentModel, history: messages.map(m => ({ role: m.role, content: m.content })) }, {
      onSuccess: (data) => {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMsg]);
        
        if (autoSpeak) {
          speak(data.reply);
        }
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-sans font-bold text-foreground"></h2>
          <p className="text-muted-foreground mt-1 text-sm"></p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setModelOpen(!modelOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-colors"
            >
              {currentModel}
              <ChevronDown className="w-3 h-3" />
            </button>
            {modelOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                  {["gpt-5.2", "gpt-5.1", "gpt-4o", "gpt-4o-mini", "o3", "gemma-2-2b-it"].map((m) => (
                    <button
                      key={m}
                      onClick={() => { setCurrentModel(m); setModelOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors",
                        currentModel === m ? "text-primary font-semibold" : "text-foreground hover:bg-secondary"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={cn(
              "p-3 rounded-full transition-all duration-300",
              autoSpeak ? "bg-accent/10 text-accent hover:bg-accent/20" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
            title={autoSpeak ? "Tắt tự động đọc" : "Bật tự động đọc"}
          >
            {autoSpeak ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto pr-2 pb-2 space-y-2 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              )}>
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-primary" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl shadow-sm leading-relaxed",
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-card border border-border text-foreground rounded-tl-sm"
              )}>
                <p>{msg.content}</p>
                <span className={cn(
                  "text-[10px] font-medium mt-2 block opacity-50",
                  msg.role === "user" ? "text-right" : "text-left"
                )}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          {chatMutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4 max-w-[85%] mr-auto"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {supported && (
        <div className="flex flex-col items-center gap-3 shrink-0 mt-auto">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggle}
              className={cn(
                "flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 text-white shadow-lg",
                isListening 
                  ? "bg-accent animate-pulse-ring" 
                  : "bg-primary hover:bg-primary/90 hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
              )}
            >
              <Mic className={cn("w-7 h-7", isListening && "scale-110")} />
            </button>
            <span className="text-xs text-muted-foreground italic">
              {isListening ? "Đang nghe... (bấm để gửi)" : "Bấm để nói"}
            </span>
          </div>
        </div>
      )}

      {/* Input Area - Bottom */}
      <div className="bg-card border border-border rounded-3xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-300 flex items-end gap-2 shrink-0 mt-auto mb-[15px]">
        <textarea
          value={isListening && interimText ? interimText : input}
          onChange={(e) => !isListening && setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (isListening) toggle();
              else handleSend();
            }
          }}
          placeholder={isListening ? "Đang nhận giọng nói..." : "Hãy ra lệnh..."}
          readOnly={isListening}
          className={cn(
            "w-full max-h-32 min-h-[48px] bg-transparent resize-none outline-none py-3 px-4 placeholder:text-muted-foreground",
            isListening ? "text-accent italic" : "text-foreground"
          )}
          rows={1}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || chatMutation.isPending}
          className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mb-0.5 mr-0.5"
        >
          <Send className="w-5 h-5 ml-1" />
        </button>
      </div>

      
    </div>
  );
}
