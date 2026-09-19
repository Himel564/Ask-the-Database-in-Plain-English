# multilingual.py
# ---------------------------------------------------------------------------
# NEW FILE: adds multilingual support (English, Bengali, Hindi) to the project.
#
# It has 2 functions:
#   1. transcribe_audio()       -> turns the user's voice into text.
#                                  Groq Whisper detects the spoken language by itself.
#   2. reply_in_user_language() -> writes the final answer in the SAME language
#                                  the user asked the question in.
#   3. text_to_speech()         -> makes a clear Bengali / Hindi voice (Google TTS).
#
# It uses the same GROQ_API_KEY that the project already uses.
# ---------------------------------------------------------------------------

import io
from groq import Groq
from gtts import gTTS
from langchain.chat_models import init_chat_model
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser


def transcribe_audio(audio_bytes, file_name):
    """Convert recorded voice into text using Groq Whisper.
    Whisper automatically detects if the user spoke English, Bengali or Hindi."""

    client = Groq()  # reads GROQ_API_KEY from the .env file automatically

    result = client.audio.transcriptions.create(
        file=(file_name, audio_bytes),
        model="whisper-large-v3",
        response_format="verbose_json",  # verbose_json also tells us the detected language
    )

    # Hindi and Urdu sound almost the same, so Whisper sometimes writes
    # Hindi speech in Urdu letters. If that happens, we ask again for Hindi.
    if result.language and result.language.lower() in ("urdu", "ur"):
        result = client.audio.transcriptions.create(
            file=(file_name, audio_bytes),
            model="whisper-large-v3",
            response_format="verbose_json",
            language="hi",
        )

    return result.text.strip()


def reply_in_user_language(question, information):
    """Write a short answer to the question, using the given information,
    in the same language as the question (English, Bengali or Hindi)."""

    # A fast model, so the answer appears quickly (this step only writes 1-3 sentences)
    model = init_chat_model("groq:llama-3.3-70b-versatile")

    template = PromptTemplate(
        input_variables=["question", "information"],
        template="""
    You are a friendly assistant.
    The information below is the FINAL, CORRECT result for the user's question.
    It was already calculated from the database, so trust it completely.
    Your only job is to explain this result to the user in simple words.

    Information (the result):
    {information}

    Rules:
    1. Reply in the SAME language as the question.
       - English question -> reply in English.
       - Bengali question -> reply in Bengali (Bengali script).
       - Hindi question -> reply in Hindi (Devanagari script).
       - If Hindi or Bengali is typed in English letters, reply in that same style.
    2. Never say that the information is missing or not enough. The result already answers the question.
       Example: question "second highest salary", result shows Rahul Verma with 280000
       -> "The second highest salary is 280000, earned by Rahul Verma."
    3. Keep the answer short (1 to 3 sentences), because it may be read aloud.
       If the result has MORE than 3 rows, do NOT read every row.
       Say how many rows there are and give a short overview
       (for example the main groups, or the highest and lowest value).
       The user can see all rows in the table.
    4. Use plain text only. No markdown, no tables, no bullet points.
    5. Do not mention SQL, queries, databases or "the information given".
    6. Keep names and numbers exactly as they are in the result.
    7. ONLY if the result says "No rows were found", say that nothing was found, in the user's language.

    Question:
    {question}

    Answer:
    """
    )

    chain = template | model | StrOutputParser()
    return chain.invoke({"question": question, "information": information}).strip()


def text_to_speech(text, language):
    """Make a clear, natural voice for Bengali ("bn") or Hindi ("hi").
    Returns the voice as MP3 audio bytes."""

    tts = gTTS(text=text, lang=language)
    audio = io.BytesIO()     # a file kept in memory
    tts.write_to_fp(audio)   # save the voice into it
    return audio.getvalue()# multilingual.py
# ---------------------------------------------------------------------------
# NEW FILE: adds multilingual support (English, Bengali, Hindi) to the project.
#
# It has 2 functions:
#   1. transcribe_audio()       -> turns the user's voice into text.
#                                  Groq Whisper detects the spoken language by itself.
#   2. reply_in_user_language() -> writes the final answer in the SAME language
#                                  the user asked the question in.
#   3. text_to_speech()         -> makes a clear Bengali / Hindi voice (Google TTS).
#
# It uses the same GROQ_API_KEY that the project already uses.
# ---------------------------------------------------------------------------

import io
from groq import Groq
from gtts import gTTS
from langchain.chat_models import init_chat_model
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser


def transcribe_audio(audio_bytes, file_name):
    """Convert recorded voice into text using Groq Whisper.
    Whisper automatically detects if the user spoke English, Bengali or Hindi."""

    client = Groq()  

    result = client.audio.transcriptions.create(
        file=(file_name, audio_bytes),
        model="whisper-large-v3",
        response_format="verbose_json",  
    )

    if result.language and result.language.lower() in ("urdu", "ur"):
        result = client.audio.transcriptions.create(
            file=(file_name, audio_bytes),
            model="whisper-large-v3",
            response_format="verbose_json",
            language="hi",
        )

    return result.text.strip()


def reply_in_user_language(question, information):
    """Write a short answer to the question, using the given information,
    in the same language as the question (English, Bengali or Hindi)."""

    model = init_chat_model("groq:openai/gpt-oss-120b", reasoning_effort="low")

    template = PromptTemplate(
        input_variables=["question", "information"],
        template="""
    You are a friendly assistant.
    The information below is the FINAL, CORRECT result for the user's question.
    It was already calculated from the database, so trust it completely.
    Your only job is to explain this result to the user in simple words.

    Information (the result):
    {information}

    Rules:
    1. Reply in the SAME language as the question.
       - English question -> reply in English.
       - Bengali question -> reply in Bengali (Bengali script).
       - Hindi question -> reply in Hindi (Devanagari script).
       - If Hindi or Bengali is typed in English letters, reply in that same style.
    2. Never say that the information is missing or not enough. The result already answers the question.
       Example: question "second highest salary", result shows Rahul Verma with 280000
       -> "The second highest salary is two lakh eighty thousand, earned by Rahul Verma."
    3. Keep the answer short (1 to 3 sentences), because it may be read aloud.
       If the result has MORE than 3 rows, do NOT read every row.
       Say how many rows there are and give a short overview
       (for example the main groups, or the highest and lowest value).
       The user can see all rows in the table.
    4. Use plain text only. No markdown, no tables, no bullet points.
    5. Do not mention SQL, queries, databases or "the information given".
    6. Keep names exactly as they are in the result.
    7. The answer will be READ ALOUD, so write every number in WORDS, the way people speak in that language.
       - English: 1000 -> one thousand, 280000 -> two lakh eighty thousand
       - Bengali: 1000 -> এক হাজার, 280000 -> দুই লাখ আশি হাজার
       - Hindi: 1000 -> एक हज़ार, 280000 -> दो लाख अस्सी हज़ार
       - Dates also in words, e.g. 2014-11-20 -> 20 November 2014 written in words.
    8. Never use column names like dept_id, manager_id or hire_date.
       Say them naturally, e.g. "department 3", "joined on ...". Skip empty (null) values.
    9. ONLY if the result says "No rows were found", say that nothing was found, in the user's language.

    Question:
    {question}

    Answer:
    """
    )

    chain = template | model | StrOutputParser()
    return chain.invoke({"question": question, "information": information}).strip()


def text_to_speech(text, language):
    """Make a clear, natural voice for Bengali ("bn") or Hindi ("hi").
    Returns the voice as MP3 audio bytes."""

    tts = gTTS(text=text, lang=language)
    audio = io.BytesIO()     
    tts.write_to_fp(audio)   
    return audio.getvalue()