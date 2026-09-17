// Voice input using the browser's Web Speech API (works in Chrome and Edge).
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function createVoiceInput({ onText, onListeningChange, onError }) {
  let recognition = null;
  let startText = "";

  function start(currentText = "") {
    if (!Recognition) {
      onError("Voice input isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    onError("");
    startText = currentText ? currentText.trim() + " " : "";

    recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      onText(startText + transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") onError("Microphone access is blocked. Allow it in your browser's site settings.");
      else if (event.error === "no-speech") onError("No speech heard. Press the mic and try again.");
      else if (event.error !== "aborted") onError(`Voice input error: ${event.error}`);
    };
    recognition.onend = () => onListeningChange(false);

    recognition.start();
    onListeningChange(true);
  }

  function stop() {
    recognition?.stop();
    onListeningChange(false);
  }

  return { start, stop };
}
