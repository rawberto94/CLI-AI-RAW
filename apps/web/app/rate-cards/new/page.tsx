'use client'
import React, { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    setIsSubmitting(true)
    
    try {
      const rateCardData = {
        supplierName,
        clientName,
        currency,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        roles: roles.filter(role => 
          role.role && role.level && role.location && role.dailyRate > 0
        )
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

      alert('Rate card created successfully!')
      router.push('/rate-cards')
    } catch (error) {
      console.error('Error creating rate card:', error)
      alert('Error creating rate card. Please try again.')
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/rate-cards">
            <button className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" />
              Back to Rate Cards
            </button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Add New Rate Card</h1>
          <p className="text-gray-600 mt-1">
            Create a new rate card with supplier rates
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., TechStaff Solutions"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., SwissBank AG"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valid To
                  </label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Roles and Rates */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                      </label>
                      <input
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Level *
                      </label>
                      <input
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location *
                      </label>
                      <input
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Daily Rate ({currency}) *
                      </label>
                      <input
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Line
                      </label>
                      <input
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
          </div>

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
