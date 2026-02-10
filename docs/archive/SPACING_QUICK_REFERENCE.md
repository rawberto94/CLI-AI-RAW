# Spacing Standards - Quick Reference

**Quick lookup guide for developers** - Keep this handy when building new features! 🚀

---

## 🎯 The Golden Rules

```tsx
// Copy-paste these patterns - they're battle-tested!

// 1. BADGES
<Badge className="px-3 py-1">
  <Icon className="h-3.5 w-3.5" />
  Status
</Badge>

// 2. CARDS
<Card>
  <CardContent className="p-5">
    {/* your content */}
  </CardContent>
</Card>

// 3. BUTTONS
<Button className="h-8">
  <Icon className="h-3.5 w-3.5 mr-2" />
  Action
</Button>

// 4. BUTTON GROUPS
<div className="flex gap-2.5">
  <Button className="h-8">Primary</Button>
  <Button className="h-8">Secondary</Button>
</div>

// 5. STATS
<div className="flex gap-4">
  <StatCard />
  <StatCard />
</div>
```

---

## 📏 Icon Sizes

```tsx
// Use the right size for the context:
h-2.5 w-2.5  // ✨ Micro sparkles, tiny decorations
h-3 w-3      // ⏸️ Tiny controls (pause/play in media)
h-3.5 w-3.5  // 🏷️ Badge icons, small buttons, sort arrows
h-4 w-4      // 🔘 Standard buttons, checkboxes, inputs
h-5 w-5      // ⭐ Feature highlights, section headers
h-6+ w-6+    // 🎯 Large page headers, hero icons
```

**Examples:**

```tsx
// Badge icon
<Badge className="px-3 py-1">
  <CheckCircle className="h-3.5 w-3.5" />
  Active
</Badge>

// Button icon
<Button className="h-8">
  <Upload className="h-3.5 w-3.5 mr-2" />
  Upload
</Button>

// Feature card icon
<div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
  <Sparkles className="h-5 w-5 text-white" />
</div>
```

---

## 📦 Spacing Scale

```tsx
// Use these standard gaps:
gap-1.5   // Tight spacing (icon + text in badges)
gap-2.5   // Button groups, form controls
gap-3     // Standard content sections
gap-4     // Stats, metrics, feature cards
gap-5     // Major sections
gap-6     // Hero sections, large layouts

// Vertical spacing:
space-y-2.5  // Compact lists
space-y-3    // Standard lists
space-y-4    // Section separation
space-y-5    // Major sections
```

---

## 🎨 Common Patterns

### Status Badge

```tsx
<Badge className="px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
  <CheckCircle className="h-3.5 w-3.5" />
  Active
</Badge>
```

### Stat Card

```tsx
<Card>
  <CardContent className="p-5">
    <div className="flex items-center justify-between">
      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
        <FileText className="h-5 w-5 text-white" />
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
    </div>
    <div className="mt-4 space-y-1">
      <p className="text-2xl font-bold">1,234</p>
      <p className="text-sm text-slate-500">Total Items</p>
    </div>
  </CardContent>
</Card>
```

### Action Button Group

```tsx
<div className="flex gap-2.5">
  <Button className="h-8">
    <Plus className="h-3.5 w-3.5 mr-2" />
    New
  </Button>
  <Button variant="outline" className="h-8">
    <RefreshCw className="h-3.5 w-3.5 mr-2" />
    Refresh
  </Button>
</div>
```

### Table Row

```tsx
<TableRow>
  <TableCell className="py-3.5">
    <div className="flex items-center gap-3">
      <FileText className="h-4 w-4 text-slate-400" />
      <span>Content</span>
      <Badge className="px-3 py-1">
        <Icon className="h-3.5 w-3.5" />
        Status
      </Badge>
    </div>
  </TableCell>
</TableRow>
```

---

## ⚠️ Common Mistakes

### ❌ DON'T

```tsx
// Wrong badge padding
<Badge className="px-2 py-0.5">

// Wrong icon size
<Button><Icon className="h-4 w-4" /></Button>

// Wrong card padding
<CardContent className="p-6">

// Wrong button height
<Button className="h-10">

// Wrong gap
<div className="flex gap-2">
```

### ✅ DO

```tsx
// Correct badge padding
<Badge className="px-3 py-1">

// Correct icon size
<Button><Icon className="h-3.5 w-3.5" /></Button>

// Correct card padding
<CardContent className="p-5">

// Correct button height
<Button className="h-8">

// Correct gap
<div className="flex gap-2.5">
```

---

## 🔍 Quick Checklist

Before you commit:

- [ ] All badges have `px-3 py-1`
- [ ] Badge icons are `h-3.5 w-3.5`
- [ ] CardContent uses `p-5`
- [ ] Buttons are `h-8`
- [ ] Button groups use `gap-2.5`
- [ ] Icons follow the size hierarchy
- [ ] Stats containers use `gap-4`
- [ ] No TypeScript errors

---

## 💡 Pro Tips

1. **Copy existing patterns** - Find a similar component and copy its spacing
2. **Use the inspector** - Check spacing of existing elements in dev tools
3. **Test both themes** - Verify in light and dark mode
4. **Check mobile** - Ensure responsive breakpoints work
5. **Scan for outliers** - If it looks different, it probably is wrong

---

## 📱 Responsive Patterns

```tsx
// Stats grid - responsive
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
  <StatCard />
</div>

// Button group - mobile stack
<div className="flex flex-col sm:flex-row gap-2.5">
  <Button className="h-8">Action 1</Button>
  <Button className="h-8">Action 2</Button>
</div>

// Card grid - responsive
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
  <Card />
</div>
```

---

## 🎓 When in Doubt

1. Look at the **Contracts page** - it's the gold standard
2. Check **COMPREHENSIVE_SPACING_AUDIT.md** for detailed examples
3. Ask yourself: "Does this match the other pages?"
4. Use consistent spacing - don't invent new values

---

**Remember**: Consistency > Perfection. When everyone follows the same standards, the whole app feels professional! 🌟
