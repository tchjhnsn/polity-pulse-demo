import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface AddressInputProps {
  onSubmit: (address: string) => void;
  loading: boolean;
}

/** Demo seed addresses — clickable chips under the input so judges can
 * fire the orientation in one click without typing. Each is a real Austin
 * address that should resolve to a distinct set of districts. */
const SEED_ADDRESSES: { label: string; address: string }[] = [
  {
    label: "Texas Capitol",
    address: "1100 Congress Ave, Austin, TX 78701",
  },
  {
    label: "UT Austin",
    address: "110 Inner Campus Dr, Austin, TX 78705",
  },
  {
    label: "South Congress",
    address: "1601 S Congress Ave, Austin, TX 78704",
  },
  {
    label: "Domain",
    address: "11800 Domain Blvd, Austin, TX 78758",
  },
];

export function AddressInput({ onSubmit, loading }: AddressInputProps) {
  const [value, setValue] = useState("");

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length >= 4) onSubmit(trimmed);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter your Austin street address — e.g. 1100 Congress Ave, Austin, TX 78701"
          disabled={loading}
          aria-label="Your address"
        />
        <Button type="submit" disabled={loading || value.trim().length < 4}>
          <Search className="mr-2 h-4 w-4" />
          {loading ? "Orienting…" : "Orient"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-mono text-ink-3 self-center">try:</span>
        {SEED_ADDRESSES.map((s) => (
          <Button
            key={s.address}
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              setValue(s.address);
              onSubmit(s.address);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}