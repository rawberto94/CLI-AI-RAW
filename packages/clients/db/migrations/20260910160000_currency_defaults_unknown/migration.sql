-- Stop inventing USD when currency is omitted.
-- Record-level currencies default to ISO 4217 XXX (no currency).
-- Procurement category benchmark default matches tenant settings (CHF).

DO $$
DECLARE
  stmt text;
BEGIN
  FOR stmt IN
    SELECT format(
      'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %L',
      t.table_name,
      t.column_name,
      t.new_default
    )
    FROM (
      VALUES
        ('contract_drafts', 'currency', 'XXX'),
        ('cost_savings_opportunities', 'potentialSavingsCurrency', 'XXX'),
        ('procurement_categories', 'defaultCurrency', 'CHF'),
        ('rfx_events', 'currency', 'XXX'),
        ('pre_approval_gates', 'currency', 'XXX'),
        ('signature_policies', 'currency', 'XXX'),
        ('delegation_of_authority', 'currency', 'XXX'),
        ('contract_requests', 'currency', 'XXX'),
        ('amendments', 'currency', 'XXX'),
        ('purchase_orders', 'currency', 'XXX'),
        ('invoices', 'currency', 'XXX'),
        ('spend_exceptions', 'currency', 'XXX')
    ) AS t(table_name, column_name, new_default)
    JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = t.table_name
     AND c.column_name = t.column_name
  LOOP
    EXECUTE stmt;
  END LOOP;
END $$;
