import { applyTinfoilModels, type CloudModelDefinition } from "./ModelRegistry";
import { writeCachedTinfoilModels } from "./tinfoilModelCache";

/** A chat model as reported by Tinfoil's /v1/models, narrowed by the main process. */
export interface TinfoilCatalogModel {
  id: string;
  name: string;
  description: string;
  supportsThinking: boolean;
}

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

/**
 * Turns Tinfoil's live list into registry entries. The endpoint is the source
 * of truth for which models exist and what they do, so models it doesn't list
 * drop out and models we've never heard of appear. Only the description is
 * ours: every Tinfoil model takes max_tokens and supports temperature.
 */
export function mergeTinfoilModels(catalog: TinfoilCatalogModel[]): CloudModelDefinition[] {
  return catalog.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.description,
    descriptionKey: DESCRIPTION_KEYS[model.id],
    supportsThinking: model.supportsThinking,
    tokenParam: "max_tokens",
    supportsTemperature: true,
  }));
}

let inFlight: Promise<CloudModelDefinition[]> | null = null;

async function fetchAndApply(): Promise<CloudModelDefinition[]> {
  const fetchModels = window.electronAPI?.getTinfoilChatModels;
  if (!fetchModels) {
    throw new Error("Tinfoil model list is unavailable");
  }

  const models = mergeTinfoilModels(await fetchModels());
  // An empty list would mean Tinfoil serves no chat models at all. Far more
  // likely something upstream broke, so keep what we already have.
  if (models.length === 0) {
    throw new Error("Tinfoil returned no chat models");
  }

  applyTinfoilModels(models);
  writeCachedTinfoilModels(models);
  return models;
}

/**
 * Pulls Tinfoil's model list into the registry and the cache. The main process
 * refetches at most once an hour, so this is cheap to call before every
 * request. Rejects when Tinfoil can't be reached, leaving the registry as it
 * was — an unreachable endpoint says nothing about which models still exist.
 */
export function refreshTinfoilModels(): Promise<CloudModelDefinition[]> {
  if (!inFlight) {
    inFlight = fetchAndApply().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
