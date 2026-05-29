# Azure Cybersecurity Audit - 2026-05-29

## Scope

This audit covers the active Azure subscription and the local ConTigo deployment repository as of 2026-05-29.

Azure scope:

- Subscription: `Azure subscription 1`
- Subscription ID: `42f90129-b16b-4416-8785-eed869e76361`
- Tenant ID: `6c991537-0cde-4dad-baa9-ea253cc137d5`
- Signed-in account: personal Microsoft account guest identity

Swiss client assumption:

- Contract data may include confidential business data and personal data.
- Target posture should satisfy Swiss FADP/nFADP expectations, GDPR-aligned controls, Swiss data residency where contractually required, strong auditability, and least-privilege access.

## Executive Summary

The current Azure footprint is small and mostly located in `switzerlandnorth`, which is good for Swiss client positioning. The main risks are not region placement of the visible resources, but missing hardening around public network access, Key Vault deletion protection, secret rotation, Defender/Policy coverage, and dependency vulnerabilities in the application supply chain.

Highest-priority findings:

1. Azure OpenAI embedding deployment uses `GlobalStandard`, which may not satisfy strict Switzerland-only data residency requirements.
2. Key Vault and Azure OpenAI are publicly reachable instead of private endpoint or firewall-restricted.
3. A Key Vault secret has no expiration date.
4. Microsoft Defender for Cloud provider is not registered, security contacts are empty, and subscription activity logs are not exported.
5. Production dependency audit still reports high vulnerabilities after the first remediation pass.
6. The current Azure identity lacks several read permissions needed for a complete audit.

Remediations applied after the initial audit:

- Live Key Vault purge protection is now enabled for `contigo`.
- Infrastructure now enables Key Vault purge protection and 90-day soft-delete retention.
- Deployment script now sets a 180-day expiration on generated Key Vault secrets.
- Helm manual fallback secrets no longer contain known production-unsafe default credentials.
- Helm production manual-secret mode now requires explicit non-empty core runtime secrets.
- Dependency remediation removed all critical production advisories found by `pnpm audit --prod`.
- CI workflows now run a critical-only production dependency audit to block reintroduced critical runtime vulnerabilities.
- Registering `Microsoft.Security` and updating the existing Document Intelligence secret expiration were attempted but blocked by RBAC.

## Azure Inventory

Visible resources:

| Resource | Type | Resource group | Region | Notes |
|---|---|---|---|---|
| `ConTigoVM` | `Microsoft.Compute/virtualMachines` | `ConTigoVM_group` | `switzerlandnorth` | Ubuntu 24.04, Trusted Launch enabled |
| `contigo` | `Microsoft.KeyVault/vaults` | `contigoContainerApps` | `switzerlandnorth` | RBAC auth enabled, public network access enabled |
| `contigo-openai` | `Microsoft.CognitiveServices/accounts` | `contigoContainerApps` | `switzerlandnorth` | Azure OpenAI, public network access enabled |

Azure OpenAI deployments:

| Deployment | Model | Model version | Scale type | Capacity | Residency concern |
|---|---|---|---|---:|---|
| `gpt-4o` | `gpt-4o` | `2024-11-20` | `Standard` | 17 | Regional deployment in Switzerland North |
| `text-embedding-3-small` | `text-embedding-3-small` | `1` | `GlobalStandard` | 150 | Verify or replace for strict Swiss-only residency |

VM security baseline observed:

- OS: Linux, Ubuntu 24.04 LTS.
- VM size: `Standard_B2ats_v2`.
- Trusted Launch: enabled.
- Secure Boot: enabled.
- vTPM: enabled.
- Boot diagnostics: enabled.
- Managed identity: not configured.
- VM extensions: none returned.

## Findings

### Critical - Data residency risk from global embedding deployment

Evidence:

- Azure OpenAI resource is in `switzerlandnorth`.
- `gpt-4o` uses `Standard` scale.
- `text-embedding-3-small` uses `GlobalStandard` scale.

Risk:

For Swiss clients, especially regulated or contractually CH-resident clients, a global Azure OpenAI deployment tier can create data residency ambiguity. Embeddings are derived from contract text, so they should be treated as sensitive contract data.

Recommendation:

- Replace the embedding deployment with a regional `Standard` deployment in `switzerlandnorth` if available.
- If regional capacity is unavailable, document the contractual basis for `GlobalStandard` and get explicit client approval.
- Add an Azure Policy/data residency gate that blocks non-approved AI deployment SKUs for production.
- Keep `RAG_EMBED_DIMENSIONS=1024` aligned with the regional deployment after migration.

### High - Key Vault public network access is enabled

Evidence:

- Key Vault `contigo` has `publicNetworkAccess: Enabled`.
- Key Vault network ACL `defaultAction: Allow`.
- No IP rules or virtual network rules are configured.
- RBAC authorization is enabled.

Risk:

Even with RBAC, public network exposure increases attack surface for credential stuffing, token theft, misconfigured principals, and lateral movement. For Swiss client data, production secrets should be reachable only from private application infrastructure.

Recommendation:

- Add a private endpoint for Key Vault in the production VNet.
- Switch `defaultAction` to `Deny` only after private connectivity is verified.
- Use managed identity from the app/workers instead of broad user access.
- Use Privileged Identity Management for human break-glass access.

Example direction:

```bash
az keyvault update \
  --name contigo \
  --resource-group contigoContainerApps \
  --default-action Deny
```

Do not run this until private endpoint/DNS access is confirmed, or the app may lose access to secrets.

### High - Azure OpenAI public network access and key-based auth remain enabled

Evidence:

- Azure OpenAI `contigo-openai` has `publicNetworkAccess: Enabled`.
- Network ACLs are not configured.
- `disableLocalAuth` is unset/null, which means key-based local auth is not disabled.

Risk:

Contract prompts, OCR text, metadata, and RAG queries are sensitive. Public access plus API-key authentication increases the blast radius of leaked keys.

Recommendation:

- Use private endpoint for Azure OpenAI where supported.
- Restrict public network access after private routing is tested.
- Move application access to managed identity/Entra ID where supported by the SDK and service configuration.
- Disable local auth only after managed identity access is proven.

Example direction:

```bash
az cognitiveservices account update \
  --name contigo-openai \
  --resource-group contigoContainerApps \
  --set properties.disableLocalAuth=true
```

### High - Key Vault purge protection was not enabled or was unset

Status: remediated live and in IaC after the initial audit.

Evidence:

- Initial live Key Vault output showed `enableSoftDelete: true` and `softDeleteRetentionInDays: 90`.
- Initial live Key Vault output showed `enablePurgeProtection: null`.
- Initial infrastructure code in `infrastructure/azure/main.bicep` enabled soft delete but did not enable purge protection.
- Remediation verification now shows `enablePurgeProtection: true`.

Risk:

Without purge protection, a privileged or compromised principal can permanently purge secrets after deletion. This is a major recovery and audit risk for production secrets.

Recommendation:

- Keep purge protection enabled on production Key Vaults.
- Keep Bicep/IaC aligned with `enablePurgeProtection: true`.
- Keep 90-day retention for production.

Example:

```bash
az keyvault update \
  --name contigo \
  --resource-group contigoContainerApps \
  --enable-purge-protection true
```

### High - Key Vault secret has no expiration date

Evidence:

- Secret metadata lists `DocumentIntelligenceAPIKey1` with `expires: null`.

Risk:

Non-expiring secrets make key compromise harder to contain and are difficult to defend in client security reviews.

Recommendation:

- Set expiration dates on all secrets.
- Define a 90-day or 180-day rotation policy for AI, storage, database, and auth secrets.
- Prefer managed identity over service keys where supported.

Example:

```bash
az keyvault secret set-attributes \
  --vault-name contigo \
  --name DocumentIntelligenceAPIKey1 \
  --expires 2026-08-27T00:00:00Z
```

### High - Defender for Cloud and security governance are not active/readable

Evidence:

- `Microsoft.Security` provider registration state is `NotRegistered`.
- `az security pricing list` returned Not Found.
- Security contacts list returned empty.
- Azure Policy state summary failed due missing permission.
- Subscription diagnostic settings returned empty.

Risk:

For a production client environment, this means there is no confirmed Defender posture management, no configured security notification recipient, no verified policy compliance state, and no subscription-level activity log export for investigation evidence.

Recommendation:

- Register `Microsoft.Security`.
- Enable Defender for Cloud plans appropriate to the deployed services: Servers, Key Vault, Storage, Containers/Container Registry if used, Databases when PostgreSQL is deployed.
- Configure security contact notifications.
- Assign and enforce Azure Policy initiatives for Switzerland-only locations, private endpoints, no public storage, Key Vault purge protection, diagnostic settings, and TLS minimums.
- Export subscription activity logs to a Log Analytics workspace or immutable storage in Switzerland.

Example direction:

```bash
az provider register --namespace Microsoft.Security
az security contact create --email <security-contact@example.com> --alert-notifications On --alerts-admins On
```

### High - Production dependency audit has critical/high advisories

Evidence:

Initial `pnpm audit --prod --json` summary:

| Severity | Count |
|---|---:|
| Critical | 4 |
| High | 67 |
| Moderate | 63 |
| Low | 6 |

Post-remediation production audit summary:

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 59 |
| Moderate | 60 |
| Low | 6 |

The new `pnpm security:audit:critical` script passes because no critical production advisories remain, while still reporting the remaining high/moderate/low backlog.

Highest-risk packages/advisories observed:

- `jspdf`: critical/high HTML/PDF injection and DoS advisories. Patch target includes `>=4.2.1`.
- `convict`: critical prototype pollution. Patch target `>=6.2.5`.
- `protobufjs`: critical arbitrary code execution. Patch target `>=7.5.5`.
- `next`: high DoS advisory. Patch target `>=15.5.10`; current app version is `15.5.9`.
- `xlsx`: high prototype pollution/ReDoS with no patched version in the advisory data.
- `langchain` and `@langchain/core`: high serialization injection advisories.

Risk:

This is a supply-chain blocker before a client-facing production go-live. The `next`, `jspdf`, `protobufjs`, `langchain`, and spreadsheet parsing advisories are especially relevant for a document-heavy contract platform.

Recommendation:

- Keep `next` at least `15.5.10`.
- Keep `jspdf`, `convict`, and `protobufjs` at fixed versions.
- Plan the `langchain` and `@langchain/core` remediation as a compatibility-tested migration, because this repo currently uses LangChain 0.2 packages in shared workspaces.
- Replace or sandbox `xlsx` if no fixed release is available.
- Add dependency audit to CI and fail production builds on critical/high runtime vulnerabilities unless explicitly risk-accepted.

### Medium - Audit identity lacks full read permissions

Evidence:

The current identity could read some resource metadata, but failed to read:

- Resource groups.
- VM network interface details.
- Azure Policy state summary.
- Key Vault keys metadata.
- Key Vault certificates metadata.

Risk:

The audit cannot prove NSG rules, public IPs, private endpoint status, disk inventory, full policy compliance, or key/certificate expiration status. For a Swiss client review, incomplete evidence weakens the control story.

Recommendation:

- Run the next audit using a dedicated audit group with Reader, Security Reader, Monitoring Reader, and narrowly scoped Key Vault metadata/list permissions.
- Avoid granting broad standing owner permissions to personal accounts.
- Use PIM for temporary elevated access.

### Medium - Key Vault RBAC is assigned directly to human users

Evidence:

- Key Vault role assignments are direct user assignments, including Contributor/RBAC administration and Key Vault officer roles.

Risk:

Direct personal-account assignments are hard to govern, offboard, and review. For Swiss clients, evidence should show controlled operational access via named groups, PIM, and break-glass policy.

Recommendation:

- Replace direct user assignments with Entra ID groups.
- Use PIM activation for admin/officer roles.
- Keep app runtime access on managed identities with least privilege.
- Review Key Vault role assignments monthly.

### Medium - VM observability and backup are not confirmed

Evidence:

- Azure Advisor recommends enabling VM Insights.
- Azure Advisor recommends enabling VM backups.
- VM extension list returned empty.
- VM managed identity is not configured.

Risk:

Without VM Insights and backup, incident detection, forensic timelines, and recovery are weak. This matters if the VM hosts production components, reverse proxy, demo workloads, or operational scripts.

Recommendation:

- Enable VM Insights/Azure Monitor Agent.
- Enable Azure Backup with a Switzerland-aligned Recovery Services vault if this VM holds state or hosts production workloads.
- Move production workloads to managed PaaS/AKS/Container Apps with private networking where possible.
- Add a system-assigned managed identity if the VM needs Azure resource access.

### Medium - Subscription activity logs are not exported

Evidence:

- Subscription diagnostic settings list returned empty.

Risk:

Azure Activity Log retention and investigation evidence are insufficient for a professional client audit if logs are not centralized and retained.

Recommendation:

- Create a Log Analytics workspace in `switzerlandnorth`.
- Export subscription Activity Logs to Log Analytics and/or immutable storage.
- Define retention: at least 365 days for operational security, longer if client contracts require it.

### Medium - Swiss compliance config exists but is not enforced

Evidence:

- `apps/web/lib/swiss-compliance.ts` defines CH-focused controls and `DATA_REGION` requirements.
- Search found no runtime use of `validateDataRegion`, `swissComplianceConfig`, or `requiredEnvVars` outside that file.
- The config allows non-Swiss regions such as `westeurope` and several EU locations, while also setting `allowCrossBorderTransfer: false`.

Risk:

The repository has a compliance intent, but not an enforceable control. This can lead to drift between marketing/client commitments and actual deployment behavior.

Recommendation:

- Decide the contractual stance: strict Switzerland-only or Switzerland/EEA allowed.
- Enforce allowed Azure locations with Azure Policy.
- Add startup validation that rejects non-approved `DATA_REGION`, storage, database, AI, and OCR regions.
- Add CI checks against Helm/Bicep files for disallowed regions or global AI SKUs.

### Medium - Helm default manual secrets are unsafe if used directly

Evidence:

- `helm/contigo/values.yaml` contains manual fallback values such as `postgres:postgres`, `change-me-in-production`, and `minioadmin`.
- Azure deployment values use Key Vault object mapping, which is the right direction.

Risk:

If a non-Azure or rushed Helm install uses defaults, production could start with known credentials.

Recommendation:

- Make manual secret values empty and require explicit override.
- Add Helm template `required` checks for production.
- Keep Azure production on Key Vault/CSI secrets only.

## Positive Controls Observed

- All visible Azure resources are in `switzerlandnorth`.
- VM Trusted Launch, Secure Boot, and vTPM are enabled.
- Key Vault uses RBAC authorization and soft delete.
- App container images run as non-root users in the primary Dockerfiles.
- Middleware applies CSRF validation for state-changing APIs, with explicit exemptions.
- Middleware applies rate limiting and security headers.
- Next.js config defines CSP and common security headers.
- Local sensitive artifacts such as `audit.env`, `temp.env`, cookie files, CSRF files, and signup response files are ignored by `.gitignore`.
- Azure go-live configuration uses Key Vault object mapping for production secrets.

## Audit Limitations

- Azure Quick Review (`azqr`) could not run because the executable is not installed in this environment.
- Current Azure RBAC blocked several read-only checks, including resource groups, NICs, Azure Policy state, Key Vault keys, and Key Vault certificates.
- No live PostgreSQL, Redis, storage account, AKS, Container Apps, or App Service resources were visible in the current Azure scope, so those controls could not be assessed live.
- This audit did not retrieve secret values.
- This audit did not perform penetration testing or authenticated runtime testing of the deployed application.

## Recommended Remediation Plan

### Within 24 hours

1. Confirm whether `text-embedding-3-small` `GlobalStandard` is acceptable for Swiss clients. If not, replace it with regional deployment.
2. Enable Key Vault purge protection.
3. Add expiration to `DocumentIntelligenceAPIKey1` and define a rotation schedule.
4. Register `Microsoft.Security` and configure Defender security contacts.
5. Patch critical production dependency vulnerabilities.

### Within 7 days

1. Put Key Vault and Azure OpenAI behind private endpoints or strict firewall rules.
2. Export subscription Activity Logs to Swiss-region Log Analytics or immutable storage.
3. Enable Defender for Cloud plans for deployed services.
4. Configure Azure Policy for allowed locations, Key Vault purge protection, public network restrictions, and diagnostic settings.
5. Enable VM Insights and backup if the VM is production-relevant.

### Before client demo/live production

1. Run a complete azqr scan with sufficient read permissions.
2. Run `pnpm audit --prod` and resolve or risk-accept all critical/high runtime advisories.
3. Run an application security test pass: auth, tenant isolation, upload validation, CSRF, rate limiting, audit logs, and role-based access.
4. Verify all production secrets come from Key Vault and no default Helm fallback secrets are used.
5. Produce a client-facing data processing statement covering Azure region, AI processing tier, backups, logs, subprocessors, retention, and incident process.

## Commands Used

Representative commands:

```bash
az account show
az resource list
az advisor recommendation list
az keyvault show -g contigoContainerApps -n contigo
az keyvault secret list --vault-name contigo
az cognitiveservices account show -g contigoContainerApps -n contigo-openai
az cognitiveservices account deployment list -g contigoContainerApps -n contigo-openai
az provider show -n Microsoft.Security
az monitor diagnostic-settings subscription list --subscription 42f90129-b16b-4416-8785-eed869e76361
pnpm -C /root/app audit --prod --json
```
