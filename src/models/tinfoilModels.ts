import type { CloudModelDefinition } from "./ModelRegistry";

export const TINFOIL_MODELS_URL = "https://inference.tinfoil.sh/v1/models";

const CACHE_KEY = "tinfoilModels";

/**
 * Curated, translated descriptions keyed by model id. The endpoint only returns
 * English copy, so prefer these where we have them and fall back to the
 * endpoint's own description for models we haven't written one for.
 */
const DESCRIPTION_KEYS: Record<string, string> = {
  "deepseek-v4-pro": "models.descriptions.cloud.tinfoil_deepseek_v4_pro",
  "glm-5-2": "models.descriptions.cloud.tinfoil_glm_5_2",
  "kimi-k2-6": "models.descriptions.cloud.tinfoil_kimi_k2_6",
  "gemma4-31b": "models.descriptions.cloud.tinfoil_gemma4_31b",
  "gpt-oss-120b": "models.descriptions.cloud.tinfoil_gpt_oss_120b",
  "llama3-3-70b": "models.descriptions.cloud.tinfoil_llama3_3_70b",
};

interface TinfoilApiModel {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
  reasoning?: unknown;
  endpoints?: unknown;
}

/**
 * Tinfoil serves chat, audio, embedding, tts and tool models from one list, so
 * the reasoning picker has to narrow it to models it can actually send a chat
 * completion to.
 */
function isChatModel(model: TinfoilApiModel): boolean {
  if (model.type !== "chat") return false;
  return Array.isArray(model.endpoints) && model.endpoints.includes("/v1/chat/completions");
}

function toCloudModel(model: TinfoilApiModel): CloudModelDefinition | null {
  const id = typeof model.id === "string" ? model.id : "";
  if (!id) return null;

  return {
    id,
    name: typeof model.name === "string" && model.name ? model.name : id,
    description: typeof model.description === "string" ? model.description : "",
    descriptionKey: DESCRIPTION_KEYS[id],
    supportsThinking: model.reasoning === true,
    tokenParam: "max_tokens",
    supportsTemperature: true,
  };
}

export function parseTinfoilModels(payload: unknown): CloudModelDefinition[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];

  return (data as TinfoilApiModel[])
    .filter(isChatModel)
    .map(toCloudModel)
    .filter((model): model is CloudModelDefinition => model !== null);
}

export async function fetchTinfoilModels(signal?: AbortSignal): Promise<CloudModelDefinition[]> {
  const response = await fetch(TINFOIL_MODELS_URL, { method: "GET", signal });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return parseTinfoilModels(await response.json());
}

export function readCachedTinfoilModels(): CloudModelDefinition[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedTinfoilModels(models: CloudModelDefinition[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(models));
  } catch {
    // Cache is best-effort; a failed write just means a refetch next launch.
  }
}
