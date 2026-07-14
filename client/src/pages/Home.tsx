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
    content: "Chào bạn! Tôi là SÓI - Trợ lý quản lý công việc. Bạn có thể:\n• Tạo việc: \"Thêm việc họp team 3h chiều mai\"\n• Kiểm tra: \"Hôm nay có việc gì?\"\n• Hoàn thành: \"Xong việc họp team\"\n• Báo cáo: \"Báo cáo công việc hôm nay\"",
    timestamp: new Date()
  }];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
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
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Lỗi: " + err.message,
          timestamp: new Date()
        }]);
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-full">
      <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-2 space-y-2 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "flex gap-2 md:gap-4 max-w-[95%] md:max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-8 md:w-10 h-8 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm overflow-hidden",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              )}>
                {msg.role === "user"
                  ? <User className="w-4 md:w-5 h-4 md:h-5" />
                  : <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />}
              </div>
              <div className={cn(
                "p-3 md:p-4 rounded-2xl shadow-sm leading-relaxed text-sm md:text-base whitespace-pre-line",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border text-foreground rounded-tl-sm"
              )}>
                <p>{msg.content}</p>
                <span className={cn(
                  "text-[10px] font-medium mt-1 md:mt-2 block opacity-50",
                  msg.role === "user" ? "text-right" : "text-left"
                )}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          {chatMutation.isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex gap-2 md:gap-4 max-w-[95%] md:max-w-[85%] mr-auto">
              <div className="flex-shrink-0 w-8 md:w-10 h-8 md:h-10 rounded-xl md:rounded-2xl bg-card border border-border overflow-hidden shadow-sm animate-pulse">
                <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />
              </div>
              <div className="p-3 md:p-4 rounded-2xl bg-card border border-border rounded-tl-sm flex items-center gap-1.5 md:gap-2">
                <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      <div className="bg-card border border-border rounded-2xl md:rounded-3xl p-1.5 md:p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-300 flex items-end gap-1 md:gap-2 shrink-0 mt-auto mb-2 md:mb-[15px]">
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
          placeholder={isListening ? "Đang nhận giọng nói..." : "Nhập công việc của bạn..."}
          readOnly={isListening}
          className={cn(
            "w-full max-h-32 min-h-[40px] md:min-h-[48px] bg-transparent resize-none outline-none py-2 md:py-3 px-3 md:px-4 text-sm md:text-base placeholder:text-muted-foreground",
            isListening ? "text-sky-500 italic" : "text-foreground"
          )}
          rows={1}
        />
        {supported && (
          <button onClick={toggle}
            title={isListening ? "Dừng nghe" : "Bấm để nói"}
            className={cn(
              "flex-shrink-0 w-10 md:w-12 h-10 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white transition-all duration-200 mb-0.5 shadow-sm",
              isListening ? "bg-sky-400 animate-pulse-ring" : "bg-sky-500 hover:bg-sky-400 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            )}>
            <Mic className={cn("w-4 md:w-5 h-4 md:h-5", isListening && "scale-110")} />
          </button>
        )}
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || chatMutation.isPending}
          className="flex-shrink-0 w-10 md:w-12 h-10 md:h-12 rounded-xl md:rounded-2xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mb-0.5">
          <Send className="w-4 md:w-5 h-4 md:h-5 ml-0.5 md:ml-1" />
        </button>
      </div>
    </div>
  );
}
