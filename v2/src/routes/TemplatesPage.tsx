import { PageHeader } from "@/shared/ui/PageHeader";
import { TEMPLATE_FIELD_KEYS } from "@/entities/template";
import { useAllFieldTemplates } from "@/features/templates/useFieldTemplates";
import { TemplateFieldCard } from "@/features/templates/TemplateFieldCard";
import "./TemplatesPage.css";

export default function TemplatesPage() {
  const { byField, reload } = useAllFieldTemplates(TEMPLATE_FIELD_KEYS);

  return (
    <div>
      <PageHeader eyebrow="Plans" title="შაბლონები" />
      <p className="templates-page__hint">
        დაამატე ან წაშალე მზა ვარიანტები - სამუშაოს ფორმაში თითოეული ველის „შაბლონები“ ღილაკით აირჩევ.
      </p>
      <div className="templates-page__grid">
        {TEMPLATE_FIELD_KEYS.map((key) => (
          <TemplateFieldCard key={key} fieldKey={key} templates={byField[key] ?? []} onChanged={reload} />
        ))}
      </div>
    </div>
  );
}
