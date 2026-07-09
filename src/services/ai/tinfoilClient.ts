import type { LanguageModel } from "ai";
import type { TinfoilAI } from "tinfoil";
import { refreshTinfoilModels } from "../../models/tinfoilModels";

type TinfoilModule = typeof import("tinfoil");
type TinfoilAISDKProvider = Awaited<ReturnType<TinfoilModule["createTinfoilAI"]>>;

let tinfoilModulePromise: Promise<TinfoilModule> | null = null;

const chatClientCache = new Map<string, Promise<TinfoilAI>>();
const aiSdkProviderCache = new Map<string, Promise<TinfoilAISDKProvider>>();

function loadTinfoil(): Promise<TinfoilModule> {
  if (!tinfoilModulePromise) {
    // Don't cache a failed import — the next call should retry.
    tinfoilModulePromise = import("tinfoil").catch((error) => {
      tinfoilModulePromise = null;
      throw error;
    });
  }
  return tinfoilModulePromise;
}

function normalizeApiKey(apiKey: string): string {
  const key = apiKey?.trim() || "";
  if (!key) {
    throw new Error("Tinfoil API key not configured");
  }
  return key;
}

/**
 * Tinfoil adds and retires models without an app release, so pull its list into
 * the registry before every request — later code reads token params and
 * thinking support from there. The main process caps this at one fetch an hour,
 * and a failure leaves the registry on its last known list.
 */
async function syncTinfoilCatalog(): Promise<void> {
  try {
    await refreshTinfoilModels();
  } catch {
    // Offline or endpoint down: keep the models we already know about.
  }
}

export async function getTinfoilChatClient(apiKey: string): Promise<TinfoilAI> {
  const key = normalizeApiKey(apiKey);
  await syncTinfoilCatalog();
  const cached = chatClientCache.get(key);
  if (cached) return cached;

  const clientPromise = loadTinfoil()
    .then(({ TinfoilAI }) => {
      return new TinfoilAI({
        apiKey: key,
        dangerouslyAllowBrowser: true,
      });
    })
    .catch((error) => {
      chatClientCache.delete(key);
      throw error;
    });
  chatClientCache.set(key, clientPromise);
  return clientPromise;
}

async function getTinfoilAISDKProvider(apiKey: string): Promise<TinfoilAISDKProvider> {
  const key = normalizeApiKey(apiKey);
  await syncTinfoilCatalog();
  const cached = aiSdkProviderCache.get(key);
  if (cached) return cached;

  const providerPromise = loadTinfoil()
    .then(({ createTinfoilAI }) => createTinfoilAI(key))
    .catch((error) => {
      aiSdkProviderCache.delete(key);
      throw error;
    });
  aiSdkProviderCache.set(key, providerPromise);
  return providerPromise;
}

export async function getTinfoilLanguageModel(
  apiKey: string,
  model: string
): Promise<LanguageModel> {
  const provider = await getTinfoilAISDKProvider(apiKey);
  return provider(model);
}

export function clearTinfoilClientCache(): void {
  chatClientCache.clear();
  aiSdkProviderCache.clear();
}
