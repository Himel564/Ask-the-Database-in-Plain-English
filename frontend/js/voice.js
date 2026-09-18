import { transcribeAudio } from "./api.js"; // NEW: multilingual voice
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

// ---------------------------------------------------------------------------
// NEW: Multilingual voice input (English, Bengali, Hindi)
// Records the voice and sends it to the backend (Groq Whisper),
// which detects the language by itself and returns the text.
// It works the same way as createVoiceInput, so the rest of the app does not change.
// ---------------------------------------------------------------------------
export function createWhisperVoiceInput({ onText, onListeningChange, onError }) {
  let recorder = null;
  let audioChunks = [];
  let startText = "";
  let autoStopTimer = null;

  async function start(currentText = "") {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      onError("Voice input isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    onError("");
    startText = currentText ? currentText.trim() + " " : "";

    // Ask for microphone permission
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Microphone access is blocked. Allow it in your browser's site settings.");
      return;
    }

    audioChunks = [];
    recorder = new MediaRecorder(stream);

    // Save the recorded sound piece by piece
    recorder.ondataavailable = (event) => audioChunks.push(event.data);

    // When recording stops: send the audio to the backend and get the text
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop()); // switch off the mic
      clearTimeout(autoStopTimer);

      const audioBlob = new Blob(audioChunks, { type: recorder.mimeType });
      const audioFile = new File([audioBlob], "voice.webm", { type: recorder.mimeType });

      try {
        const data = await transcribeAudio(audioFile);
        if (data.text) onText(startText + data.text);
        else onError("No speech heard. Press the mic and try again.");
      } catch (e) {
        onError("Voice input error: " + e.message);
      }

      // Called AFTER onText, so voice-to-voice mode can submit the question
      onListeningChange(false);
    };

    recorder.start();
    onListeningChange(true);

    // Safety: stop automatically after 15 seconds
    autoStopTimer = setTimeout(stop, 15000);
  }

  function stop() {
    if (recorder && recorder.state === "recording") recorder.stop();
  }

  return { start, stop };
}
