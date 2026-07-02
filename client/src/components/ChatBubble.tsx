import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, User, Volume2, VolumeX, X, MessageCircle, Bot, Settings } from "lucide-react";
import { useProcessChat, getDefaultModel } from "@/hooks/use-chat";
import { useSpeech } from "@/hooks/use-speech";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const BUBBLE_STORAGE_KEY = "soi_bubble_messages";

function loadMessages(): Message[] {
  try {
    const saved = sessionStorage.getItem(BUBBLE_STORAGE_KEY);
    if (saved) return JSON.parse(saved, (k, v) => k === "timestamp" ? new Date(v) : v);
  } catch {}
  return [{
    id: "intro",
    role: "assistant" as const,
    content: "Xin chào! Tôi là SÓI Agent. Bạn cần hỗ trợ gì về đơn hàng không?",
    timestamp: new Date()
  }];
}

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [currentModel, setCurrentModel] = useState(getDefaultModel);
  useEffect(() => {
    const handler = () => setCurrentModel(getDefaultModel());
    window.addEventListener("soi_settings_change", handler);
    return () => window.removeEventListener("soi_settings_change", handler);
  }, []);
  const [, navigate] = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionStorage.setItem(BUBBLE_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = useProcessChat();

  const handleSpeechResult = (text: string) => {
    setInput("");
    handleSend(text);
  };

  const { isListening, interimText, toggle, speak, supported } = useSpeech(handleSpeechResult);

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

    chatMutation.mutate(
      { message: textToSend, model: currentModel, history: messages.map(m => ({ role: m.role, content: m.content })) },
      {
        onSuccess: (data) => {
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.reply,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMsg]);
          if (autoSpeak) speak(data.reply);
        }
      }
    );
  };

  const unreadCount = 0;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-colors duration-300",
          open ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <MessageCircle className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-1.5rem)] h-[520px] bg-background border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm">
                  <img src="/icon-512.png" alt="SÓI Agent" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground leading-none">SÓI Agent</p>
                    <button
                      onClick={() => setAutoSpeak(v => !v)}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        autoSpeak ? "text-accent hover:bg-accent/10" : "text-muted-foreground hover:bg-secondary"
                      )}
                      title={autoSpeak ? "Tắt đọc tự động" : "Bật đọc tự động"}
                    >
                      {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => navigate("/settings")}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Cài đặt"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-accent font-medium mt-0.5">● Trực tuyến</p>
                  <p className="text-[8px] text-muted-foreground mt-0.5">{currentModel}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      "flex gap-2 max-w-[88%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center overflow-hidden",
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                    )}>
                      {msg.role === "user"
                        ? <User className="w-3.5 h-3.5" />
                        : <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />}
                    </div>
                    <div className={cn(
                      "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border text-foreground rounded-tl-sm"
                    )}>
                      <p>{msg.content}</p>
                      <span className={cn(
                        "text-[10px] mt-1 block opacity-40",
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
                    className="flex gap-2 max-w-[88%] mr-auto"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-xl bg-card border border-border overflow-hidden animate-pulse">
                      <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-3 py-2 rounded-2xl bg-card border border-border flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 shrink-0">
              <div className="bg-card border border-border rounded-2xl flex items-end gap-2 p-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <textarea
                  ref={inputRef}
                  value={isListening && interimText ? interimText : input}
                  onChange={(e) => !isListening && setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (isListening) toggle();
                      else handleSend();
                    }
                  }}
                  placeholder={isListening ? "Đang nhận giọng nói..." : "Hãy ra lệnh..."}
                  readOnly={isListening}
                  rows={1}
                  className={cn(
                    "flex-1 bg-transparent resize-none outline-none py-2 px-2 text-sm min-h-[36px] max-h-24 placeholder:text-muted-foreground",
                    isListening ? "text-sky-500 italic" : "text-foreground"
                  )}
                />
                {supported && (
                  <button
                    onClick={toggle}
                    title={isListening ? "Dừng nghe" : "Bấm để nói"}
                    className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all duration-200 mb-0.5",
                      isListening
                        ? "bg-sky-400 animate-pulse-ring"
                        : "bg-sky-500 hover:bg-sky-400 active:scale-95"
                    )}
                  >
                    <Mic className={cn("w-4 h-4", isListening && "scale-110")} />
                  </button>
                )}
                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && !interimText) || chatMutation.isPending}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all mb-0.5"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
