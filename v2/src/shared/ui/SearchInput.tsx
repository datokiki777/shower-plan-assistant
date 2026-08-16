import { useEffect, useState } from "react";
import { Input } from "./fields";
import "./SearchInput.css";

export interface SearchInputProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

/** Debounces input before calling onSearch - see ARCHITECTURE.md §8: search
 * must query a Dexie index, not filter an in-memory array on every
 * keystroke like V1 did. */
export function SearchInput({ placeholder, onSearch, debounceMs = 200 }: SearchInputProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => onSearch(value), debounceMs);
    return () => window.clearTimeout(handle);
  }, [value, debounceMs, onSearch]);

  return (
    <div className="ui-search-input">
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
