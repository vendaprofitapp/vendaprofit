ALTER TABLE crm_customer_contacts
ADD COLUMN contacted_at timestamptz NOT NULL DEFAULT now();

UPDATE crm_customer_contacts SET contacted_at = created_at;