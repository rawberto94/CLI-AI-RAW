"use client"

import { User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import IntelligentSearch from "./search/IntelligentSearch"
import IntelligenceNotifications from "./notifications/IntelligenceNotifications"

export function Topbar() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
      <div className="flex-1">
        <h1 className="text-lg font-semibold md:text-2xl">Contract Intelligence</h1>
      </div>
      <div className="flex flex-1 items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial max-w-md">
          <IntelligentSearch />
        </div>
        <IntelligenceNotifications />
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
