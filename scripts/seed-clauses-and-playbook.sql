-- Seed a comprehensive clause library + default company policy pack for tenant `acme`.
-- Idempotent: safe to run multiple times (uses ON CONFLICT on (tenant_id, name, version)).

DO $$
DECLARE
  v_tenant text := 'acme';
  v_user   text;
  v_pb_id  text := 'pb_acme_default';
BEGIN
  -- Pick any existing user in the tenant to own the records
  SELECT id INTO v_user FROM "User" WHERE "tenantId" = v_tenant ORDER BY "createdAt" ASC LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'No users found for tenant %, skipping seed.', v_tenant;
    RETURN;
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- Clause library
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO clause_library (
    id, tenant_id, name, title, category, content, plain_text,
    risk_level, is_standard, is_mandatory, is_negotiable, tags,
    contract_types, jurisdiction, created_by, created_at, updated_at
  ) VALUES
  ('cl_acme_confidentiality', v_tenant, 'Confidentiality — Mutual', 'Confidentiality',
   'CONFIDENTIALITY',
   'Each Party (the "Receiving Party") shall keep strictly confidential all Confidential Information of the other Party (the "Disclosing Party"). The Receiving Party shall (a) use the Confidential Information solely to perform its obligations under this Agreement; (b) restrict access to personnel who have a legitimate need to know and who are bound by confidentiality obligations no less protective than those set out herein; and (c) protect the Confidential Information using at least the same degree of care it uses to protect its own confidential information of similar nature, and in any event no less than a reasonable degree of care. The obligations in this clause shall survive termination of this Agreement for a period of five (5) years, and indefinitely with respect to trade secrets.',
   NULL, 'HIGH', true, true, true,
   '["confidentiality","nda","mutual"]'::jsonb,
   '["NDA","MSA","SOW","SLA","EMPLOYMENT"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_ip_ownership', v_tenant, 'IP Ownership — Client Owns Deliverables', 'Intellectual Property',
   'INTELLECTUAL_PROPERTY',
   'All right, title and interest in and to any deliverables, work product, inventions, discoveries, improvements, reports, software and materials developed by the Supplier under this Agreement (the "Deliverables") shall vest exclusively in the Client upon creation. The Supplier hereby irrevocably assigns to the Client all intellectual property rights in the Deliverables on a worldwide, royalty-free basis. The Supplier retains ownership of any pre-existing materials ("Background IP") and grants the Client a perpetual, irrevocable, worldwide, royalty-free licence to use such Background IP solely to the extent required to exploit the Deliverables.',
   NULL, 'HIGH', true, true, true,
   '["ip","assignment","deliverables"]'::jsonb,
   '["MSA","SOW"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_liability_cap', v_tenant, 'Limitation of Liability — 12 Months Fees', 'Limitation of Liability',
   'LIABILITY',
   'Except in cases of (i) fraud or wilful misconduct, (ii) breach of confidentiality, (iii) breach of data protection obligations, (iv) indemnification obligations, or (v) infringement of intellectual property rights, the aggregate liability of each Party arising out of or in connection with this Agreement, whether in contract, tort (including negligence), under statute or otherwise, shall not exceed the total fees paid or payable by the Client under this Agreement during the twelve (12) month period immediately preceding the event giving rise to the claim. In no event shall either Party be liable for any indirect, incidental, special, consequential or punitive damages, including lost profits, lost revenues, lost data, or business interruption, even if advised of the possibility thereof.',
   NULL, 'CRITICAL', true, true, true,
   '["liability","cap","exclusions"]'::jsonb,
   '["MSA","SOW","SLA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_indemnification', v_tenant, 'Mutual Indemnification', 'Indemnification',
   'INDEMNIFICATION',
   'Each Party (the "Indemnifying Party") shall defend, indemnify and hold harmless the other Party and its officers, directors, employees and agents (the "Indemnified Parties") from and against any and all third-party claims, actions, losses, damages, liabilities, costs and expenses (including reasonable attorneys'' fees) arising out of or relating to: (a) any breach by the Indemnifying Party of its representations, warranties or covenants under this Agreement; (b) the gross negligence or wilful misconduct of the Indemnifying Party; or (c) any infringement of a third party''s intellectual property rights by the Indemnifying Party''s materials. The Indemnified Party shall promptly notify the Indemnifying Party of any claim, give the Indemnifying Party sole control of the defence and settlement, and cooperate at the Indemnifying Party''s expense.',
   NULL, 'HIGH', true, true, true,
   '["indemnity","mutual","ip"]'::jsonb,
   '["MSA","SOW","NDA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_data_protection', v_tenant, 'Data Protection — GDPR/CCPA', 'Data Protection',
   'DATA_PRIVACY',
   'Each Party shall comply with all applicable data protection and privacy laws, including the EU General Data Protection Regulation (GDPR), the UK GDPR, the California Consumer Privacy Act (CCPA) and any successor legislation. Where the Supplier processes Personal Data (as defined in the GDPR) on behalf of the Client, the Supplier shall act as Processor and the Client as Controller, and the Parties shall enter into a Data Processing Addendum substantially in the form attached as Schedule A. The Supplier shall (a) process Personal Data only on documented instructions from the Client; (b) implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk; (c) notify the Client of any Personal Data Breach without undue delay and in any case within forty-eight (48) hours; and (d) assist the Client with data subject requests and regulatory inquiries.',
   NULL, 'CRITICAL', true, true, false,
   '["gdpr","ccpa","privacy","dpa"]'::jsonb,
   '["MSA","SOW","NDA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_termination', v_tenant, 'Termination — For Cause and Convenience', 'Termination',
   'TERMINATION',
   'Either Party may terminate this Agreement (a) for material breach, if the breaching Party fails to cure such breach within thirty (30) days after receiving written notice; (b) for insolvency, upon the other Party''s bankruptcy, assignment for the benefit of creditors, appointment of a receiver, or similar event; or (c) for convenience, upon sixty (60) days'' prior written notice. Upon termination: (i) all outstanding fees for services performed prior to the effective date of termination become immediately due; (ii) each Party shall return or destroy the other Party''s Confidential Information; and (iii) the provisions relating to Confidentiality, Intellectual Property, Limitation of Liability, Indemnification, Governing Law and Dispute Resolution shall survive.',
   NULL, 'MEDIUM', true, true, true,
   '["termination","cure","convenience"]'::jsonb,
   '["MSA","SOW","SLA","NDA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_warranties', v_tenant, 'Warranties — Services', 'Warranties',
   'WARRANTIES',
   'The Supplier represents and warrants that: (a) it has the full right, power and authority to enter into and perform its obligations under this Agreement; (b) the Services shall be performed in a professional and workmanlike manner, consistent with generally accepted industry standards; (c) the Services and Deliverables shall conform in all material respects to the specifications set forth in the applicable Statement of Work; (d) the Deliverables shall not infringe any third party''s intellectual property rights; and (e) it shall comply with all applicable laws and regulations in the performance of the Services. The Client''s sole remedy for breach of the warranty in subsection (c) is re-performance of the non-conforming Services at no additional cost, provided the Client notifies the Supplier within thirty (30) days of discovery.',
   NULL, 'MEDIUM', true, true, true,
   '["warranty","services"]'::jsonb,
   '["MSA","SOW"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_force_majeure', v_tenant, 'Force Majeure', 'Force Majeure',
   'FORCE_MAJEURE',
   'Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement (other than payment obligations) to the extent such failure or delay is caused by circumstances beyond its reasonable control, including acts of God, war, terrorism, civil unrest, pandemic, government actions, natural disasters, or failures of public utilities or telecommunications networks ("Force Majeure Event"). The affected Party shall promptly notify the other Party, use reasonable efforts to mitigate the impact, and resume performance as soon as reasonably practicable. If a Force Majeure Event continues for more than sixty (60) consecutive days, either Party may terminate this Agreement upon written notice without further liability.',
   NULL, 'MEDIUM', true, false, true,
   '["force-majeure","excuse"]'::jsonb,
   '["MSA","SOW","SLA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_governing_law', v_tenant, 'Governing Law — Delaware', 'Governing Law',
   'GOVERNING_LAW',
   'This Agreement and any dispute arising out of or in connection with it shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict-of-laws principles. Any dispute, controversy or claim arising out of or relating to this Agreement shall be first submitted to good-faith negotiation between senior executives of each Party. If not resolved within thirty (30) days, the dispute shall be finally settled by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, with the seat in Wilmington, Delaware, in English, before a single arbitrator. Judgment on the award may be entered in any court of competent jurisdiction. Notwithstanding the foregoing, either Party may seek injunctive or equitable relief in any court of competent jurisdiction to protect its intellectual property or Confidential Information.',
   NULL, 'MEDIUM', true, true, true,
   '["governing-law","arbitration","delaware"]'::jsonb,
   '["MSA","SOW","SLA","NDA"]'::jsonb,
   'State of Delaware', v_user, now(), now()),

  ('cl_acme_payment_terms', v_tenant, 'Payment Terms — Net 30', 'Payment Terms',
   'FINANCIAL',
   'The Client shall pay all undisputed invoices within thirty (30) days of receipt. All fees are exclusive of applicable taxes, which shall be paid by the Client. Late payments shall accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law. The Client may dispute any invoice in good faith by providing written notice with reasonable detail within fifteen (15) days of receipt; the Parties shall work together in good faith to resolve any dispute. The Supplier shall not suspend Services for non-payment of disputed amounts.',
   NULL, 'MEDIUM', true, true, true,
   '["payment","net30","invoicing"]'::jsonb,
   '["MSA","SOW","SLA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_assignment', v_tenant, 'Assignment — Consent Required', 'Assignment',
   'ASSIGNMENT',
   'Neither Party may assign, transfer or delegate this Agreement or any of its rights or obligations hereunder without the prior written consent of the other Party, such consent not to be unreasonably withheld, conditioned or delayed; except that either Party may assign this Agreement without consent to (a) an Affiliate, or (b) a successor in connection with a merger, acquisition, reorganisation or sale of all or substantially all of its assets, provided such successor assumes all obligations in writing. Any attempted assignment in violation of this clause shall be null and void.',
   NULL, 'LOW', true, true, true,
   '["assignment","change-of-control"]'::jsonb,
   '["MSA","SOW","NDA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_notices', v_tenant, 'Notices', 'Notices',
   'NOTICES',
   'All notices, requests, consents and other communications required or permitted under this Agreement shall be in writing and shall be deemed duly given (a) when delivered by hand; (b) on the next business day when sent by a nationally recognised overnight courier; (c) three (3) business days after deposit in the mail, certified or registered, return receipt requested, postage prepaid; or (d) on the date of transmission by email, provided no bounce-back or error is received and a hard copy is sent by one of the foregoing methods within three (3) business days. Notices shall be sent to the addresses set forth on the signature page or to such other address as a Party may designate by notice given in accordance with this clause.',
   NULL, 'LOW', true, true, true,
   '["notices","boilerplate"]'::jsonb,
   '["MSA","SOW","SLA","NDA"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_entire_agreement', v_tenant, 'Entire Agreement & Severability', 'Entire Agreement',
   'GENERAL',
   'This Agreement, together with all Schedules, Exhibits and Statements of Work, constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior or contemporaneous agreements, understandings, negotiations and discussions, whether oral or written. No modification, amendment or waiver of any provision of this Agreement shall be effective unless in writing and signed by both Parties. If any provision of this Agreement is held to be invalid, illegal or unenforceable, such provision shall be modified to the minimum extent necessary, and the remaining provisions shall continue in full force and effect. The failure of either Party to enforce any right or provision shall not constitute a waiver of such right or provision. This Agreement may be executed in counterparts, including by electronic signature, each of which shall constitute an original.',
   NULL, 'LOW', true, true, false,
   '["entire-agreement","severability","waiver","counterparts"]'::jsonb,
   '["MSA","SOW","SLA","NDA","EMPLOYMENT"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_insurance', v_tenant, 'Insurance', 'Insurance',
   'INSURANCE',
   'The Supplier shall maintain, at its own cost and during the term of this Agreement and for two (2) years thereafter, insurance coverage of the following types and minimum limits: (a) Commercial General Liability, including bodily injury, property damage and contractual liability, with limits of not less than $2,000,000 per occurrence and $5,000,000 in the aggregate; (b) Professional Liability / Errors & Omissions with limits of not less than $5,000,000 per claim and in the aggregate; (c) Cyber Liability with limits of not less than $5,000,000 per claim; and (d) Workers'' Compensation as required by applicable law. The Supplier shall provide certificates of insurance upon request and shall give the Client at least thirty (30) days'' prior written notice of cancellation or material change.',
   NULL, 'MEDIUM', true, false, true,
   '["insurance","coverage"]'::jsonb,
   '["MSA","SOW"]'::jsonb,
   NULL, v_user, now(), now()),

  ('cl_acme_non_solicit', v_tenant, 'Non-Solicitation — 12 Months', 'Non-Solicitation',
   'OPERATIONAL',
   'During the term of this Agreement and for twelve (12) months after its termination or expiration, neither Party shall directly solicit for employment or engagement any employee or contractor of the other Party who has had material involvement in the performance of this Agreement, without the other Party''s prior written consent. This clause shall not prohibit (a) general public recruitment advertising not specifically targeted at such persons, or (b) hiring a person who responds to such general advertising.',
   NULL, 'LOW', false, false, true,
   '["non-solicit","people"]'::jsonb,
   '["MSA","SOW"]'::jsonb,
   NULL, v_user, now(), now())
  ON CONFLICT (tenant_id, name, version) DO NOTHING;

  -- ─────────────────────────────────────────────────────────────
  -- Default playbook
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO playbooks (
    id, tenant_id, name, description, contract_types, is_default, is_active, version,
    critical_count_threshold, high_risk_score_threshold, acceptable_score_threshold,
    preferred_language, created_by, created_at, updated_at
  ) VALUES (
    v_pb_id, v_tenant, 'Acme Standard — Buy-Side',
    'Default Acme policy pack for supplier-facing contracts. Mirrors preferred liability caps, IP assignment, data protection and termination rights.',
    '["MSA","SOW","SLA","NDA"]'::jsonb,
    true, true, 1,
    2, 70, 40,
    '{}'::jsonb,
    v_user, now(), now()
  )
  ON CONFLICT (tenant_id, name, version) DO NOTHING;

  -- Playbook clauses (dedup by delete+insert is simpler than ON CONFLICT since no unique)
  DELETE FROM playbook_clauses WHERE playbook_id = v_pb_id;
  INSERT INTO playbook_clauses (
    id, playbook_id, category, name, preferred_text, minimum_acceptable,
    walkaway_triggers, risk_level, notes, negotiation_guidance, sort_order, is_active,
    created_at, updated_at
  ) VALUES
  (gen_random_uuid()::text, v_pb_id, 'LIABILITY', 'Limitation of Liability — 12 Months Fees',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_liability_cap'),
   'Liability cap of at least 6 months fees; unlimited for confidentiality, IP, data protection, indemnification and gross negligence.',
   '["unlimited liability demanded by counterparty","liability cap below 3 months fees","waiver of essential carve-outs"]'::jsonb,
   'critical',
   'Liability cap is our most important commercial protection. Push to 12 months fees; accept 6 months only for low-risk engagements.',
   'If counterparty insists on lower cap, negotiate super-cap for IP indemnity. Never accept unlimited liability outside the standard carve-outs.',
   10, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'INTELLECTUAL_PROPERTY', 'IP Ownership — Client Owns Deliverables',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_ip_ownership'),
   'Client owns Deliverables on payment; Supplier retains Background IP with a broad licence to Client for use of Deliverables.',
   '["Supplier retains ownership of Deliverables","no licence to Background IP","assignment revoked on non-payment"]'::jsonb,
   'critical',
   'Default position: Client owns all Deliverables. Supplier retains Background IP but grants Client a perpetual, worldwide, royalty-free licence to use it as part of Deliverables.',
   'Acceptable compromise: transfer-on-payment model, provided licence to Background IP remains perpetual.',
   20, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'DATA_PRIVACY', 'Data Protection — GDPR/CCPA',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_data_protection'),
   'Written DPA, 72-hour breach notice, SCCs for cross-border transfers.',
   '["no DPA","breach notification over 7 days","no standard contractual clauses for EU transfers"]'::jsonb,
   'critical',
   'A written Data Processing Addendum is mandatory whenever personal data is processed. Breach notice must be within 48 hours.',
   'Tighten to 24-hour notice for regulated personal data (health, financial).',
   30, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'CONFIDENTIALITY', 'Confidentiality — Mutual',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_confidentiality'),
   'Mutual confidentiality with 5-year tail; indefinite for trade secrets.',
   '["one-way confidentiality favouring Supplier","tail under 3 years","no trade-secret carve-out"]'::jsonb,
   'high',
   'Mutual obligations. Tail of 5 years, indefinite for trade secrets.',
   'Shorter tail (3 years) acceptable for low-sensitivity engagements.',
   40, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'INDEMNIFICATION', 'Mutual Indemnification',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_indemnification'),
   'Mutual indemnity for IP infringement, breach of confidentiality and wilful misconduct.',
   '["one-sided indemnity","Supplier refuses IP indemnity"]'::jsonb,
   'high',
   'Require full IP-infringement indemnity from Supplier with defense obligation.',
   'If Supplier resists, accept carve-out for indemnified party''s combinations or modifications.',
   50, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'TERMINATION', 'Termination — For Cause and Convenience',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_termination'),
   '30-day cure for material breach; 60-day termination-for-convenience right; survival of IP, confidentiality, liability.',
   '["no termination-for-convenience","cure period over 60 days","no survival of key clauses"]'::jsonb,
   'medium',
   'Insist on termination-for-convenience. 30-day cure is standard.',
   'Accept 90-day convenience notice for multi-year enterprise deals.',
   60, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'GOVERNING_LAW', 'Governing Law — Delaware',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_governing_law'),
   'Delaware law, AAA arbitration in Wilmington; injunctive relief carve-out for IP/confidentiality.',
   '["governing law in Supplier''s home jurisdiction","no injunctive-relief carve-out"]'::jsonb,
   'medium',
   'Prefer Delaware law and AAA arbitration. Maintain injunctive-relief carve-out.',
   'NY law is an acceptable compromise.',
   70, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'FINANCIAL', 'Payment Terms — Net 30',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_payment_terms'),
   'Net 30, 15-day invoice dispute window, 1.5% monthly late-payment interest.',
   '["payment due on receipt","late interest above 2% monthly"]'::jsonb,
   'medium',
   'Net 30 is the default. Extend to Net 45 only for strategic supplier relationships.',
   'Include good-faith dispute window before interest accrues.',
   80, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'WARRANTIES', 'Warranties — Services',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_warranties'),
   'Professional-and-workmanlike, conformance to SoW, non-infringement, legal compliance, re-performance remedy.',
   '["AS-IS disclaimer only","no non-infringement warranty"]'::jsonb,
   'medium',
   'Minimum package: workmanlike performance, conformance to specs, non-infringement, legal compliance.',
   'Re-performance-only remedy is acceptable for services.',
   90, true, now(), now()),

  (gen_random_uuid()::text, v_pb_id, 'INSURANCE', 'Insurance',
   (SELECT content FROM clause_library WHERE id = 'cl_acme_insurance'),
   'CGL $2M/$5M, E&O $5M, Cyber $5M, Workers'' Comp as required.',
   '["no cyber liability insurance","E&O under $1M"]'::jsonb,
   'medium',
   'Insurance minimums scale with engagement risk. Require certificates of insurance.',
   'Reduce limits for low-dollar SOWs (under $100k) by half.',
   100, true, now(), now());

  RAISE NOTICE 'Seeded clause library and default playbook for tenant %.', v_tenant;
END $$;
