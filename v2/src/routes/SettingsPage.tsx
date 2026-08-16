import { PageHeader } from "@/shared/ui/PageHeader";
import { LegacyImportPanel } from "@/features/legacy-import/LegacyImportPanel";
import { BackupPanel } from "@/features/backup/BackupPanel";
import "./SettingsPage.css";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Plans" title="პარამეტრები" />
      <section className="settings-page__section">
        <h2 className="settings-page__section-title">მონაცემები</h2>
        <div className="settings-page__stack">
          <LegacyImportPanel />
          <BackupPanel />
        </div>
      </section>
    </div>
  );
}
