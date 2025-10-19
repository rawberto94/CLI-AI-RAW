-- Audit Trail Schema Migration
-- Adds comprehensive audit logging for compliance and debugging

-- Create enum for audit actions
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ACCESS', 'EXPORT', 'IMPORT');

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  
  -- Action details
  "action" "AuditAction" NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  
  -- Changes tracking
  "changesBefore" JSONB,
  "changesAfter" JSONB,
  "changedFields" TEXT[],
  
  -- User context
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "correlationId" TEXT,
  
  -- Metadata
  "reason" TEXT,
  "metadata" JSONB,
  "suspicious" BOOLEAN DEFAULT FALSE,
  "suspiciousReason" TEXT,
  
  -- Timing
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for efficient querying
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for common queries
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource", "resourceId");
CREATE INDEX "audit_logs_resourceType_idx" ON "audit_logs"("resourceType");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId") 
  WHERE "correlationId" IS NOT NULL;
CREATE INDEX "audit_logs_suspicious_idx" ON "audit_logs"("suspicious") 
  WHERE "suspicious" = TRUE;

-- Composite index for common query patterns
CREATE INDEX "audit_logs_tenant_resource_idx" ON "audit_logs"("tenantId", "resourceType", "timestamp" DESC);
CREATE INDEX "audit_logs_user_action_idx" ON "audit_logs"("userId", "action", "timestamp" DESC);

-- Full-text search index on metadata
CREATE INDEX "audit_logs_metadata_gin_idx" ON "audit_logs" USING GIN ("metadata");

-- Create function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER AS $
DECLARE
  recent_actions INTEGER;
  bulk_operations INTEGER;
BEGIN
  -- Check for rapid successive actions (>10 in 1 minute)
  SELECT COUNT(*) INTO recent_actions
  FROM audit_logs
  WHERE "userId" = NEW."userId"
    AND "timestamp" > NOW() - INTERVAL '1 minute';
  
  IF recent_actions > 10 THEN
    NEW.suspicious = TRUE;
    NEW."suspiciousReason" = 'Rapid successive actions detected';
  END IF;
  
  -- Check for bulk delete operations
  IF NEW.action = 'DELETE' THEN
    SELECT COUNT(*) INTO bulk_operations
    FROM audit_logs
    WHERE "userId" = NEW."userId"
      AND action = 'DELETE'
      AND "timestamp" > NOW() - INTERVAL '5 minutes';
    
    IF bulk_operations > 5 THEN
      NEW.suspicious = TRUE;
      NEW."suspiciousReason" = COALESCE(NEW."suspiciousReason" || '; ', '') || 'Bulk delete operations detected';
    END IF;
  END IF;
  
  -- Check for access from unusual IP
  -- (This is a placeholder - in production, you'd check against known IPs)
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger for suspicious activity detection
DROP TRIGGER IF EXISTS detect_suspicious_activity_trigger ON audit_logs;
CREATE TRIGGER detect_suspicious_activity_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_activity();

-- Create function to clean old audit logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE "timestamp" < NOW() - (retention_days || ' days')::INTERVAL
    AND suspicious = FALSE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Create view for recent suspicious activity
CREATE OR REPLACE VIEW suspicious_activity_summary AS
SELECT 
  "tenantId",
  "userId",
  "userName",
  "action",
  "resourceType",
  COUNT(*) as incident_count,
  MAX("timestamp") as last_incident,
  STRING_AGG(DISTINCT "suspiciousReason", '; ') as reasons
FROM audit_logs
WHERE suspicious = TRUE
  AND "timestamp" > NOW() - INTERVAL '7 days'
GROUP BY "tenantId", "userId", "userName", "action", "resourceType"
ORDER BY incident_count DESC;

-- Create view for audit log summary by user
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  "tenantId",
  "userId",
  "userName",
  DATE("timestamp") as activity_date,
  COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE action = 'CREATE') as creates,
  COUNT(*) FILTER (WHERE action = 'UPDATE') as updates,
  COUNT(*) FILTER (WHERE action = 'DELETE') as deletes,
  COUNT(*) FILTER (WHERE action = 'ACCESS') as accesses,
  COUNT(*) FILTER (WHERE suspicious = TRUE) as suspicious_actions
FROM audit_logs
WHERE "timestamp" > NOW() - INTERVAL '30 days'
GROUP BY "tenantId", "userId", "userName", DATE("timestamp")
ORDER BY activity_date DESC, total_actions DESC;

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system operations';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (CREATE, UPDATE, DELETE, ACCESS, EXPORT, IMPORT)';
COMMENT ON COLUMN audit_logs.resource IS 'Resource identifier (e.g., contract, artifact, user)';
COMMENT ON COLUMN audit_logs.resourceId IS 'Unique ID of the resource';
COMMENT ON COLUMN audit_logs.changesBefore IS 'State of resource before change';
COMMENT ON COLUMN audit_logs.changesAfter IS 'State of resource after change';
COMMENT ON COLUMN audit_logs.changedFields IS 'Array of field names that changed';
COMMENT ON COLUMN audit_logs.correlationId IS 'ID to correlate related operations';
COMMENT ON COLUMN audit_logs.suspicious IS 'Flag indicating suspicious activity';
COMMENT ON COLUMN audit_logs.suspiciousReason IS 'Reason why activity was flagged as suspicious';

-- Grant appropriate permissions (adjust as needed)
-- GRANT SELECT ON audit_logs TO audit_viewer_role;
-- GRANT INSERT ON audit_logs TO application_role;

