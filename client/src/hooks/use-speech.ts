import { useState, useCallback, useRef } from "react";

export function useSpeech(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const listen = useCallback(async () => {
    if (isListening || processing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setIsListening(false);
        setInterimText("");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      setIsListening(true);
      setInterimText("");
    } catch (e) {
      console.error("Could not start recording", e);
    }
  }, [isListening, processing]);

  const stop = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;

    const recorder = mediaRecorderRef.current;
    setProcessing(true);
    setIsListening(false);
    setInterimText("Đang xử lý...");

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      if (blob.size < 100) {
        setProcessing(false);
        setInterimText("");
        return;
      }

      try {
        const base64Audio = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(blob);
        });

        const response = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64Audio }),
        });

        if (!response.ok) throw new Error("STT request failed");

        const data = await response.json();
        const text = data.text?.trim();

        if (text) {
          onResultRef.current(text);
        }
      } catch (err) {
        console.error("FPT STT error:", err);
      } finally {
        setProcessing(false);
        setInterimText("");
      }
    };

    recorder.stop();
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      listen();
    }
  }, [isListening, listen, stop]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { isListening, interimText, listen, stop, toggle, speak, supported: true, processing };
}
