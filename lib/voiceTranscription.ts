// Transcreve mensagens de voz do Telegram via Groq (Whisper), que tem
// camada gratuita generosa. Sem GROQ_API_KEY configurada, retorna null e o
// webhook avisa o usuário que voz ainda não está disponível.
export function hasGroqConfig(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  const filePath = fileInfo?.result?.file_path;
  if (!filePath) throw new Error("Não consegui achar o arquivo de áudio no Telegram");

  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!fileRes.ok) throw new Error(`Download do áudio falhou (${fileRes.status})`);
  return Buffer.from(await fileRes.arrayBuffer());
}

export async function transcribeTelegramVoice(fileId: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");

  const audioBuffer = await downloadTelegramFile(fileId);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" }), "voice.ogg");
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "pt");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq respondeu ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const text: string = json.text ?? "";
  if (!text.trim()) throw new Error("Transcrição veio vazia");
  return text.trim();
}
