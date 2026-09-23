import { getAnswerInUserLanguage } from "./language.js"; // multilingual answers
import { detectLanguage } from "./language.js"; //multilingual speech
import { getSpeechAudio } from "./api.js"; // clear Bengali / Hindi voice

let currentAudio = null; // NEW: the Bengali / Hindi audio that is playing now


// Find a female American voice from the browser's voice list
function getFemaleVoice() {
  const voices = window.speechSynthesis.getVoices();

  // Female American voice names in Chrome and Edge
  const femaleNames = ["Google US English", "Aria", "Jenny", "Zira", "Samantha"];

  for (let i = 0; i < femaleNames.length; i++) {
    for (let j = 0; j < voices.length; j++) {
      if (voices[j].name.includes(femaleNames[i])) {
        return voices[j];
      }
    }
  }

  // If no female voice is found, return null (browser uses its default voice)
  return null;
}
// NEW: find a voice for Bengali or Hindi (e.g. "bn-IN" or "hi-IN")
function getVoiceForLanguage(language) {
  const voices = window.speechSynthesis.getVoices();
  const shortCode = language.split("-")[0]; // "bn" or "hi"

  for (let i = 0; i < voices.length; i++) {
    if (voices[i].lang === language) return voices[i];
  }
  for (let i = 0; i < voices.length; i++) {
    if (voices[i].lang.startsWith(shortCode)) return voices[i];
  }
  return null;
}


// NEW: play a clear Bengali / Hindi voice made by the backend.
// If the backend voice fails, use the browser's voice instead.
async function playClearVoice(text, language) {
  try {
    const audioFile = await getSpeechAudio(text, language.split("-")[0]); // "bn" or "hi"
    currentAudio = new Audio(URL.createObjectURL(audioFile));
    currentAudio.playbackRate = 1.25; // NEW: speak a little faster (1 = normal, 1.5 = fast)
    currentAudio.play();
  } catch (e) {
    console.error("Clear voice failed, using browser voice:", e);
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = language;
    const languageVoice = getVoiceForLanguage(language);
    if (languageVoice) speech.voice = languageVoice;
    window.speechSynthesis.speak(speech);
  }
}

// Read the given text out loud
export function speakText(text) {
  // Some browsers do not support voice output
  if (!window.speechSynthesis) {
    alert("Voice output is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  // Stop anything that is already being spoken
  stopSpeaking(); // NEW: also stops Bengali / Hindi audio

  // Nothing to speak
  if (!text) return;

  // NEW: Bengali or Hindi -> use the clear Google voice from the backend
  const language = detectLanguage(text);
  if (language !== "en-US") {
    playClearVoice(text, language);
    return;
  }

  // English: same female American voice as before
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-US";
  speech.rate = 1; // normal speed
  const femaleVoice = getFemaleVoice();
  if (femaleVoice) speech.voice = femaleVoice;

  window.speechSynthesis.speak(speech);
}

// Stop speaking
export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  // NEW: also stop Bengali / Hindi audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

// Check if the browser is speaking right now
export function isSpeaking() {
  const audioPlaying = currentAudio && !currentAudio.paused; // NEW: Bengali / Hindi audio
  return (window.speechSynthesis && window.speechSynthesis.speaking) || audioPlaying;
}


export function makeResultSpeech(result) {
  if (!result || !result.rows || result.rows.length === 0) {
    return "I did not find any rows.";
  }

  // Point A: if the result is only one value (like a count), say it simply
  if (result.rows.length === 1 && result.columns.length === 1) {
    return "The answer is " + result.rows[0][result.columns[0]] + ".";
  }

  const count = result.rows.length;
  const firstRow = result.rows[0];

  // Only read the first 5 columns so it does not become too long
  const columns = result.columns.slice(0, 5);

  let firstRowText = "";
  for (let i = 0; i < columns.length; i++) {
    firstRowText = firstRowText + columns[i] + " " + firstRow[columns[i]] + ", ";
  }

  const rowWord = count === 1 ? "row" : "rows";
  return "I found " + count + " " + rowWord + ". The first result is: " + firstRowText;
}

// The browser loads voices a little late, so we ask for them once at the start
if (window.speechSynthesis) window.speechSynthesis.getVoices();
