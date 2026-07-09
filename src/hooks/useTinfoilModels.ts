import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyTinfoilModels,
  getTinfoilModels,
  type CloudModelDefinition,
} from "../models/ModelRegistry";
import { fetchTinfoilModels, writeCachedTinfoilModels } from "../models/tinfoilModels";
import logger from "../utils/logger";

interface UseTinfoilModelsResult {
  models: CloudModelDefinition[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads Tinfoil's model list from its /v1/models endpoint, falling back to the
 * last good fetch so the picker stays usable offline.
 */
export function useTinfoilModels(): UseTinfoilModelsResult {
  const [models, setModels] = useState<CloudModelDefinition[]>(() => getTinfoilModels());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const fresh = await fetchTinfoilModels();
      applyTinfoilModels(fresh);
      writeCachedTinfoilModels(fresh);
      if (isMountedRef.current) {
        setModels(fresh);
      }
    } catch (err) {
      logger.error("Failed to load Tinfoil models", { error: err }, "models");
      if (isMountedRef.current) {
        setError((err as Error).message || "Unable to load models");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}
