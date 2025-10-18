"use client";

import React, { useState } from "react";
import {
  Upload,
  CheckCircle,
  Clock,
  Brain,
  Zap,
  RefreshCw,
  FileText,
  DollarSign,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const LiveContractAnalysisDemo = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisStage, setAnalysisStage] = useState<string>("ready");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analysisStages = [
    {
      id: "upload",
      name: "Document Upload",
      description: "Receiving and validating contract file",
    },
    {
      id: "extraction",
      name: "Text Extraction",
      description: "OCR and content extraction from PDF/Word",
    },
    {
      id: "structure",
      name: "Structure Analysis",
      description: "Identifying sections, clauses, and metadata",
    },
    {
      id: "entities",
      name: "Entity Recognition",
      description: "Extracting parties, dates, amounts, and terms",
    },
    {
      id: "clauses",
      name: "Clause Classification",
      description: "Categorizing and analyzing contract clauses",
    },
    {
      id: "risk",
      name: "Risk Assessment",
      description: "Identifying potential risks and compliance issues",
    },
    {
      id: "financial",
      name: "Financial Analysis",
      description: "Extracting payment terms and financial data",
    },
    {
      id: "complete",
      name: "Analysis Complete",
      description: "Generating final artifacts and insights",
    },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setAnalysisStage("ready");
      setAnalysisProgress(0);
      setAnalysisResults(null);
    }
  };

  const monitorProcessingStatus = async (contractId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await fetch(
          `/api/processing-status?contractId=${contractId}`
        );
        if (statusResponse.ok) {
          const status = await statusResponse.json();

          // Update progress based on processing status
          if (status.currentStage) {
            const stageIndex = analysisStages.findIndex(
              (s) => s.id === status.currentStage
            );
            if (stageIndex >= 0) {
              setAnalysisStage(status.currentStage);
              setAnalysisProgress(
                (stageIndex / (analysisStages.length - 1)) * 100
              );
            }
          }

          if (status.status === "completed") {
            // Get final results
            const resultsResponse = await fetch(`/api/contracts/${contractId}`);
            if (resultsResponse.ok) {
              const results = await resultsResponse.json();
              setAnalysisResults(transformApiResults(results));
            }
            break;
          } else if (status.status === "failed") {
            throw new Error("Processing failed");
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 5000)); // Check every 5 seconds
        attempts++;
      } catch (error) {
        console.error("Status check failed:", error);
        break;
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error("Processing timeout");
    }
  };

  const simulateAnalysisProcess = async () => {
    for (let i = 0; i < analysisStages.length; i++) {
      setAnalysisStage(analysisStages[i].id);
      setAnalysisProgress((i / (analysisStages.length - 1)) * 100);

      // Simulate processing time for each stage (faster for better UX)
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  };

  const transformApiResults = (apiResults: any) => {
    // Transform API results to match the expected format
    const financial = apiResults.financial || {};

    return {
      metadata: {
        contractType:
          apiResults.metadata?.contractType ||
          "Professional Services Agreement",
        parties: apiResults.metadata?.parties || ["Client", "Service Provider"],
        effectiveDate:
          apiResults.metadata?.effectiveDate ||
          new Date().toISOString().split("T")[0],
        expirationDate:
          apiResults.metadata?.expirationDate ||
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        totalValue: financial.totalValue
          ? `$${financial.totalValue.toLocaleString()}`
          : "$0",
        currency: financial.currency || "USD",
      },
      clauses: apiResults.clauses || {
        total: 0,
        categories: [],
      },
      risk: apiResults.risk || {
        overallScore: 0,
        level: "Unknown",
        factors: [],
      },
      compliance: apiResults.compliance || {
        score: 0,
        checks: [],
      },
      financial: {
        totalValue: financial.totalValue || 0,
        paymentTerms: financial.paymentTerms || "Unknown",
        currency: financial.currency || "USD",
        milestones:
          financial.extractedTables?.filter(
            (t: any) => t.type === "payment_schedule"
          ).length || 0,
        penalties: Array.isArray(financial.penalties)
          ? financial.penalties.join(", ")
          : financial.penalties || "None specified",
        extractedTables: financial.extractedTables || [],
        rateCards: financial.rateCards || [],
      },
    };
  };

  const startAnalysis = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // Upload the file to our API
      const formData = new FormData();
      formData.append("file", uploadedFile);

      // Start with upload stage
      setAnalysisStage("upload");
      setAnalysisProgress(10);

      const uploadResponse = await fetch("/api/contracts/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse
          .json()
          .catch(() => ({ error: "Upload failed" }));
        console.error("Upload error:", errorData);
        throw new Error(
          errorData.error || errorData.details || "Upload failed"
        );
      }

      const uploadResult = await uploadResponse.json();
      console.log("Upload result:", uploadResult);

      if (!uploadResult.success || !uploadResult.contractId) {
        throw new Error("Upload succeeded but no contract ID returned");
      }

      const contractId = uploadResult.contractId;
      console.log("Contract uploaded successfully:", contractId);

      // Since artifacts are created immediately, simulate the analysis stages
      // and then fetch the results
      await simulateAnalysisProcess();

      // Fetch the contract with artifacts using the [id] route
      try {
        const contractResponse = await fetch(`/api/contracts/${contractId}`);
        if (!contractResponse.ok) {
          const errorData = await contractResponse
            .json()
            .catch(() => ({ error: "Failed to fetch contract" }));
          console.error("Contract fetch error:", errorData);
          throw new Error("Failed to load contract results");
        }

        const contractData = await contractResponse.json();
        console.log("✅ Contract data fetched:", contractData);
        console.log("📊 Financial data:", contractData.financial);
        console.log("📋 Metadata:", contractData.metadata);
        console.log("⚠️ Risk:", contractData.risk);
        console.log("✓ Compliance:", contractData.compliance);
        console.log("📄 Clauses:", contractData.clauses);

        // The existing endpoint returns a complex format, use it directly
        const results = {
          metadata: contractData.metadata || {
            contractType: contractData.filename || "Contract",
            parties: [
              contractData.metadata?.clientName || "Client",
              contractData.metadata?.supplierName || "Supplier",
            ],
            effectiveDate:
              contractData.metadata?.startDate || new Date().toISOString(),
            expirationDate:
              contractData.metadata?.endDate || new Date().toISOString(),
            totalValue:
              contractData.financial?.totalValue ||
              contractData.metadata?.totalValue ||
              0,
            currency: contractData.financial?.currency || "USD",
          },
          financial: contractData.financial || {},
          clauses: contractData.clauses || { total: 0, categories: [] },
          risk: contractData.risk || {
            overallScore: 0,
            level: "Low",
            factors: [],
          },
          compliance: contractData.compliance || { score: 0, checks: [] },
        };
        console.log("🎯 Setting analysis results:", results);
        setAnalysisResults(results);
      } catch (err) {
        console.error("Failed to fetch contract results:", err);
        throw err;
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisStage("complete");
      setAnalysisProgress(0);
      setIsAnalyzing(false);
      alert(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`
      );
      return;
    }

    // Mark analysis as complete
    setAnalysisStage("complete");
    setAnalysisProgress(100);
    setIsAnalyzing(false);
  };

  const resetDemo = () => {
    setUploadedFile(null);
    setAnalysisStage("ready");
    setAnalysisProgress(0);
    setAnalysisResults(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      {/* Simplified Upload Section */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border border-blue-200">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="w-10 h-10 text-blue-600" />
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                AI Contract Analysis Demo
              </h3>
              <p className="text-gray-600">
                See how AI transforms 40 hours of work into 60 seconds
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-white rounded-lg border border-blue-200">
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">40 Hours</div>
                <div className="text-xs text-red-600">Manual Process</div>
              </div>
              <div className="text-2xl text-gray-400">→</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  60 Seconds
                </div>
                <div className="text-xs text-green-600">AI Analysis</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <a
                href="/sample-sow-contract.pdf"
                download="sample-sow-contract.pdf"
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                📄 Download Sample $750K SOW Contract
              </a>
              <span className="mx-2">•</span>
              <span>Upload below to see AI analysis</span>
            </div>
          </div>

          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="contract-upload"
          />
          <label
            htmlFor="contract-upload"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors text-lg font-medium"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload Contract for AI Analysis
          </label>

          {uploadedFile && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-800 font-medium">
                ✅ {uploadedFile.name} ready for analysis
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Controls */}
      {uploadedFile && !isAnalyzing && !analysisResults && (
        <div className="text-center">
          <Button
            onClick={startAnalysis}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
          >
            <Zap className="w-5 h-5 mr-2" />
            Start AI Analysis
          </Button>
        </div>
      )}

      {/* Analysis Progress */}
      {isAnalyzing && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              AI Analysis in Progress
            </h3>
            <Badge className="bg-blue-100 text-blue-800">
              {Math.round(analysisProgress)}% Complete
            </Badge>
          </div>

          <Progress value={analysisProgress} className="h-3 mb-6" />

          <div className="space-y-3">
            {analysisStages.map((stage, index) => {
              const isActive = stage.id === analysisStage;
              const isComplete =
                analysisStages.findIndex((s) => s.id === analysisStage) > index;

              return (
                <div
                  key={stage.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-50 border border-blue-200"
                      : isComplete
                      ? "bg-green-50 border border-green-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : isComplete
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isActive ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`font-medium ${
                        isActive
                          ? "text-blue-900"
                          : isComplete
                          ? "text-green-900"
                          : "text-gray-700"
                      }`}
                    >
                      {stage.name}
                    </h4>
                    <p
                      className={`text-sm ${
                        isActive
                          ? "text-blue-700"
                          : isComplete
                          ? "text-green-700"
                          : "text-gray-500"
                      }`}
                    >
                      {stage.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="animate-pulse">
                      <Brain className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Analysis Complete!
            </h3>
            <Button onClick={resetDemo} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Another Contract
            </Button>
          </div>

          {/* Results Tabs - Same as Pilot Demo */}
          <Tabs defaultValue="financial" className="w-full">
            <TabsList className="grid w-full grid-cols-6 gap-2">
              <TabsTrigger value="financial" className="text-sm">
                💵 Financial
              </TabsTrigger>
              <TabsTrigger value="savings" className="text-sm">
                💰 Savings
              </TabsTrigger>
              <TabsTrigger value="rates" className="text-sm">
                📊 Rates
              </TabsTrigger>
              <TabsTrigger value="renewal" className="text-sm">
                📅 Renewal
              </TabsTrigger>
              <TabsTrigger value="compliance" className="text-sm">
                ✅ Compliance
              </TabsTrigger>
              <TabsTrigger value="risk" className="text-sm">
                ⚠️ Risk
              </TabsTrigger>
            </TabsList>

            {/* Financial Analysis Tab */}
            <TabsContent value="financial" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    Financial Analysis
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Comprehensive breakdown of contract financials and payment
                    terms
                  </p>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-900">
                          {analysisResults.financial?.totalValue?.toLocaleString() ||
                            "$750,000"}
                        </div>
                        <div className="text-sm text-green-700">
                          Total Contract Value
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <FileText className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-blue-900">
                          {analysisResults.financial?.milestones || 4}
                        </div>
                        <div className="text-sm text-blue-700">
                          Payment Milestones
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-4 text-center">
                        <Award className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-purple-900">
                          $
                          {analysisResults.financial?.potentialSavings?.toLocaleString() ||
                            "41,600"}
                        </div>
                        <div className="text-sm text-purple-700">
                          Potential Savings
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="p-4 text-center">
                        <Clock className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-orange-900">
                          Net {analysisResults.financial?.netPaymentTerms || 30}
                        </div>
                        <div className="text-sm text-orange-700">
                          Payment Terms
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payment Schedule Table */}
                  {analysisResults.financial?.extractedTables?.[0] && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        📅 Payment Schedule
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border p-3 text-left">
                                Milestone
                              </th>
                              <th className="border p-3 text-left">
                                Percentage
                              </th>
                              <th className="border p-3 text-left">Amount</th>
                              <th className="border p-3 text-left">Due Date</th>
                              <th className="border p-3 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisResults.financial.extractedTables[0].rows?.map(
                              (row: any, idx: number) => (
                                <tr
                                  key={idx}
                                  className={
                                    row.status === "Paid" ? "bg-green-50" : ""
                                  }
                                >
                                  <td className="border p-3">
                                    {row.milestone}
                                  </td>
                                  <td className="border p-3">
                                    {row.percentage}
                                  </td>
                                  <td className="border p-3 font-semibold">
                                    {row.amount}
                                  </td>
                                  <td className="border p-3">{row.dueDate}</td>
                                  <td className="border p-3">
                                    <Badge
                                      className={
                                        row.status === "Paid"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-blue-100 text-blue-800"
                                      }
                                    >
                                      {row.status}
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Expense Breakdown */}
                  {analysisResults.financial?.extractedTables?.[1] && (
                    <div>
                      <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                        📊 Expense Breakdown
                      </h4>
                      <div className="space-y-3">
                        {analysisResults.financial.extractedTables[1].rows?.map(
                          (row: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="font-medium">
                                    {row.category}
                                  </span>
                                  <span className="text-gray-600">
                                    {row.budgetAmount} ({row.percentage})
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: row.percentage }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other tabs with placeholder content - to be filled from artifacts */}
            <TabsContent value="savings" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-4">
                    💰 Savings Opportunities
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Total Potential Savings:{" "}
                    <span className="text-green-600 font-bold text-2xl">
                      $322,500
                    </span>
                  </p>
                  <div className="space-y-4">
                    {[
                      {
                        title: "Rate Optimization",
                        savings: 125000,
                        confidence: 85,
                        effort: "Medium",
                        timeframe: "3-6 months",
                      },
                      {
                        title: "Volume Bundling",
                        savings: 112500,
                        confidence: 90,
                        effort: "Low",
                        timeframe: "1-3 months",
                      },
                      {
                        title: "Supplier Consolidation",
                        savings: 85000,
                        confidence: 75,
                        effort: "High",
                        timeframe: "6-12 months",
                      },
                    ].map((opp, idx) => (
                      <Card key={idx} className="border-l-4 border-green-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-lg">
                              {opp.title}
                            </h4>
                            <Badge className="bg-green-100 text-green-800">
                              ${opp.savings.toLocaleString()}/year
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm text-gray-600">
                            <div>Confidence: {opp.confidence}%</div>
                            <div>Effort: {opp.effort}</div>
                            <div>Timeframe: {opp.timeframe}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rates" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-4">
                    📊 Rate Benchmarking
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Annual Savings Opportunity:{" "}
                    <span className="text-green-600 font-bold">$62,400</span>
                  </p>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-3 text-left">Role</th>
                        <th className="border p-3">Your Rate</th>
                        <th className="border p-3">Market Rate</th>
                        <th className="border p-3">Variance</th>
                        <th className="border p-3">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          role: "Senior Consultant",
                          rate: 175,
                          market: 165,
                          variance: "+6.1%",
                          savings: "$20,800",
                        },
                        {
                          role: "Project Manager",
                          rate: 150,
                          market: 145,
                          variance: "+3.4%",
                          savings: "$10,400",
                        },
                        {
                          role: "Technical Architect",
                          rate: 195,
                          market: 185,
                          variance: "+5.4%",
                          savings: "$20,800",
                        },
                      ].map((role, idx) => (
                        <tr key={idx}>
                          <td className="border p-3 font-medium">
                            {role.role}
                          </td>
                          <td className="border p-3 text-center">
                            ${role.rate}/hr
                          </td>
                          <td className="border p-3 text-center">
                            ${role.market}/hr
                          </td>
                          <td className="border p-3 text-center text-red-600 font-semibold">
                            {role.variance}
                          </td>
                          <td className="border p-3 text-center text-green-600 font-semibold">
                            {role.savings}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="renewal" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-4">📅 Renewal Radar</h3>
                  <div className="space-y-4">
                    <Card className="bg-blue-50">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600 mb-1">
                          Contract End Date
                        </div>
                        <div className="text-2xl font-bold">2024-12-31</div>
                        <div className="text-sm text-blue-600 mt-2">
                          365 days until expiration • Low urgency
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                      <CardContent className="p-4">
                        <div className="font-semibold mb-2">
                          💡 Recommendation
                        </div>
                        <p className="text-gray-700">
                          Begin renewal negotiations 90 days before expiration
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="p-4">
                        <div className="font-semibold mb-2">
                          💰 Estimated Savings
                        </div>
                        <p className="text-2xl font-bold text-purple-600">
                          $125,000
                        </p>
                        <p className="text-sm text-gray-600">
                          Potential savings at renewal
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compliance" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-4">✅ ESG Compliance</h3>
                  <div className="mb-6">
                    <div className="text-center mb-4">
                      <div className="text-5xl font-bold text-green-600">
                        87
                      </div>
                      <div className="text-gray-600">
                        Overall Compliance Score
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: "GDPR", score: 95, status: "Compliant" },
                      { name: "SOX", score: 88, status: "Compliant" },
                      { name: "ISO 27001", score: 92, status: "Compliant" },
                    ].map((reg, idx) => (
                      <Card key={idx} className="border-l-4 border-green-500">
                        <CardContent className="p-4 flex justify-between items-center">
                          <div>
                            <div className="font-semibold">{reg.name}</div>
                            <div className="text-sm text-gray-600">
                              {reg.status}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {reg.score}%
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-4">
                    ⚠️ Risk Assessment
                  </h3>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold">
                        Overall Risk Score
                      </span>
                      <Badge className="bg-yellow-100 text-yellow-800 text-lg px-4 py-1">
                        Medium Risk
                      </Badge>
                    </div>
                    <div className="text-4xl font-bold text-orange-600 text-center my-4">
                      67/100
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        type: "Liability Cap",
                        severity: "High",
                        description: "Limited liability clauses need review",
                      },
                      {
                        type: "Auto-Renewal",
                        severity: "Medium",
                        description: "Automatic renewal with 90-day notice",
                      },
                      {
                        type: "Termination",
                        severity: "Low",
                        description: "Standard termination clauses",
                      },
                    ].map((risk, idx) => (
                      <Card
                        key={idx}
                        className={`border-l-4 ${
                          risk.severity === "High"
                            ? "border-red-500"
                            : risk.severity === "Medium"
                            ? "border-orange-500"
                            : "border-yellow-500"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-semibold">{risk.type}</div>
                            <Badge
                              className={
                                risk.severity === "High"
                                  ? "bg-red-100 text-red-800"
                                  : risk.severity === "Medium"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {risk.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {risk.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};
