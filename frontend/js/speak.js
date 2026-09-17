// NEW FILE: speak.js
// This file reads text out loud using the browser's built-in voice (speechSynthesis).
// It uses a female American voice. Works best in Chrome and Edge.

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

// Read the given text out loud
export function speakText(text) {
  // Some browsers do not support voice output
  if (!window.speechSynthesis) {
    alert("Voice output is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  // Stop anything that is already being spoken
  window.speechSynthesis.cancel();

  // Nothing to speak
  if (!text) return;

  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-US"; // American accent
  speech.rate = 1;       // normal speed

  // Use a female American voice if the browser has one
  const femaleVoice = getFemaleVoice();
  if (femaleVoice) {
    speech.voice = femaleVoice;
  }

  window.speechSynthesis.speak(speech);
}

// Stop speaking
export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// Check if the browser is speaking right now
export function isSpeaking() {
  return window.speechSynthesis && window.speechSynthesis.speaking;
}

// Make a short sentence from a table result
// Example: "I found 5 rows. The first result is: name John, salary 50000"
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