'use client'
import React, { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Save, FileText } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface RoleRate {
  id: string
  role: string
  level: string
  location: string
  dailyRate: number
  serviceLine: string
}

export default function AddRateCardPage() {
  const router = useRouter()
  const [supplierName, setSupplierName] = useState('')
  const [clientName, setClientName] = useState('')
  const [currency, setCurrency] = useState('CHF')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [roles, setRoles] = useState<RoleRate[]>([
    {
      id: '1',
      role: '',
      level: '',
      location: '',
      dailyRate: 0,
      serviceLine: ''
    }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addRole = () => {
    const newRole: RoleRate = {
      id: Date.now().toString(),
      role: '',
      level: '',
      location: '',
      dailyRate: 0,
      serviceLine: ''
    }
    setRoles([...roles, newRole])
  }

  const removeRole = (id: string) => {
    if (roles.length > 1) {
      setRoles(roles.filter(r => r.id !== id))
    }
  }

  const updateRole = (id: string, field: keyof RoleRate, value: string | number) => {
    setRoles(roles.map(role => 
      role.id === id ? { ...role, [field]: value } : role
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!supplierName.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (!clientName.trim()) {
      toast.error('Client name is required')
      return
    }
    const validRoles = roles.filter(role => 
      role.role && role.level && role.location && role.dailyRate > 0
    )
    if (validRoles.length === 0) {
      toast.error('At least one complete role is required')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const rateCardData = {
        supplierName,
        clientName,
        currency,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        roles: validRoles
      }

      const response = await fetch('/api/rate-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rateCardData)
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create rate card')
      }

      toast.success('Rate card created successfully!')
      router.push('/rate-cards')
    } catch (error: unknown) {
      toast.error('Failed to create rate card', {
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const commonRoles = [
    'Software Engineer', 'Data Analyst', 'Project Manager', 'Business Analyst',
    'DevOps Engineer', 'UX Designer', 'Product Manager', 'Scrum Master'
  ]

  const commonLevels = [
    'Junior', 'Mid-level', 'Senior', 'Lead', 'Principal', 'Manager', 'Director'
  ]

  const commonLocations = [
    'Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Remote', 'Hybrid'
  ]

  const commonServiceLines = [
    'Software Development', 'Data & Analytics', 'Project Management', 
    'Business Analysis', 'Infrastructure', 'Design', 'Strategy'
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/rate-cards">
            <button className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Rate Cards
            </button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Add New Rate Card
              </h1>
              <p className="text-slate-600 mt-1">
                Create a new rate card with supplier rates
              </p>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="supplierName" className="block text-sm font-medium text-slate-700 mb-2">
                    Supplier Name *
                  </label>
                  <input
                    id="supplierName"
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="e.g., TechStaff Solutions"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 mb-2">
                    Client Name
                  </label>
                  <input
                    id="clientName"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="e.g., SwissBank AG"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-slate-700 mb-2">
                    Currency
                  </label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="validFrom" className="block text-sm font-medium text-slate-700 mb-2">
                    Valid From
                  </label>
                  <input
                    id="validFrom"
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="validTo" className="block text-sm font-medium text-slate-700 mb-2">
                    Valid To
                  </label>
                  <input
                    id="validTo"
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Roles and Rates */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Roles and Rates</h2>
              <button
                type="button"
                onClick={addRole}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Role
              </button>
            </div>

            <div className="space-y-4">
              {roles.map((role, index) => (
                <div key={role.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">Role #{index + 1}</h4>
                    {roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRole(role.id)}
                        className="text-red-600 hover:text-red-700"
                        aria-label={`Remove ${role.role || 'role'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor={`role-name-${role.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                      </label>
                      <input
                        id={`role-name-${role.id}`}
                        type="text"
                        value={role.role}
                        onChange={(e) => updateRole(role.id, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Select or type role"
                        list={`roles-${role.id}`}
                        required
                      />
                      <datalist id={`roles-${role.id}`}>
                        {commonRoles.map(r => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label htmlFor={`role-level-${role.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        Level *
                      </label>
                      <input
                        id={`role-level-${role.id}`}
                        type="text"
                        value={role.level}
                        onChange={(e) => updateRole(role.id, 'level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Select or type level"
                        list={`levels-${role.id}`}
                        required
                      />
                      <datalist id={`levels-${role.id}`}>
                        {commonLevels.map(l => (
                          <option key={l} value={l} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label htmlFor={`role-location-${role.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        Location *
                      </label>
                      <input
                        id={`role-location-${role.id}`}
                        type="text"
                        value={role.location}
                        onChange={(e) => updateRole(role.id, 'location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Select or type location"
                        list={`locations-${role.id}`}
                        required
                      />
                      <datalist id={`locations-${role.id}`}>
                        {commonLocations.map(l => (
                          <option key={l} value={l} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label htmlFor={`role-rate-${role.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        Daily Rate ({currency}) *
                      </label>
                      <input
                        id={`role-rate-${role.id}`}
                        type="number"
                        value={role.dailyRate || ''}
                        onChange={(e) => updateRole(role.id, 'dailyRate', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 1200"
                        min="0"
                        step="50"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor={`role-service-${role.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        Service Line
                      </label>
                      <input
                        id={`role-service-${role.id}`}
                        type="text"
                        value={role.serviceLine}
                        onChange={(e) => updateRole(role.id, 'serviceLine', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Select or type service line"
                        list={`services-${role.id}`}
                      />
                      <datalist id={`services-${role.id}`}>
                        {commonServiceLines.map(s => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Link href="/rate-cards">
              <button type="button" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Rate Card
                </>
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Tips for Adding Rate Cards</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use consistent role and level naming for better benchmarking</li>
            <li>• Add multiple roles in one rate card for the same supplier</li>
            <li>• Set validity dates to track rate changes over time</li>
            <li>• For bulk imports, use the Excel/CSV import feature instead</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
