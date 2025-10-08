"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BatchUploadZone } from "@/components/batch-upload-zone";
import { ContractUploadZone } from "@/components/contracts/ContractUploadZone";
import { UploadProgressTracker } from "@/components/contracts/UploadProgressTracker";
import {
  UploadSuccessState,
  UploadErrorState,
  UploadMixedState,
} from "@/components/contracts/UploadStatusStates";
import { useUploadManager } from "@/lib/contracts/upload-manager";
import { API_BASE_URL } from "../../../lib/config";
import { tenantHeaders, getTenantId } from "../../../lib/tenant";
import {
  ArrowLeft,
  FileText,
  Upload as UploadIcon,
  Info,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Zap,
  Shield,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeIn } from "@/lib/contracts/animations";
import { LiveContractAnalysisDemo } from "@/components/contracts/LiveContractAnalysisDemo";

const MotionDiv = motion.div as any;

export default function ContractsUploadPage() {
  const [tenantId, setTenantId] = useState<string | undefined>();
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [packs, setPacks] = useState<Array<{ id: string; name?: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [policyPack, setPolicyPack] = useState("");
  const [error, setError] = useState<string>("");
  const [tip, setTip] = useState<string>("");
  const [useModernUpload, setUseModernUpload] = useState(true);

  // Modern upload manager
  const {
    files,
    progress,
    addFiles,
    startUpload,
    cancelUpload,
    cancelAllUploads,
    removeFile,
    retryFile,
    clear,
  } = useUploadManager({
    maxConcurrentUploads: 3,
    maxRetries: 3,
    onAllComplete: (results) => {
      const successCount = results.filter((r) => r.status === "success").length;
      const failedCount = results.filter((r) => r.status === "error").length;

      if (successCount > 0 && failedCount === 0) {
        setTip(
          `Successfully uploaded ${successCount} contract${
            successCount !== 1 ? "s" : ""
          }`
        );
      } else if (failedCount > 0 && successCount === 0) {
        setError(
          `Failed to upload ${failedCount} contract${
            failedCount !== 1 ? "s" : ""
          }`
        );
      } else if (successCount > 0 && failedCount > 0) {
        setTip(
          `Uploaded ${successCount} contract${
            successCount !== 1 ? "s" : ""
          }, ${failedCount} failed`
        );
      }
    },
    onError: (errorMessage) => {
      setError(errorMessage);
    },
  });

  useEffect(() => {
    setTenantId(getTenantId());
  }, []);

  const checkHealth = () => {
    const fetchHealth = async () => {
      try {
        // Try both health endpoints
        let res = await fetch("/api/healthz");
        if (!res.ok) {
          res = await fetch("/api/health");
        }
        setApiHealthy(res.ok);
      } catch (error) {
        console.error("Health check failed:", error);
        setApiHealthy(false);
      }
    };
    fetchHealth();
  };

  const loadPacks = () => {
    const fetchPacks = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/policies/packs`, {
          headers: tenantHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setPacks(Array.isArray(data.packs) ? data.packs : []);
          if (data.packs && data.packs.length > 0 && !policyPack)
            setPolicyPack(data.packs[0].id);
        }
      } catch {}
    };
    void fetchPacks();
  };

  useEffect(() => {
    checkHealth();
    loadPacks();
  }, []);

  const handleUploadComplete = (
    results: Array<{ name: string; docId: string }>
  ) => {
    setError("");
    setTip(
      `Successfully uploaded ${results.length} contract${
        results.length !== 1 ? "s" : ""
      }`
    );
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setTip(
      "Upload failed to reach the backend. Verify API on http://localhost:3001/healthz and try again."
    );
  };

  const handleModernFilesAdded = (newFiles: File[]) => {
    console.log("Files added:", newFiles.length);
    addFiles(newFiles);
  };

  const handleModernUploadStart = () => {
    console.log("Starting upload...");
    startUpload();
  };

  const isUploadComplete =
    progress.totalFiles > 0 && progress.completedFiles === progress.totalFiles;
  const hasSuccessFiles =
    files.filter((f) => f.status === "success").length > 0;
  const hasErrorFiles = files.filter((f) => f.status === "error").length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header with Navigation */}
        <MotionDiv
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
              <Link
                href="/contracts"
                className="hover:text-gray-700 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Contracts
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">Upload</span>
            </nav>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <UploadIcon className="w-8 h-8 text-white" />
              </div>
              Upload Contracts
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              Upload and process new contract documents with AI-powered analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/contracts">
              <Button variant="outline" size="lg" className="shadow-sm">
                <FileText className="w-4 h-4 mr-2" />
                View All Contracts
              </Button>
            </Link>
          </div>
        </MotionDiv>

        {/* Feature Highlights */}
        <MotionDiv
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Fast Processing</h3>
                <p className="text-sm text-gray-600">
                  AI-powered analysis in seconds
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Secure Upload</h3>
                <p className="text-sm text-gray-600">
                  Enterprise-grade encryption
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Smart Extraction
                </h3>
                <p className="text-sm text-gray-600">
                  Automatic data extraction
                </p>
              </div>
            </div>
          </div>
        </MotionDiv>

        {/* Main Upload Card - Live Contract Analysis Demo */}
        <MotionDiv
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.2 }}
        >
          <Card className="shadow-lg border-gray-200">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Brain className="w-6 h-6 text-blue-600" />
                  </div>
                  AI Contract Analysis
                </CardTitle>
                {/* System Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">API Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                      apiHealthy === null
                        ? "bg-gray-100 text-gray-600"
                        : apiHealthy
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {apiHealthy ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {apiHealthy === null
                      ? "Checking..."
                      : apiHealthy
                      ? "Healthy"
                      : "Unreachable"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {/* Live Contract Analysis Demo Component */}
              <LiveContractAnalysisDemo />
            </CardContent>
          </Card>
        </MotionDiv>

        {/* Help Section */}
        <MotionDiv
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Upload Guidelines */}
          <Card className="shadow-md border-gray-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Upload Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Supported File Types
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>PDF documents (.pdf)</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Microsoft Word (.doc, .docx)</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Plain text files (.txt)</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    File Requirements
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <span>
                        Maximum file size: <strong>100MB</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <span>
                        Maximum files per upload: <strong>15</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <span>Text must be readable (not scanned images)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Card className="shadow-md border-gray-200">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-white border-b border-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Tips & Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        Text-Based Documents
                      </p>
                      <p className="text-sm text-blue-700">
                        For best results, ensure your contracts are text-based
                        PDFs or Word documents. Scanned documents may require
                        OCR processing which can take longer.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex gap-3">
                    <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900 mb-1">
                        Batch Processing
                      </p>
                      <p className="text-sm text-green-700">
                        Upload multiple contracts at once to save time. Our
                        system processes up to 3 files simultaneously for faster
                        results.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-purple-900 mb-1">
                        Data Security
                      </p>
                      <p className="text-sm text-purple-700">
                        All uploads are encrypted in transit and at rest. Your
                        contract data is processed securely and never shared
                        with third parties.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionDiv>

        {/* Additional Options */}
        <MotionDiv
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.4 }}
        >
          <Card className="shadow-md border-gray-200">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <CardTitle className="text-lg">
                Additional Upload Options
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Connect to external sources for seamless contract import
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-auto py-4 flex-col items-start gap-2 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    onClick={() =>
                      alert("SharePoint connector integration coming soon!")
                    }
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold">
                        Connect to SharePoint
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 text-left">
                      Import contracts directly from SharePoint
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-auto py-4 flex-col items-start gap-2 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    onClick={() =>
                      alert("Bulk upload from folder coming soon!")
                    }
                  >
                    <div className="flex items-center gap-2 w-full">
                      <UploadIcon className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold">
                        Bulk Upload from Folder
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 text-left">
                      Upload entire folders of contracts at once
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-gray-500 text-center pt-2">
                  Additional upload methods and integrations will be available
                  soon
                </p>
              </div>
            </CardContent>
          </Card>
        </MotionDiv>
      </div>
    </div>
  );
}
