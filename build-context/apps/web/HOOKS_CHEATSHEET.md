# Hooks & Utilities Cheatsheet

Quick reference for all custom hooks and utilities available in the codebase.

---

## Table of Contents

1. [Data Fetching](#data-fetching)
2. [UI State Management](#ui-state-management)
3. [Forms](#forms)
4. [Lists & Tables](#lists--tables)
5. [Selection](#selection)
6. [Modals & Overlays](#modals--overlays)
7. [Navigation](#navigation)
8. [Responsive Design](#responsive-design)
9. [Time & Async](#time--async)
10. [Events & DOM](#events--dom)
11. [Storage](#storage)
12. [Downloads & Exports](#downloads--exports)
13. [Utilities](#utilities)

---

## Data Fetching

### `useFetch<T>`

Simple data fetching with caching.

```tsx
const { data, isLoading, error, refetch } = useFetch<User[]>('/api/users', {
  cacheTime: 60000,
  staleTime: 30000,
  enabled: true,
});
```

### `useMutation<T, V>`

Handle mutations with loading/error states.

```tsx
const { mutate, isLoading, error, data } = useMutation<User, CreateUserData>(
  (data) => fetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  { onSuccess: () => toast.success('Created!') }
);
```

### `useInfiniteScroll<T>`

Infinite scroll with load-more support.

```tsx
const { items, isLoading, hasMore, loadMore, sentinelRef } = useInfiniteScroll<Post>(
  '/api/posts',
  { pageSize: 20 }
);

// Place ref at bottom of list
<div ref={sentinelRef} />
```

---

## UI State Management

### `useToggle`

Boolean toggle state.

```tsx
const [isOpen, toggle, setIsOpen] = useToggle(false);

<Button onClick={toggle}>Toggle</Button>
<Button onClick={() => setIsOpen(true)}>Open</Button>
```

### `useDisclosure`

Modal/drawer state management.

```tsx
const { isOpen, open, close, toggle } = useDisclosure();

<Button onClick={open}>Open Modal</Button>
<Modal open={isOpen} onClose={close}>...</Modal>
```

### `useCounter`

Numeric counter with min/max.

```tsx
const { count, increment, decrement, reset, set } = useCounter(0, { min: 0, max: 10 });
```

### `useSetState<T>`

Object state with partial updates (like class component setState).

```tsx
const [state, setState] = useSetState({ name: '', age: 0 });

setState({ name: 'John' }); // Only updates name, keeps age
```

### `useMap<K, V>` / `useSet<T>`

Map and Set state helpers.

```tsx
const [map, { set, remove, clear }] = useMap<string, User>();
const [set, { add, remove, toggle }] = useSet<string>();
```

---

## Forms

### `useForm<T>`

Lightweight form management with validation.

```tsx
const form = useForm<LoginData>({
  initialValues: { email: '', password: '' },
  validate: {
    email: validators.email('Invalid email'),
    password: validators.minLength(8, 'Min 8 characters'),
  },
  onSubmit: async (values) => await login(values),
});

<Input {...form.getFieldProps('email')} error={form.errors.email} />
<Button onClick={form.handleSubmit} disabled={!form.isValid}>Submit</Button>
```

### `useFieldArray<T>`

Dynamic array fields.

```tsx
const { fields, append, remove, move, swap, insert } = useFieldArray<Address>(
  'addresses',
  form
);

{fields.map((field, index) => (
  <div key={field.id}>
    <Input {...form.getFieldProps(`addresses.${index}.street`)} />
    <Button onClick={() => remove(index)}>Remove</Button>
  </div>
))}
<Button onClick={() => append({ street: '', city: '' })}>Add Address</Button>
```

### Built-in Validators

```tsx
import { validators } from '@/hooks';

validators.required('Required field')
validators.email('Invalid email')
validators.minLength(5, 'Min 5 chars')
validators.maxLength(100, 'Max 100 chars')
validators.pattern(/^\d+$/, 'Numbers only')
validators.min(0, 'Must be positive')
validators.max(100, 'Max 100')
validators.match('password', 'Passwords must match')
validators.custom((value) => value !== 'admin' || 'Cannot use admin')
```

---

## Lists & Tables

### `useListState<T>`

Complete list management with filter/sort/paginate.

```tsx
const list = useListState(users, {
  initialSort: { key: 'name', direction: 'asc' },
  initialPageSize: 10,
  searchKeys: ['name', 'email'],
});

<Input value={list.searchQuery} onChange={(e) => list.setSearchQuery(e.target.value)} />

<Table>
  <Th onClick={() => list.toggleSort('name')}>
    Name {list.getSortDirection('name') === 'asc' ? '↑' : '↓'}
  </Th>
  {list.paginatedItems.map(user => <Tr key={user.id}>...</Tr>)}
</Table>

<Pagination 
  page={list.pagination.page}
  total={list.totalPages}
  onPageChange={list.setPage}
/>
```

### `useFilteredList<T>`

Simple filtering.

```tsx
const { filteredItems, setFilter, clearFilter, hasActiveFilters } = useFilteredList(items, {
  searchKeys: ['name', 'description'],
});

setFilter('status', 'active');
setFilter('category', ['tech', 'design']);
```

### `useSortedList<T>`

Just sorting.

```tsx
const { sortedItems, toggleSort, sortConfig } = useSortedList(items);
```

### `usePaginatedList<T>`

Just pagination.

```tsx
const { paginatedItems, page, nextPage, prevPage, hasNextPage, showingText } = usePaginatedList(items, {
  initialPageSize: 20
});
```

---

## Selection

### `useSelection<T>`

Multi-selection state.

```tsx
const selection = useSelection<User>({
  multiple: true,
  max: 10,
  getKey: (user) => user.id,
});

{users.map(user => (
  <Checkbox 
    checked={selection.isSelected(user)}
    onChange={() => selection.toggle(user)}
  />
))}

<Checkbox 
  {...selection.getSelectAllProps(users)}
  label="Select All"
/>

<p>{selection.count} selected</p>
```

### `useSelectionWithShift<T>`

Selection with shift-click for ranges.

```tsx
const { handleClick, selected } = useSelectionWithShift({ items: users });

{users.map((user, index) => (
  <Row onClick={(e) => handleClick(user, e)}>...</Row>
))}
```

### `useCheckboxGroup<T>` / `useRadioGroup<T>`

Form checkbox/radio groups.

```tsx
const checkboxes = useCheckboxGroup({ initialChecked: ['option1'] });
const radios = useRadioGroup({ initialValue: 'option1' });

<Checkbox {...checkboxes.getCheckboxProps('option1')} />
<Radio {...radios.getRadioProps('option1')} />
```

---

## Modals & Overlays

### `useModal<T>`

Generic modal state with data passing.

```tsx
const modal = useModal<User>();

<Button onClick={() => modal.open(selectedUser)}>Edit User</Button>

<Modal open={modal.isOpen} onClose={modal.close}>
  {modal.data && <EditUserForm user={modal.data} />}
</Modal>
```

### `useConfirmModal`

Confirmation dialogs.

```tsx
const confirm = useConfirmModal({
  onConfirm: async () => await deleteUser(userId),
});

<Button onClick={() => confirm.open()}>Delete</Button>

<ConfirmDialog 
  open={confirm.isOpen}
  onConfirm={confirm.handleConfirm}
  onCancel={confirm.close}
  isLoading={confirm.isLoading}
/>
```

### `useMultiStepModal`

Wizard/multi-step modals.

```tsx
const wizard = useMultiStepModal({ totalSteps: 3 });

<Modal open={wizard.isOpen}>
  {wizard.currentStep === 1 && <Step1 onNext={wizard.nextStep} />}
  {wizard.currentStep === 2 && <Step2 onNext={wizard.nextStep} onBack={wizard.prevStep} />}
  {wizard.currentStep === 3 && <Step3 onComplete={wizard.close} />}
  
  <Progress value={(wizard.currentStep / 3) * 100} />
</Modal>
```

### `useOverlay`

Combined overlay behavior (scroll lock, focus trap, escape key).

```tsx
function Modal({ isOpen, onClose, children }) {
  const { containerRef } = useOverlay({
    isOpen,
    onClose,
    lockScroll: true,
    closeOnEscape: true,
    trapFocus: true,
  });
  
  return isOpen ? <div ref={containerRef}>{children}</div> : null;
}
```

---

## Navigation

### `useTabs`

Tab state management.

```tsx
const tabs = useTabs(['overview', 'settings', 'users'], { defaultTab: 'overview' });

<TabList>
  {tabs.tabs.map(tab => (
    <Tab 
      key={tab} 
      active={tabs.activeTab === tab}
      onClick={() => tabs.setTab(tab)}
    >
      {tab}
    </Tab>
  ))}
</TabList>

{tabs.activeTab === 'overview' && <Overview />}
{tabs.activeTab === 'settings' && <Settings />}
```

### `useTabsWithHistory`

Tabs synced to URL.

```tsx
const tabs = useTabsWithHistory(['overview', 'settings'], { paramName: 'tab' });
// URL: /page?tab=settings
```

### `useSteps`

Step/wizard navigation.

```tsx
const steps = useSteps(4);

<Stepper>
  {[1,2,3,4].map(step => (
    <Step 
      completed={steps.isCompleted(step)}
      active={steps.currentStep === step}
    />
  ))}
</Stepper>

<Button onClick={steps.completeAndNext}>Continue</Button>
```

### `useAccordion`

Accordion state.

```tsx
const accordion = useAccordion(['section1', 'section2'], { allowMultiple: true });

{items.map(item => (
  <AccordionItem 
    key={item.id}
    open={accordion.isOpen(item.id)}
    onToggle={() => accordion.toggle(item.id)}
  />
))}
```

---

## Responsive Design

### `useMediaQuery`

Track media query matches.

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
```

### `useBreakpoint`

Tailwind breakpoint detection.

```tsx
const { isMobile, isTablet, isDesktop, breakpoint } = useBreakpoint();

{isMobile ? <MobileNav /> : <DesktopNav />}
```

### `usePreferredColorScheme` / `usePreferredMotion`

User preferences.

```tsx
const colorScheme = usePreferredColorScheme(); // 'light' | 'dark' | 'no-preference'
const motion = usePreferredMotion(); // 'reduce' | 'no-preference'

const shouldAnimate = motion !== 'reduce';
```

---

## Time & Async

### `useDebounce` / `useThrottle`

Debounced/throttled values.

```tsx
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

useEffect(() => {
  fetchResults(debouncedSearch);
}, [debouncedSearch]);
```

### `useDebounceCallback` / `useThrottleCallback`

Debounced/throttled functions.

```tsx
const handleSearch = useDebounceCallback((query) => {
  fetchResults(query);
}, 300);
```

### `useAsync<T>`

Async operation state.

```tsx
const { execute, isLoading, data, error } = useAsync(fetchUserData);

<Button onClick={() => execute(userId)} disabled={isLoading}>
  Load User
</Button>
```

### `useInterval` / `useTimeout`

Timer hooks.

```tsx
useInterval(() => {
  refetch();
}, 5000); // Poll every 5s

useTimeout(() => {
  showNotification();
}, 3000); // Show after 3s
```

### `useCountdown`

Countdown timer.

```tsx
const { seconds, isRunning, start, stop, reset } = useCountdown(60);

<p>{seconds}s remaining</p>
<Button onClick={start}>Start</Button>
```

---

## Events & DOM

### `useEventListener`

Add event listeners declaratively.

```tsx
useEventListener('keydown', (e) => {
  if (e.key === 'Escape') onClose();
});

useEventListener('scroll', handleScroll, containerRef);
```

### `useOnClickOutside`

Detect clicks outside element.

```tsx
const ref = useRef(null);
useOnClickOutside(ref, () => setIsOpen(false));

<div ref={ref}>Dropdown content</div>
```

### `useWindowSize`

Track window dimensions.

```tsx
const { width, height } = useWindowSize();
```

### `useScrollPosition`

Track scroll position.

```tsx
const { x, y } = useScrollPosition();
const showBackToTop = y > 500;
```

### `useHover` / `useFocus`

Track hover/focus state.

```tsx
const [hoverRef, isHovered] = useHover();
const [focusRef, isFocused] = useFocus();
```

### `useIsVisible`

Intersection observer.

```tsx
const [ref, isVisible] = useIsVisible({ threshold: 0.5 });

<div ref={ref}>
  {isVisible && <LazyContent />}
</div>
```

---

## Storage

### `useLocalStorage<T>`

Persist state to localStorage.

```tsx
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

### `useCopyToClipboard`

Copy text to clipboard.

```tsx
const { copy, copied } = useCopyToClipboard();

<Button onClick={() => copy(text)}>
  {copied ? 'Copied!' : 'Copy'}
</Button>
```

---

## Downloads & Exports

### `useDownload`

Download files/data.

```tsx
const { downloadJson, downloadCsv, downloadText, downloading } = useDownload();

<Button onClick={() => downloadJson(data, 'export.json')}>Export JSON</Button>
<Button onClick={() => downloadCsv(csvString, 'data.csv')}>Export CSV</Button>
```

### `useExportCsv<T>`

Export objects to CSV.

```tsx
const { exportToCsv, exporting } = useExportCsv<User>();

<Button onClick={() => exportToCsv(users, {
  columns: [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'createdAt', header: 'Created', formatter: (v) => formatDate(v) },
  ],
  filename: 'users.csv'
})}>
  Export
</Button>
```

### `usePrint`

Print content.

```tsx
const { print, printElement } = usePrint({ title: 'Invoice' });

<Button onClick={() => printElement('invoice-content')}>Print</Button>
```

---

## Utilities

### `usePrevious<T>`

Get previous value.

```tsx
const previousCount = usePrevious(count);
```

### `useHasChanged`

Detect value changes.

```tsx
const hasChanged = useHasChanged(formValues);
```

### `useFirstRender`

Detect first render.

```tsx
const isFirstRender = useFirstRender();
```

### `useUpdateEffect`

useEffect that skips first render.

```tsx
useUpdateEffect(() => {
  // Only runs on updates, not initial mount
  saveToServer(data);
}, [data]);
```

---

## Conditional Components

### `<Show>`

Conditional rendering.

```tsx
<Show when={isLoading} fallback={<Content />}>
  <LoadingSpinner />
</Show>
```

### `<Switch>` / `<Match>`

Pattern matching.

```tsx
<Switch value={status}>
  <Match when="loading"><Spinner /></Match>
  <Match when="error"><ErrorMessage /></Match>
  <Match when="success"><SuccessMessage /></Match>
</Switch>
```

### `<For>`

List iteration with fallback.

```tsx
<For each={items} fallback={<EmptyState />}>
  {(item, index) => <Item key={item.id} data={item} />}
</For>
```

### `<ConditionalWrapper>`

Conditionally wrap children.

```tsx
<ConditionalWrapper
  condition={hasLink}
  wrapper={(children) => <Link href={url}>{children}</Link>}
>
  <Button>Click me</Button>
</ConditionalWrapper>
```

---

## Import Examples

```tsx
// Import hooks
import {
  useToggle,
  useDebounce,
  useLocalStorage,
  useForm,
  useListState,
  useSelection,
  useModal,
  useBreakpoint,
} from '@/hooks';

// Import components
import { Show, For, Switch, Match } from '@/components/ui/conditional';
import { SearchInput, DebouncedSearchInput } from '@/components/ui/search-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
```
