# Azure Demo Cost Reduction and Restore

## Current reduced-cost state

The demo subscription was reviewed on 2026-08-28. The following actions were applied:

- `ConTigoVM` in `ConTigoVM_group` is deallocated. Its CPU and memory compute charges are stopped.
- All revisions of the `contigo` Container App in `contigoContainerApps` are deactivated. The app is offline and has no active application replicas.
- No Azure Cache for Redis resource exists in this subscription, so no Redis cache was deleted.

The following resources remain intentionally retained and can still incur smaller storage, registry, IP-address, log-ingestion, or usage-based charges:

- The VM's Premium OS disk and Standard public IP.
- Container Apps environment, managed certificate, Key Vault, Container Registry, and Log Analytics workspaces.
- Azure OpenAI and Document Intelligence accounts. They use standard consumption pricing; avoid requests while the demo is paused.

## Verify the paused state

Run these commands from PowerShell after signing in with Azure CLI:

```powershell
$azPath = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'

& $azPath vm get-instance-view --resource-group ConTigoVM_group --name ConTigoVM --query "instanceView.statuses[?starts_with(code,'PowerState/')].displayStatus | [0]" --output tsv
& $azPath containerapp revision list --resource-group contigoContainerApps --name contigo --query "length([?properties.active == ``true``])" --output tsv
```

Expected results are `VM deallocated` and `0`.

## Restore the demo application

Activate the last known working revision:

```powershell
$azPath = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
& $azPath containerapp revision activate --resource-group contigoContainerApps --name contigo --revision contigo--0000143
```

Check that it becomes available:

```powershell
& $azPath containerapp show --resource-group contigoContainerApps --name contigo --query "{Fqdn:properties.configuration.ingress.fqdn,RunningStatus:properties.runningStatus,LatestRevision:properties.latestReadyRevisionName}" --output json
```

The Container App has `minReplicas: 0`; after activation it scales from zero only when it receives traffic. To reduce the risk of unexpected CPU usage, keep that setting unchanged.

## Restore the VM only if required

```powershell
$azPath = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
& $azPath vm start --resource-group ConTigoVM_group --name ConTigoVM
```

Stop it again after use. `deallocate` releases compute billing, whereas a normal guest OS shutdown may not.

```powershell
& $azPath vm deallocate --resource-group ConTigoVM_group --name ConTigoVM
```

## Provision Redis again if the application requires it

The current Container App has no Redis resource. Create one only when the application is configured to use Redis for caching or job queues. This creates the smallest legacy Azure Cache for Redis option, Basic C0; it has a standing charge while it exists and cannot be paused.

```powershell
$azPath = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
$resourceGroup = 'contigoContainerApps'
$location = 'switzerlandnorth'
$cacheName = 'contigoredis<unique-suffix>'

& $azPath redis create --resource-group $resourceGroup --name $cacheName --location $location --sku Basic --vm-size C0 --minimum-tls-version 1.2
```

Use a globally unique, lowercase `cacheName`. If Azure no longer permits creation of Azure Cache for Redis in the selected region, create the smallest Azure Managed Redis instance in the Azure portal instead, then use its TLS hostname and access key in the following configuration.

Retrieve connection details and add the application secret:

```powershell
$redisHost = & $azPath redis show --resource-group $resourceGroup --name $cacheName --query hostName --output tsv
$redisKey = & $azPath redis list-keys --resource-group $resourceGroup --name $cacheName --query primaryKey --output tsv
$redisUrl = "rediss://:$redisKey@$redisHost`:6380"

& $azPath containerapp secret set --resource-group $resourceGroup --name contigo --secrets "redis-url=$redisUrl"
```

Before activating or deploying a revision, ensure its container environment has `REDIS_URL` configured as a secret reference to `redis-url`. Do not put the access key directly into source control, deployment YAML, or shell history.

## Redis removal after a future demo

Azure Cache for Redis cannot be deactivated. To stop its standing charge, delete it after confirming cached and queued data is no longer needed:

```powershell
& $azPath redis delete --resource-group contigoContainerApps --name <cache-name> --yes
```

## Review remaining spend

In Azure Portal, open **Cost Management + Billing**, select subscription `Azure subscription 1`, then group costs by **Resource** for the current billing period. Check for disk, public IP, Container Registry, Log Analytics ingestion, Application Insights ingestion, and any newly created Redis cache.