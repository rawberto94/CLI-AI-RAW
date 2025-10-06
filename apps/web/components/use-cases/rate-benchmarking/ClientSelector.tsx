'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Search, Building2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { type Client } from '@/lib/use-cases/multi-client-rate-data'
import { formatCHF } from '@/lib/use-cases/rate-normalizer'

interface ClientSelectorProps {
  clients: Client[]
  selectedClientId: string | null
  onClientChange: (clientId: string | null) => void
  allowAll?: boolean
  showStats?: boolean
  className?: string
}

export function ClientSelector({
  clients,
  selectedClientId,
  onClientChange,
  allowAll = true,
  showStats = true,
  className = ''
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  )

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients

    const query = searchQuery.toLowerCase()
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        c.industry.toLowerCase().includes(query) ||
        c.region.toLowerCase().includes(query) ||
        c.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }, [clients, searchQuery])

  const handleSelect = (clientId: string | null) => {
    onClientChange(clientId)
    setOpen(false)
    setSearchQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between min-w-[280px] h-auto py-3 ${className}`}
        >
          <div className="flex items-center gap-3 flex-1 text-left">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              {selectedClient ? (
                <>
                  <div className="font-semibold text-gray-900 truncate">
                    {selectedClient.name}
                  </div>
                  {showStats && (
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span>{selectedClient.rateCardCount} rate cards</span>
                      <span>•</span>
                      <span>Avg: {formatCHF(selectedClient.averageDailyRateCHF, { decimals: 0 })}/day</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-semibold text-gray-900">
                    {allowAll ? 'All Clients' : 'Select Client'}
                  </div>
                  {showStats && allowAll && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {clients.length} clients • {clients.reduce((sum, c) => sum + c.rateCardCount, 0)} rate cards
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search clients..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem
                  value="all-clients"
                  onSelect={() => handleSelect(null)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 py-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">All Clients</div>
                      <div className="text-xs text-gray-500">
                        View data across all {clients.length} clients
                      </div>
                    </div>
                    {selectedClientId === null && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </CommandItem>
              )}
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => handleSelect(client.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 py-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {client.name}
                        </span>
                        {client.status === 'active' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {client.industry} • {client.region}
                      </div>
                      {showStats && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">{client.rateCardCount}</span> rate cards
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {formatCHF(client.averageDailyRateCHF, { decimals: 0 })}/day avg
                          </span>
                        </div>
                      )}
                    </div>
                    {selectedClientId === client.id && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Multi-select version for comparison
interface MultiClientSelectorProps {
  clients: Client[]
  selectedClientIds: string[]
  onClientIdsChange: (clientIds: string[]) => void
  maxSelection?: number
  className?: string
}

export function MultiClientSelector({
  clients,
  selectedClientIds,
  onClientIdsChange,
  maxSelection = 5,
  className = ''
}: MultiClientSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedClients = useMemo(
    () => clients.filter(c => selectedClientIds.includes(c.id)),
    [clients, selectedClientIds]
  )

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients

    const query = searchQuery.toLowerCase()
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        c.industry.toLowerCase().includes(query) ||
        c.region.toLowerCase().includes(query)
    )
  }, [clients, searchQuery])

  const handleToggle = (clientId: string) => {
    if (selectedClientIds.includes(clientId)) {
      onClientIdsChange(selectedClientIds.filter(id => id !== clientId))
    } else if (selectedClientIds.length < maxSelection) {
      onClientIdsChange([...selectedClientIds, clientId])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between min-w-[280px] h-auto py-3 ${className}`}
        >
          <div className="flex items-center gap-3 flex-1 text-left">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              {selectedClients.length > 0 ? (
                <>
                  <div className="font-semibold text-gray-900">
                    {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''} selected
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {selectedClients.map(c => c.name).join(', ')}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-gray-900">Select Clients</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Choose up to {maxSelection} clients to compare
                  </div>
                </>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search clients..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {filteredClients.map((client) => {
                const isSelected = selectedClientIds.includes(client.id)
                const isDisabled = !isSelected && selectedClientIds.length >= maxSelection

                return (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    onSelect={() => !isDisabled && handleToggle(client.id)}
                    className={`cursor-pointer ${isDisabled ? 'opacity-50' : ''}`}
                    disabled={isDisabled}
                  >
                    <div className="flex items-center gap-3 flex-1 py-2">
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {client.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {client.rateCardCount} rate cards • {formatCHF(client.averageDailyRateCHF, { decimals: 0 })}/day
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
          {selectedClientIds.length >= maxSelection && (
            <div className="border-t p-3 bg-orange-50 text-xs text-orange-700">
              Maximum {maxSelection} clients can be selected for comparison
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
