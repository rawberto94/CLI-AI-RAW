"use client";

/**
 * UI Component Showcase
 * Demonstrates the new enhanced UI components
 */

import { Button } from "@/components/ui/button";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { StatCard } from "@/components/ui/stat-card";
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle, 
  TrendingUp, 
  Users, 
  FileText, 
  DollarSign,
  Sparkles,
  Shield
} from "lucide-react";
import { useState } from "react";

export default function EnhancedUIShowcase() {
  const [searchValue, setSearchValue] = useState("");
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    const newSet = new Set(selectedCards);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCards(newSet);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1600px] mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Enhanced UI Components</h1>
          <p className="text-muted-foreground text-lg">
            New components and variants for a polished enterprise experience
          </p>
        </div>

        {/* Button Variants */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Button Variants</CardTitle>
              <CardDescription>
                Three new button styles for different use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Success Buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Success Variant</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  For positive confirmations: Approve, Accept, Confirm
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="success">
                    <CheckCircle className="h-4 w-4" />
                    Approve Contract
                  </Button>
                  <Button variant="success" size="sm">
                    Accept Terms
                  </Button>
                  <Button variant="success" size="lg">
                    Confirm Payment
                  </Button>
                </div>
              </div>

              {/* Gradient Buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Gradient Variant</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  For premium/featured actions: Upgrade, Start Trial
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="gradient">
                    <Sparkles className="h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                  <Button variant="gradient" size="sm">
                    Get Started
                  </Button>
                  <Button variant="gradient" size="lg">
                    Get Premium Access
                  </Button>
                </div>
              </div>

              {/* Glass Buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Glass Variant</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  For overlay actions: Hero CTAs, Floating buttons (best on colored background)
                </p>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-8 rounded-lg">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="glass">
                      <Shield className="h-4 w-4" />
                      Explore Features
                    </Button>
                    <Button variant="glass" size="sm">
                      Learn More
                    </Button>
                    <Button variant="glass" size="lg">
                      Get Started Now
                    </Button>
                  </div>
                </div>
              </div>

              {/* All Variants Comparison */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">All Button Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="default">Default</Button>
                  <Button variant="success">Success</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Interactive Cards */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Cards</CardTitle>
              <CardDescription>
                Cards with hover effects, selection, and status indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Hoverable Card */}
                <InteractiveCard hoverable>
                  <CardHeader>
                    <CardTitle className="text-lg">Hoverable</CardTitle>
                    <CardDescription>Hover for lift effect</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      This card lifts up when you hover over it with a smooth animation.
                    </p>
                  </CardContent>
                </InteractiveCard>

                {/* Clickable Card */}
                <InteractiveCard
                  hoverable
                  clickable
                  onClick={() => alert("Card clicked!")}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Clickable</CardTitle>
                    <CardDescription>Click me!</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      This entire card is clickable and has a scale animation.
                    </p>
                  </CardContent>
                </InteractiveCard>

                {/* Selectable Card */}
                <InteractiveCard
                  hoverable
                  selectable
                  selected={selectedCards.has("card1")}
                  onSelect={() => toggleCard("card1")}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Selectable</CardTitle>
                    <CardDescription>Select with checkbox</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      This card can be selected via checkbox in the top-right.
                    </p>
                  </CardContent>
                </InteractiveCard>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Status Indicators</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <InteractiveCard status="success">
                    <CardHeader>
                      <CardTitle className="text-sm">Success</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Green left border
                      </p>
                    </CardContent>
                  </InteractiveCard>

                  <InteractiveCard status="warning">
                    <CardHeader>
                      <CardTitle className="text-sm">Warning</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Orange left border
                      </p>
                    </CardContent>
                  </InteractiveCard>

                  <InteractiveCard status="error">
                    <CardHeader>
                      <CardTitle className="text-sm">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Red left border
                      </p>
                    </CardContent>
                  </InteractiveCard>

                  <InteractiveCard status="info">
                    <CardHeader>
                      <CardTitle className="text-sm">Info</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Blue left border
                      </p>
                    </CardContent>
                  </InteractiveCard>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Search Input */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Search Input</CardTitle>
              <CardDescription>
                Search input with icon and clear button (already existed with advanced features!)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SearchInput
                placeholder="Search contracts, clients, or documents..."
                value={searchValue}
                onChange={(value) => setSearchValue(value)}
                onClear={() => setSearchValue("")}
              />
              {searchValue && (
                <p className="text-sm text-muted-foreground">
                  Searching for: <span className="font-medium">{searchValue}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Stat Cards */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KPI Stat Cards</CardTitle>
              <CardDescription>
                Dashboard metrics with trend indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Contracts"
                  value="1,284"
                  change={12.5}
                  trend="up"
                  icon={<FileText className="h-6 w-6" />}
                />

                <StatCard
                  title="Active Users"
                  value="856"
                  change={-3.2}
                  trend="down"
                  icon={<Users className="h-6 w-6" />}
                />

                <StatCard
                  title="Revenue"
                  value="$2.4M"
                  change={18.7}
                  trend="up"
                  changeLabel="vs last month"
                  icon={<DollarSign className="h-6 w-6" />}
                />

                <StatCard
                  title="Approval Rate"
                  value="94.2%"
                  change={0}
                  trend="neutral"
                  icon={<TrendingUp className="h-6 w-6" />}
                />
              </div>

              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-medium">Loading State</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StatCard
                    title="Loading..."
                    value="..."
                    loading
                  />
                  <StatCard
                    title="Loading..."
                    value="..."
                    loading
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Usage Examples */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Examples</CardTitle>
              <CardDescription>
                Code snippets for implementing these components
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Button Variants</h3>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`<Button variant="success">Approve</Button>
<Button variant="gradient">Upgrade to Pro</Button>
<Button variant="glass">Get Started</Button>`}
                </pre>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Interactive Card</h3>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`<InteractiveCard
  hoverable
  clickable
  status="success"
  onClick={() => {}}
>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</InteractiveCard>`}
                </pre>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Stat Card</h3>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`<StatCard
  title="Total Revenue"
  value="$2.4M"
  change={18.7}
  trend="up"
  icon={<DollarSign />}
/>`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
