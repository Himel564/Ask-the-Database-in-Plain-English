

import { replyInUserLanguage } from "./api.js";


export function detectLanguage(text) {
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali letters
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Hindi (Devanagari) letters
  return "en-US"; // everything else is treated as English
}

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

, rows }) OR an answer text

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
