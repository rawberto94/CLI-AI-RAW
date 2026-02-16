"use client"

import * as React from "react"
import Link from "next/link"
import {
  Eye,
  Download,
  CheckCircle2,
  XCircle,
  Hourglass,
  FileClock,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { API_BASE_URL } from "../../lib/config"
import { tenantHeaders } from "../../lib/tenant"

type Contract = {
  id: string
  name: string
  status: "UPLOADED" | "INGESTED" | "PROCESSING" | "COMPLETED" | "FAILED"
  createdAt: string
  updatedAt: string
  supplier?: string
}

const StatusIcon = ({ status }: { status: Contract["status"] }) => {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />
    case "FAILED":
      return <XCircle className="w-5 h-5 text-red-500" />
    case "PROCESSING":
      return <Hourglass className="w-5 h-5 text-violet-500 animate-spin" />
    default:
      return <FileClock className="w-5 h-5 text-gray-500" />
  }
}

const getRiskColor = () => {
  const colors = ["bg-green-500", "bg-yellow-500", "bg-red-500"]
  return colors[Math.floor(Math.random() * colors.length)]
}

const getRiskTextColor = () => {
  const colors = [
    "text-green-600 dark:text-green-400",
    "text-yellow-600 dark:text-yellow-400",
    "text-red-600 dark:text-red-400",
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

const getRiskLevel = () => {
  const levels = ["Low", "Medium", "High"]
  return levels[Math.floor(Math.random() * levels.length)]
}

const getContractValue = (supplier?: string) => {
  // Realistic contract values for demo
  const values: Record<string, number> = {
    "Deloitte": 850000,
    "Ernst & Young": 720000,
    "KPMG": 650000,
    "PricewaterhouseCoopers": 780000,
    "Accenture": 920000
  }
  return values[supplier || ""] || Math.floor(Math.random() * 500000) + 200000
}

// Demo data for when API is not available
const demoContracts: Contract[] = [
  {
    id: "deloitte-sow-2024",
    name: "Deloitte-SOW-2024.pdf",
    status: "COMPLETED",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
    supplier: "Deloitte"
  },
  {
    id: "ey-msa-2024",
    name: "EY-MSA-2024.pdf", 
    status: "COMPLETED",
    createdAt: "2024-01-14T14:00:00Z",
    updatedAt: "2024-01-14T14:45:00Z",
    supplier: "Ernst & Young"
  },
  {
    id: "kpmg-sow-q1",
    name: "KPMG-SOW-Q1.pdf",
    status: "PROCESSING",
    createdAt: "2024-01-13T09:00:00Z",
    updatedAt: "2024-01-13T09:15:00Z",
    supplier: "KPMG"
  },
  {
    id: "pwc-agreement",
    name: "PwC-Agreement.pdf",
    status: "COMPLETED",
    createdAt: "2024-01-12T16:00:00Z",
    updatedAt: "2024-01-12T16:20:00Z",
    supplier: "PricewaterhouseCoopers"
  },
  {
    id: "accenture-contract",
    name: "Accenture-Contract.pdf",
    status: "INGESTED",
    createdAt: "2024-01-11T11:00:00Z",
    updatedAt: "2024-01-11T11:05:00Z",
    supplier: "Accenture"
  }
]

export function RecentContracts() {
  const [contracts, setContracts] = React.useState<Contract[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  async function fetchContracts() {
    try {
      const res = await fetch('/api/contracts')
      if (res.ok) {
        const data = await res.json()
        const payload = data.data ?? data
        const items = Array.isArray(payload) ? payload : (payload?.items || [])
        setContracts(items)
        setIsLoading(false)
      } else {
        // API not available, use demo data
        setContracts(demoContracts)
        setIsLoading(false)
      }
    } catch (e) {
      // API not available, use demo data
      setContracts(demoContracts)
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    fetchContracts()
    // Don't poll if using demo data
    const id = setInterval(() => {
      if (contracts !== demoContracts) {
        fetchContracts()
      }
    }, 5000)
    return () => clearInterval(id)
  }, [contracts])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Contracts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk Score</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length > 0 ? (
              contracts.slice(0, 5).map(contract => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <div className="font-medium">{contract.name}</div>
                    <div className="text-sm text-muted-foreground">
                      #{contract.id}
                    </div>
                  </TableCell>
                  <TableCell>{contract.supplier || "Unknown"}</TableCell>
                  <TableCell>
                    ${getContractValue(contract.supplier).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <StatusIcon status={contract.status} />
                      <span>{contract.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getRiskColor()}`}
                          style={{ inlineSize: `${Math.random() * 100}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs font-medium ${getRiskTextColor()}`}>
                        {getRiskLevel()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(contract.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="p-2 rounded-md hover:bg-muted"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button className="p-2 rounded-md hover:bg-muted">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No contracts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
