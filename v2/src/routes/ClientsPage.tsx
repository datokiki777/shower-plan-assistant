import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/ui/PageHeader";
import { SearchInput } from "@/shared/ui/SearchInput";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { useClients } from "@/features/clients/useClients";
import { ClientForm } from "@/features/clients/ClientForm";
import "./ClientsPage.css";

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const { clients, loading, reload } = useClients(query, { includeArchived: showArchived });

  return (
    <div>
      <PageHeader
        eyebrow="Plans"
        title="კლიენტები"
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + კლიენტი
          </Button>
        }
      />

      <div className="clients-page__controls">
        <SearchInput placeholder="მოძებნე სახელით…" onSearch={setQuery} />
        <label className="clients-page__archived-toggle">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          დაარქივებულების ჩვენება
        </label>
      </div>

      {!loading && clients.length === 0 && (
        <EmptyState title="კლიენტი არ მოიძებნა" description="დაამატე პირველი კლიენტი ზემოთა ღილაკით." />
      )}

      <div className="clients-page__list">
        {clients.map((client) => (
          <Link key={client.id} to={`/clients/${client.id}`} className="clients-page__row">
            <Card>
              <div className="clients-page__row-head">
                <strong>{client.fullName || "უსახელო კლიენტი"}</strong>
                {client.archivedAt && <StatusBadge label="დაარქივებული" tone="danger" />}
              </div>
              {(client.address || client.phone) && (
                <p className="clients-page__row-meta">{[client.address, client.phone].filter(Boolean).join(" · ")}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
    </div>
  );
}
