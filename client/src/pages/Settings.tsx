import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Key, Brain, Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_MODELS = [
  { id: "gpt-5.2", name: "GPT-5.2", provider: "OpenAI" },
  { id: "gpt-5.1", name: "GPT-5.1", provider: "OpenAI" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o-mini", provider: "OpenAI" },
  { id: "o3", name: "O3", provider: "OpenAI" },
  { id: "gemma-2-2b-it", name: "Gemma 2 2B IT", provider: "NVIDIA" },
  { id: "deepseek-chat", name: "DeepSeek Chat", provider: "DeepSeek" },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", provider: "DeepSeek" },
];

const STORAGE_KEY = "soi_settings";

interface Settings {
  deepseekApiKey: string;
  defaultModel: string;
}

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { deepseekApiKey: "", defaultModel: "gpt-5.2" };
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Cài đặt - SÓI Agent";
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("soi_settings_change"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý API keys và mô hình AI</p>
        </div>

        {/* API Keys */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">API Keys</h2>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">DeepSeek API Key</label>
            <p className="text-xs text-muted-foreground mb-2">
              Nhập API key từ DeepSeek để sử dụng các mô hình DeepSeek Chat và DeepSeek Reasoner.
              Lấy key tại{" "}
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.deepseek.com
              </a>
            </p>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={settings.deepseekApiKey}
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, deepseekApiKey: e.target.value }));
                  setTestResult(null);
                }}
                placeholder="sk-..."
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Mô hình mặc định</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Chọn mô hình AI sẽ sử dụng khi trò chuyện. Các mô hình DeepSeek yêu cầu nhập API key ở trên.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_MODELS.map((model) => {
              const isDeepSeek = model.provider === "DeepSeek";
              const disabled = isDeepSeek && !settings.deepseekApiKey;
              return (
                <button
                  key={model.id}
                  disabled={disabled}
                  onClick={() => setSettings(prev => ({ ...prev, defaultModel: model.id }))}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200",
                    settings.defaultModel === model.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-muted-foreground/30",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    settings.defaultModel === model.id
                      ? "border-primary"
                      : "border-muted-foreground"
                  )}>
                    {settings.defaultModel === model.id && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground">{model.provider}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all active:scale-95"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Đã lưu
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu cài đặt
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}