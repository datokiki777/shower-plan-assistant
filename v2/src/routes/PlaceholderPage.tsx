import { PageHeader } from "@/shared/ui/PageHeader";
import { EmptyState } from "@/shared/ui/EmptyState";

export interface PlaceholderPageProps {
  title: string;
  eyebrow?: string;
  note?: string;
}

/** Phase 2 establishes routing/layout only - real feature UIs land in later
 * phases (see the Phase 2 brief's explicit "Do NOT implement" list). This
 * placeholder is intentionally plain, not a fake finished feature. */
export function PlaceholderPage({ title, eyebrow, note }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} eyebrow={eyebrow} />
      <EmptyState
        title="ეს გვერდი მალე დაემატება"
        description={note ?? "ეს სექცია შემდეგ ეტაპზე აშენდება."}
      />
    </div>
  );
}
