import { useCallback, useEffect, useState } from "react";
import { templateRepository } from "@/db/repositories";
import type { FieldTemplate, TemplateFieldKey } from "@/entities/template";

export function useFieldTemplates(fieldKey: TemplateFieldKey) {
  const [templates, setTemplates] = useState<FieldTemplate[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    templateRepository.listByField(fieldKey).then((result) => {
      if (!cancelled) setTemplates(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fieldKey, reloadToken]);

  return { templates, reload };
}

/** Loads all nine fields' templates in one go - used by the Templates
 * management page and by the Job form (to avoid nine separate round trips
 * while the form is open). */
export function useAllFieldTemplates(fieldKeys: readonly TemplateFieldKey[]) {
  const [byField, setByField] = useState<Partial<Record<TemplateFieldKey, FieldTemplate[]>>>({});
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(fieldKeys.map((key) => templateRepository.listByField(key))).then((lists) => {
      if (cancelled) return;
      const next: Partial<Record<TemplateFieldKey, FieldTemplate[]>> = {};
      fieldKeys.forEach((key, i) => {
        next[key] = lists[i];
      });
      setByField(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return { byField, reload };
}
