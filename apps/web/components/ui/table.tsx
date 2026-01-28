"use client"

import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "../../lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    isLoading?: boolean
  }
>(({ className, isLoading, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm",
        isLoading && "opacity-50 pointer-events-none",
        className
      )}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & {
    sticky?: boolean
    top?: number
  }
>(({ className, sticky, top = 0, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn(
      "[&_tr]:border-b dark:[&_tr]:border-slate-700",
      sticky && "sticky bg-white dark:bg-slate-900 z-10",
      className
    )} 
    style={sticky ? { top } : undefined}
    {...props} 
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 data-[state=selected]:bg-violet-50 dark:data-[state=selected]:bg-violet-950/30",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    sortable?: boolean
    sortDirection?: 'asc' | 'desc' | null
    onSort?: () => void
  }
>(({ className, sortable, sortDirection, onSort, children, ...props }, ref) => {
  const content = (
    <>
      {children}
      {sortable && (
        <span className="ml-2 inline-flex">
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" aria-label="Sorted ascending" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown className="h-4 w-4" aria-label="Sorted descending" />
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" aria-label="Sortable" />
          )}
        </span>
      )}
    </>
  )

  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        "h-12 px-4 text-left align-middle font-semibold text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0",
        sortable && "cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-violet-600 dark:hover:text-violet-400 transition-colors",
        className
      )}
      onClick={sortable ? onSort : undefined}
      aria-sort={
        sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : undefined
      }
      {...props}
    >
      {sortable ? (
        <div className="flex items-center">
          {content}
        </div>
      ) : (
        children
      )}
    </th>
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle [&:has([role=checkbox])]:pr-0 dark:text-slate-300",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
