import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Bot, User, Volume2, VolumeX, X, MessageCircle, ChevronDown } from "lucide-react";
import { useProcessChat } from "@/hooks/use-chat";
import { useSpeech } from "@/hooks/use-speech";
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
  const [modelOpen, setModelOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState("gpt-5.2");
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
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">SÓI Agent</p>
                  <p className="text-[10px] text-accent font-medium mt-0.5">● Trực tuyến</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setModelOpen(!modelOpen)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition-colors"
                  >
                    {currentModel}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {modelOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                        {["gpt-5.2", "gpt-5.1", "gpt-4o", "gpt-4o-mini", "o3"].map((m) => (
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
                {/* Auto-speak toggle */}
                <button
                  onClick={() => setAutoSpeak(v => !v)}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    autoSpeak ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary"
                  )}
                  title={autoSpeak ? "Tắt đọc tự động" : "Bật đọc tự động"}
                >
                  {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
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
                      "flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center",
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                    )}>
                      {msg.role === "user"
                        ? <User className="w-3.5 h-3.5" />
                        : <Bot className="w-3.5 h-3.5 text-primary" />}
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
                    <div className="flex-shrink-0 w-7 h-7 rounded-xl bg-card border border-border flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
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

            {/* Voice button */}
            {supported && (
              <div className="flex justify-center py-1 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={toggle}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 text-white shadow-md",
                      isListening
                        ? "bg-accent animate-pulse-ring"
                        : "bg-primary hover:bg-primary/90 active:scale-95"
                    )}
                  >
                    <Mic className={cn("w-4 h-4", isListening && "scale-110")} />
                  </button>
                  <span className="text-[10px] text-muted-foreground italic">
                    {isListening ? "Đang nghe..." : "Bấm để nói"}
                  </span>
                </div>
              </div>
            )}

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
                    isListening ? "text-accent italic" : "text-foreground"
                  )}
                />
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
