import { useCallback, useEffect, useRef, useState } from "react";
import { getTinfoilModels, type CloudModelDefinition } from "../models/ModelRegistry";
import { refreshTinfoilModels } from "../models/tinfoilModels";
import logger from "../utils/logger";

interface UseTinfoilModelsResult {
  models: CloudModelDefinition[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Refreshes Tinfoil's model list into the registry and re-renders with it. The
 * registry keeps its last known list when the fetch fails, so the picker stays
 * usable offline.
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
      const fresh = await refreshTinfoilModels();
      if (isMountedRef.current) {
        setModels(fresh);
      }
    } catch (err) {
      // Leave the known list in place: without an answer we can't tell a
      // retired model from an unreachable endpoint.
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
