-- Add DI_METADATA artifact type for storing Azure Document Intelligence extraction metadata
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'DI_METADATA';
