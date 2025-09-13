import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link';
import { 
  Home, 
  FolderOpen, 
  Building2, 
  FileEdit, 
  Layers, 
  Table2, 
  LineChart, 
  ShieldAlert, 
  AlertTriangle, 
  ScrollText, 
  BarChart3, 
  Settings,
  Upload,
  Bell,
  FileText,
  Menu,
  X
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Procurement CLM Intelligence',
  description: 'AI-powered indirect procurement contract lifecycle management',
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Contracts', href: '/contracts', icon: FolderOpen },
  { name: 'Suppliers', href: '/suppliers', icon: Building2 },
  { name: 'Draft Editor', href: '/drafts', icon: FileEdit },
  { name: 'Clauses & Playbooks', href: '/clauses', icon: Layers },
  { name: 'Financials', href: '/financials', icon: Table2 },
  { name: 'Benchmarks', href: '/benchmarks', icon: LineChart },
  { name: 'Compliance', href: '/compliance', icon: ShieldAlert },
  { name: 'Risk', href: '/risk', icon: AlertTriangle },
  { name: 'Reports', href: '/reports', icon: ScrollText },
  { name: 'Analytics & Spend', href: '/analytics', icon: BarChart3 },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 dark:bg-gray-900`}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <div className="hidden lg:flex lg:flex-shrink-0">
            <div className="flex flex-col w-64">
              <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm">
                {/* Header */}
                <div className="flex items-center flex-shrink-0 px-6 py-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-gray-900 dark:text-white">Procurement CLM</h1>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Contract Intelligence</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex space-x-2">
                    <Link 
                      href="/upload" 
                      className="flex-1 bg-gradient-primary text-white text-xs font-medium py-3 px-3 rounded-lg transition-all duration-200 flex items-center justify-center hover:shadow-lg hover:scale-105 transform"
                    >
                      <Upload className="w-3 h-3 mr-1.5" />
                      Upload Contract
                    </Link>
                    <button className="p-3 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 transform">
                      <Bell className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                  {navigationItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="sidebar-nav-item group animate-slide-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <Icon className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors duration-200" />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>

                {/* Settings Footer */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href="/settings"
                    className="sidebar-nav-item"
                  >
                    <Settings className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors duration-200" />
                    <span className="font-medium">Settings</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-col w-0 flex-1 overflow-hidden">
            {/* Mobile header */}
            <div className="relative z-10 flex-shrink-0 flex h-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 lg:hidden">
              <button className="px-4 border-r border-gray-200 dark:border-gray-700 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden">
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex-1 px-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Procurement CLM</h1>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg">
                  <Bell className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Page content */}
            <main className="flex-1 relative overflow-y-auto focus:outline-none">
              <div className="animate-fade-in">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
