"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { User, Settings, LogOut, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import IntelligentSearch from "./search/IntelligentSearch"
import IntelligenceNotifications from "./notifications/IntelligenceNotifications"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { signOut } from "next-auth/react"

export function Topbar() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  const userInitials = session?.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 sticky top-0 z-20">
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-xl bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
          ConTigo
        </h1>
      </div>
      <div className="flex flex-1 items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial max-w-md">
          <IntelligentSearch />
        </div>
        <IntelligenceNotifications />
        
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || 'User'} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xs font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-slate-900 truncate">
                {session?.user?.name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {session?.user?.email || ''}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
