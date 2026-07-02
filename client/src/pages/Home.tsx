import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Bot, User } from "lucide-react";
import { useProcessChat, getDefaultModel } from "@/hooks/use-chat";
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
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("soi_autospeak") !== "false");
  useEffect(() => {
    const handler = () => setAutoSpeak(localStorage.getItem("soi_autospeak") !== "false");
    window.addEventListener("soi_autospeak_change", handler);
    return () => window.removeEventListener("soi_autospeak_change", handler);
  }, []);
  const [currentModel, setCurrentModel] = useState(getDefaultModel);
  useEffect(() => {
    const handler = () => setCurrentModel(getDefaultModel());
    window.addEventListener("soi_settings_change", handler);
    return () => window.removeEventListener("soi_settings_change", handler);
  }, []);
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
      },
      onError: (err) => {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Lỗi: " + err.message,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
                "flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm overflow-hidden",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              )}>
                {msg.role === "user"
                  ? <User className="w-5 h-5" />
                  : <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />}
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
              <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-card border border-border overflow-hidden shadow-sm animate-pulse">
                <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />
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
            isListening ? "text-sky-500 italic" : "text-foreground"
          )}
          rows={1}
        />
        {supported && (
          <button
            onClick={toggle}
            title={isListening ? "Dừng nghe" : "Bấm để nói"}
            className={cn(
              "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all duration-200 mb-0.5 shadow-sm",
              isListening
                ? "bg-sky-400 animate-pulse-ring"
                : "bg-sky-500 hover:bg-sky-400 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            )}
          >
            <Mic className={cn("w-5 h-5", isListening && "scale-110")} />
          </button>
        )}
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
