import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { ParsedMission } from "@/lib/missions";
import { useLanguage } from "@/contexts/LanguageContext";

interface MissionPickerProps {
  missions: ParsedMission[];
  selectedIds: Set<number>;
  onChange: (ids: number[]) => void;
  placeholder?: string;
  /** Optional cap so the dropdown doesn't render thousands of rows. */
  maxResults?: number;
}

export function MissionPicker({
  missions,
  selectedIds,
  onChange,
  placeholder = "Search missions by name…",
  maxResults = 20,
}: MissionPickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const localizedTitle = (m: ParsedMission) => {
    const localized = t(m.title);
    return localized && localized !== m.title ? localized : m.title;
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return missions
      .filter((m) => {
        if (selectedIds.has(m.id)) return false;
        const title = localizedTitle(m).toLowerCase();
        return (
          title.includes(q) ||
          (m.giver ?? "").toLowerCase().includes(q) ||
          String(m.id) === q
        );
      })
      .slice(0, maxResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, missions, selectedIds, maxResults]);

  const selected = useMemo(
    () => missions.filter((m) => selectedIds.has(m.id)),
    [missions, selectedIds]
  );

  const add = (id: number) => {
    onChange([...selectedIds, id]);
    setQuery("");
    setOpen(false);
  };
  const remove = (id: number) => {
    const next = [...selectedIds].filter((x) => x !== id);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
        />
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m.id);
                }}
              >
                <span className="truncate">
                  <span className="font-medium">{localizedTitle(m)}</span>
                  {m.giver && (
                    <span className="ml-2 text-muted-foreground">{m.giver}</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  Lv {m.displayLevel} · #{m.id}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px]"
              title={`#${m.id} · Lv ${m.displayLevel}`}
            >
              <span className="max-w-[180px] truncate">{localizedTitle(m)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 -mr-1 hover:bg-transparent"
                onClick={() => remove(m.id)}
                aria-label={`Remove ${localizedTitle(m)}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No missions selected yet.</p>
      )}
    </div>
  );
}
