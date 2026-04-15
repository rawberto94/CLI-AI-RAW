ALTER TABLE "contract_drafts"
ADD COLUMN "playbook_id" TEXT;

ALTER TABLE "contract_drafts"
ADD CONSTRAINT "contract_drafts_playbook_id_fkey"
FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "contract_drafts_playbook_id_idx" ON "contract_drafts"("playbook_id");