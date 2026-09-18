// language.js
// ---------------------------------------------------------------------------
// NEW FILE: multilingual helpers (English, Bengali, Hindi).
//
//   detectLanguage()          -> finds the language of a text from its letters.
//   getAnswerInUserLanguage() -> asks the backend for the final answer
//                                in the same language as the question.
// ---------------------------------------------------------------------------
import { replyInUserLanguage } from "./api.js";

// Find the language by looking at the letters used in the text.
// Bengali and Hindi use their own alphabets, so this is simple and reliable.
export function detectLanguage(text) {
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali letters
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Hindi (Devanagari) letters
  return "en-US"; // everything else is treated as English
}

// Turn a result table into short text so the AI can read it.
// We send at most 20 rows to keep it fast.
function resultToText(result) {
  if (!result || !result.rows || result.rows.length === 0) {
    return "No rows were found.";
  }

  let text = "Total rows: " + result.rows.length + "\n";
  text += "Columns: " + result.columns.join(", ") + "\n";

  const firstRows = result.rows.slice(0, 20);
  for (let i = 0; i < firstRows.length; i++) {
    text += JSON.stringify(firstRows[i]) + "\n";
  }
  return text;
}

// Get the final answer in the user's language.
//   question    -> what the user asked (typed or spoken)
//   information -> a result table ({ columns, rows }) OR an answer text
//   backupText  -> English text to use if something goes wrong,
//                  so the app still works even if this step fails
export async function getAnswerInUserLanguage(question, information, backupText) {
  const infoText = typeof information === "string" ? information : resultToText(information);

  try {
    const data = await replyInUserLanguage(question, infoText);
    return data.answer || backupText;
  } catch (e) {
    console.error("Multilingual answer failed:", e);
    return backupText;
  }
}
