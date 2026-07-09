import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyTinfoilModels,
  getTinfoilModels,
  type CloudModelDefinition,
} from "../models/ModelRegistry";
import { fetchTinfoilModels } from "../models/tinfoilModels";
import logger from "../utils/logger";

interface UseTinfoilModelsResult {
  models: CloudModelDefinition[];
  loading: boolean;
  error: string | null;
  /** True once Tinfoil has answered. Until then its list can't be trusted to be complete. */
  fetched: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads Tinfoil's model list from its /v1/models endpoint, falling back to the
 * models bundled with the app so the picker stays usable offline.
 */
export function useTinfoilModels(): UseTinfoilModelsResult {
  const [models, setModels] = useState<CloudModelDefinition[]>(() => getTinfoilModels());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
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
      // An empty list would mean Tinfoil serves no chat models at all. Far more
      // likely something upstream broke, so keep the bundled ones.
      if (fresh.length === 0) {
        throw new Error("Tinfoil returned no chat models");
      }
      applyTinfoilModels(fresh);
      if (isMountedRef.current) {
        setModels(fresh);
        setFetched(true);
      }
    } catch (err) {
      // Leave the bundled list in place: without an answer we can't tell a
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

  return { models, loading, error, fetched, refresh };
}
