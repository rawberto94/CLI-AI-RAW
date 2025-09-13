"use client"

import { Bell, Search, User } from "lucide-react"
import { Button } from "./ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"

function getSavedTenant() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('x-tenant-id') || ''
}

function setSavedTenant(tid: string) {
  try {
    if (typeof window !== 'undefined') localStorage.setItem('x-tenant-id', tid)
  } catch {}
}

export function Topbar() {
  const [tenant, setTenant] = useState<string>('')
  useEffect(() => {
    setTenant(getSavedTenant())
  }, [])

  const onTenantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim()
    setTenant(v)
    setSavedTenant(v)
  }
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-2xl">Procurement CLM</h1>
        <p className="text-xs text-muted-foreground">Env: staging</p>
      </div>
      <div className="flex flex-1 items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <form className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search contracts, clauses..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px] bg-background"
            />
          </div>
        </form>
        <div className="hidden md:flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Tenant</label>
          <input value={tenant} onChange={onTenantChange} placeholder="acme-dev" className="h-8 w-36 px-2 border rounded bg-background text-sm" />
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>
            <User />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
