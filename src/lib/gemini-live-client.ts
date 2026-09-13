const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const LIVE_SOCKETS = [
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained",
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
];

export type LiveTargetLang = "km" | "en";

type ServerMessage = {
  setupComplete?: Record<string, unknown>;
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
        text?: string;
      }>;
    };
  };
  error?: { message?: string };
};

export type GeminiLiveCallbacks = {
  onReady?: () => void;
  onInputText?: (text: string) => void;
  onOutputText?: (text: string) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

export type GeminiLiveSession = {
  stop: () => void;
};

export function mergeTranscript(prev: string, next: string) {
  const incoming = next.trimStart();
  if (!incoming) return prev;
  if (!prev) return incoming;
  if (incoming.startsWith(prev)) return incoming;
  if (prev.endsWith(incoming)) return prev;
  const overlap = sharedSuffixPrefix(prev, incoming);
  if (overlap >= 8) return prev + incoming.slice(overlap);
  return `${prev}${incoming}`;
}

function sharedSuffixPrefix(left: string, right: string) {
  const max = Math.min(left.length, right.length);
  for (let size = max; size > 0; size--) {
    if (left.slice(-size) === right.slice(0, size)) return size;
  }
  return 0;
}

function floatToPcm16Base64(input: Float32Array) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function downsample(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.round(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const index = i * ratio;
    const left = Math.floor(index);
    const fraction = index - left;
    const right = Math.min(left + 1, input.length - 1);
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function decodePcm16(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) float32[i] = samples[i] / 32768;
  return float32;
}

class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;

  async play(base64: string) {
    const samples = decodePcm16(base64);
    if (!samples.length) return;
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: OUTPUT_RATE });
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const buffer = this.ctx.createBuffer(1, samples.length, OUTPUT_RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const startAt = Math.max(this.ctx.currentTime, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
  }

  interrupt() {
    this.nextTime = this.ctx?.currentTime ?? 0;
  }

  async close() {
    const ctx = this.ctx;
    this.ctx = null;
    this.nextTime = 0;
    if (ctx) await ctx.close().catch(() => undefined);
  }
}

function liveSetup(model: string, targetLang: LiveTargetLang) {
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        translationConfig: {
          targetLanguageCode: targetLang,
          echoTargetLanguage: true,
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

function socketUrl(base: string, token: string) {
  return `${base}?access_token=${encodeURIComponent(token)}`;
}

async function waitForOpen(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) return;
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("websocket_open_failed"));
    };
    const cleanup = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
    };
    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
  });
}

function sendPcm(
  input: Float32Array,
  fromRate: number,
  onChunk: (base64: string) => void
) {
  const pcm = downsample(input, fromRate, INPUT_RATE);
  if (pcm.length) onChunk(floatToPcm16Base64(pcm));
}

async function startMicCapture(
  stream: MediaStream,
  onChunk: (base64: string) => void
) {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  let workletUrl = "";

  try {
    workletUrl = URL.createObjectURL(
      new Blob(
        [
          `class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel);
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);`,
        ],
        { type: "application/javascript" }
      )
    );
    await ctx.audioWorklet.addModule(workletUrl);
    const node = new AudioWorkletNode(ctx, "pcm-capture");
    node.port.onmessage = (event) => {
      sendPcm(event.data as Float32Array, ctx.sampleRate, onChunk);
    };
    source.connect(node);
    node.connect(gain);
    gain.connect(ctx.destination);
    if (ctx.state === "suspended") await ctx.resume();
    return async () => {
      node.port.onmessage = null;
      node.disconnect();
      source.disconnect();
      gain.disconnect();
      if (workletUrl) URL.revokeObjectURL(workletUrl);
      await ctx.close().catch(() => undefined);
    };
  } catch {
    if (workletUrl) URL.revokeObjectURL(workletUrl);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      sendPcm(event.inputBuffer.getChannelData(0), ctx.sampleRate, onChunk);
    };
    source.connect(processor);
    processor.connect(gain);
    gain.connect(ctx.destination);
    if (ctx.state === "suspended") await ctx.resume();
    return async () => {
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      gain.disconnect();
      await ctx.close().catch(() => undefined);
    };
  }
}

export async function startGeminiLiveSession(options: {
  token: string;
  model: string;
  targetLang: LiveTargetLang;
  stream: MediaStream;
  callbacks: GeminiLiveCallbacks;
}): Promise<GeminiLiveSession> {
  const player = new PcmPlayer();
  let stopped = false;
  let socket: WebSocket | null = null;
  let stopCapture: (() => Promise<void>) | null = null;

  const sendAudio = (base64: string) => {
    if (stopped || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: base64,
            mimeType: `audio/pcm;rate=${INPUT_RATE}`,
          },
        },
      })
    );
  };

  async function readEvent(event: MessageEvent) {
    if (typeof event.data === "string") return event.data;
    if (event.data instanceof Blob) return event.data.text();
    return new TextDecoder().decode(event.data as ArrayBuffer);
  }

  async function handlePayload(raw: string) {
    const message = JSON.parse(raw) as ServerMessage;
    if (message.error?.message) {
      options.callbacks.onError?.(message.error.message);
      return;
    }
    if (message.setupComplete) {
      options.callbacks.onReady?.();
      return;
    }
    const content = message.serverContent;
    if (!content) return;
    if (content.interrupted) player.interrupt();
    if (content.inputTranscription?.text) {
      options.callbacks.onInputText?.(content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      options.callbacks.onOutputText?.(content.outputTranscription.text);
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) await player.play(part.inlineData.data);
      if (part.text) options.callbacks.onOutputText?.(part.text);
    }
  }

  async function connect(url: string) {
    const next = new WebSocket(url);
    socket = next;
    await waitForOpen(next);
    const setupReady = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("setup_timeout")),
        12000
      );
      next.onmessage = async (event) => {
        try {
          const raw = await readEvent(event);
          const message = JSON.parse(raw) as ServerMessage;
          if (message.error?.message) {
            window.clearTimeout(timer);
            reject(new Error(message.error.message));
            return;
          }
          if (message.setupComplete) {
            window.clearTimeout(timer);
            next.onmessage = async (liveEvent) => {
              try {
                await handlePayload(await readEvent(liveEvent));
              } catch (error) {
                console.error("Gemini live message failed:", error);
              }
            };
            resolve();
            options.callbacks.onReady?.();
            return;
          }
          await handlePayload(raw);
        } catch (error) {
          window.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error("setup_failed"));
        }
      };
      next.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("live_socket_failed"));
      };
      next.onclose = (event) => {
        window.clearTimeout(timer);
        reject(new Error(event.reason || "live_socket_closed"));
      };
    });
    next.send(JSON.stringify(liveSetup(options.model, options.targetLang)));
    await setupReady;
    next.onerror = () => {
      if (!stopped) options.callbacks.onError?.("live_socket_failed");
    };
    next.onclose = () => {
      if (!stopped) options.callbacks.onClose?.();
    };
  }

  try {
    const urls = LIVE_SOCKETS.map((base) => socketUrl(base, options.token));
    let lastError: unknown;
    for (const url of urls) {
      try {
        await connect(url);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
        socket = null;
      }
    }
    if (lastError) throw lastError;
    stopCapture = await startMicCapture(options.stream, sendAudio);
  } catch (error) {
    await player.close();
    socket?.close();
    throw error;
  }

  return {
    stop: () => {
      stopped = true;
      void stopCapture?.();
      void player.close();
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
      options.callbacks.onClose?.();
    },
  };
}
