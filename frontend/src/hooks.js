import { useEffect, useRef, useState } from "react";

// Voice input using the browser's Web Speech API (works in Chrome and Edge).
export function useSpeechInput(onText) {
  const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recRef = useRef(null);
  const startTextRef = useRef("");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => recRef.current?.abort(), []);

  function start(currentText = "") {
    if (!Recognition) {
      setSpeechError("Voice input isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    setSpeechError("");
    startTextRef.current = currentText ? currentText.trim() + " " : "";
    const rec = new Recognition();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      onTextRef.current(startTextRef.current + transcript);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") setSpeechError("Microphone access is blocked. Allow it in your browser's site settings.");
      else if (event.error === "no-speech") setSpeechError("No speech heard. Press the mic and try again.");
      else if (event.error !== "aborted") setSpeechError(`Voice input error: ${event.error}`);
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  return { listening, start, stop, speechError, supported: !!Recognition };
}
