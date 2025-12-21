"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Calendar,
  DollarSign,
  Building,
  ArrowRight,
  Download,
  Star,
  Shield,
  Sparkles,
  X,
  Plus,
  Settings,
  Save,
} from "lucide-react";
import Link from "next/link";

// Mock advanced search data (client-side)
const advancedSearchData = {
  contractTypes: [
    "Master Service Agreement",
    "Statement of Work",
    "Software License",
    "Consulting Agreement",
    "Support & Maintenance",
    "Data Processing Agreement",
    "Non-Disclosure Agreement",
  ],
  clients: [
    "TechCorp Solutions",
    "CloudServices Inc",
    "DataPro Systems",
    "ConsultingPro LLC",
    "InfraTech Partners",
    "AnalyticsCorp",
    "SecureCloud Ltd",
  ],
  suppliers: [
    "Your Company",
    "Partner Solutions",
    "Service Provider Inc",
    "Tech Vendor LLC",
    "Consulting Partners",
  ],
  tags: [
    "high-value",
    "auto-renewal",
    "liability-cap",
    "data-processing",
    "ip-ownership",
    "sla-requirements",
    "payment-terms",
    "termination-rights",
    "compliance",
    "gdpr",
    "hipaa",
    "sox",
  ],
  savedSearches: [
    {
      name: "High Value Active Contracts",
      query: "value > $1M AND status = Active",
      lastUsed: "2024-01-20",
      results: 234,
    },
    {
      name: "Expiring MSAs",
      query: "type = MSA AND expires < 90 days",
      lastUsed: "2024-01-18",
      results: 12,
    },
    {
      name: "GDPR Compliance Review",
      query: "tags contains gdpr AND compliance < 95%",
      lastUsed: "2024-01-15",
      results: 8,
    },
  ],
};

export default function AdvancedSearchClient() {
  const [searchCriteria, setSearchCriteria] = React.useState({
    keywords: "",
    contractType: "",
    client: "",
    supplier: "",
    valueMin: "",
    valueMax: "",
    dateFrom: "",
    dateTo: "",
    expiryFrom: "",
    expiryTo: "",
    status: "",
    riskScoreMin: "",
    riskScoreMax: "",
    complianceMin: "",
    tags: [] as string[],
    customFields: [{ field: "", operator: "", value: "" }],
  });

  const [showResults, setShowResults] = React.useState(false);

  const handleSearch = () => {
    setShowResults(true);
  };

  const addCustomField = () => {
    setSearchCriteria((prev) => ({
      ...prev,
      customFields: [
        ...prev.customFields,
        { field: "", operator: "", value: "" },
      ],
    }));
  };

  const removeCustomField = (index: number) => {
    setSearchCriteria((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index),
    }));
  };

  const addTag = (tag: string) => {
    if (!searchCriteria.tags.includes(tag)) {
      setSearchCriteria((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
  };

  const removeTag = (tag: string) => {
    setSearchCriteria((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link href="/search" className="hover:text-gray-700">
              Search
            </Link>
            <span>/</span>
            <span className="text-gray-900">Advanced Search</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">
            Advanced Contract Search
          </h1>
          <p className="text-gray-600 mt-1">
            Use detailed filters to find exactly what you&apos;re looking for
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save Search
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Filters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Basic Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                <input
                  id="keywords"
                  type="text"
                  placeholder="Search contract content, terms, clauses..."
                  value={searchCriteria.keywords}
                  onChange={(e) =>
                    setSearchCriteria((prev) => ({
                      ...prev,
                      keywords: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contractType" className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Type
                  </label>
                  <select
                    id="contractType"
                    value={searchCriteria.contractType}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        contractType: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Types</option>
                    {advancedSearchData.contractTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={searchCriteria.status}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="draft">Draft</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parties */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5 text-green-600" />
                Parties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client
                  </label>
                  <select
                    value={searchCriteria.client}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        client: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Clients</option>
                    {advancedSearchData.clients.map((client) => (
                      <option key={client} value={client}>
                        {client}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier
                  </label>
                  <select
                    value={searchCriteria.supplier}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        supplier: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Suppliers</option>
                    {advancedSearchData.suppliers.map((supplier) => (
                      <option key={supplier} value={supplier}>
                        {supplier}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-yellow-600" />
                Financial Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Value Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Min value"
                    value={searchCriteria.valueMin}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        valueMin: e.target.value,
                      }))
                    }
                    aria-label="Minimum contract value"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    placeholder="Max value"
                    value={searchCriteria.valueMax}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        valueMax: e.target.value,
                      }))
                    }
                    aria-label="Maximum contract value"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Date Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={searchCriteria.dateFrom}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        dateFrom: e.target.value,
                      }))
                    }
                    aria-label="Upload date from"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={searchCriteria.dateTo}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        dateTo: e.target.value,
                      }))
                    }
                    aria-label="Upload date to"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={searchCriteria.expiryFrom}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        expiryFrom: e.target.value,
                      }))
                    }
                    aria-label="Expiry date from"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={searchCriteria.expiryTo}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        expiryTo: e.target.value,
                      }))
                    }
                    aria-label="Expiry date to"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk & Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Risk & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Score Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Min risk score"
                    min="0"
                    max="100"
                    value={searchCriteria.riskScoreMin}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        riskScoreMin: e.target.value,
                      }))
                    }
                    aria-label="Minimum risk score"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    placeholder="Max risk score"
                    min="0"
                    max="100"
                    value={searchCriteria.riskScoreMax}
                    onChange={(e) =>
                      setSearchCriteria((prev) => ({
                        ...prev,
                        riskScoreMax: e.target.value,
                      }))
                    }
                    aria-label="Maximum risk score"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="complianceMin" className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Compliance Score
                </label>
                <input
                  id="complianceMin"
                  type="number"
                  placeholder="Minimum compliance %"
                  min="0"
                  max="100"
                  value={searchCriteria.complianceMin}
                  onChange={(e) =>
                    setSearchCriteria((prev) => ({
                      ...prev,
                      complianceMin: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-orange-600" />
                Tags & Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {advancedSearchData.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {searchCriteria.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {searchCriteria.tags.map((tag) => (
                      <Badge key={tag} className="flex items-center gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                Custom Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {searchCriteria.customFields.map((field, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Field name"
                      value={field.field}
                      onChange={(e) => {
                        const newFields = [...searchCriteria.customFields];
                        const currentField = newFields[index];
                        if (currentField) {
                          currentField.field = e.target.value;
                        }
                        setSearchCriteria((prev) => ({
                          ...prev,
                          customFields: newFields,
                        }));
                      }}
                      aria-label={`Custom field ${index + 1} name`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={field.operator}
                      onChange={(e) => {
                        const newFields = [...searchCriteria.customFields];
                        const currentField = newFields[index];
                        if (currentField) {
                          currentField.operator = e.target.value;
                        }
                        setSearchCriteria((prev) => ({
                          ...prev,
                          customFields: newFields,
                        }));
                      }}
                      aria-label={`Custom field ${index + 1} operator`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Operator</option>
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater">Greater than</option>
                      <option value="less">Less than</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const newFields = [...searchCriteria.customFields];
                        const currentField = newFields[index];
                        if (currentField) {
                          currentField.value = e.target.value;
                        }
                        setSearchCriteria((prev) => ({
                          ...prev,
                          customFields: newFields,
                        }));
                      }}
                      aria-label={`Custom field ${index + 1} value`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomField(index)}
                      className="p-2"
                      aria-label={`Remove custom field ${index + 1}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addCustomField}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Criteria
              </Button>
            </CardContent>
          </Card>

          {/* Search Actions */}
          <div className="flex gap-4">
            <Button onClick={handleSearch} size="lg" className="flex-1">
              <Sparkles className="w-5 h-5 mr-2" />
              Search Contracts
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setSearchCriteria({
                  keywords: "",
                  contractType: "",
                  client: "",
                  supplier: "",
                  valueMin: "",
                  valueMax: "",
                  dateFrom: "",
                  dateTo: "",
                  expiryFrom: "",
                  expiryTo: "",
                  status: "",
                  riskScoreMin: "",
                  riskScoreMax: "",
                  complianceMin: "",
                  tags: [],
                  customFields: [{ field: "", operator: "", value: "" }],
                });
                setShowResults(false);
              }}
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Saved Searches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="w-5 h-5 text-blue-600" />
                Saved Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {advancedSearchData.savedSearches.map((search, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {search.name}
                    </h4>
                    <p className="text-xs text-gray-600 mb-2">{search.query}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Last used: {search.lastUsed}</span>
                      <span>{search.results} results</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Search Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Search Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>Use quotes for exact phrase matching</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>Combine multiple filters for precise results</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>Save frequently used searches for quick access</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <span>Use date ranges to find contracts by timeline</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Advanced search executed
              </h3>
              <p className="text-gray-600 mb-6">
                Your search criteria have been processed. In a real
                implementation, results would appear here.
              </p>
              <Link href="/search">
                <Button>View Sample Results</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
