# Data Flow Diagrams

## Current State: Disconnected Data Flows

```mermaid
graph TB
    subgraph "Data Entry"
        Upload[Contract Upload]
        ManualRC[Manual Rate Card]
        CSVImport[CSV Import]
        Extract[Extract from Contract]
    end
    
    subgraph "Storage Layer"
        MainDB[(Main Database)]
        AnalyticalDB[(Analytical DB)]
        Cache[Cache Layer]
    end
    
    subgraph "Processing"
        ArtifactGen[Artifact Generation]
        Benchmark[Benchmark Calc]
        Savings[Savings Analysis]
    end
    
    subgraph "UI Consumption"
        ContractView[Contract View]
        Dashboard[Dashboard]
        Analytics[Analytics]
    end
    
    Upload -->|writes| MainDB
    ManualRC -->|writes| MainDB
    CSVImport -->|writes| MainDB
    Extract -->|writes| MainDB
    
    MainDB -.->|manual trigger| ArtifactGen
    MainDB -.->|on-demand| Benchmark
    MainDB -.->|on-demand| Savings
    
    ArtifactGen -->|writes| MainDB
    
    MainDB -.->|no auto sync| AnalyticalDB
    MainDB -.->|no invalidation| Cache
    
    ContractView -->|reads| MainDB
    Dashboard -->|reads| MainDB
    Dashboard -->|reads| Cache
    Analytics -->|reads| AnalyticalDB
    
    style MainDB fill:#f9f,stroke:#333
    style AnalyticalDB fill:#f99,stroke:#333
    style Cache fill:#ff9,stroke:#333
    
    classDef broken stroke-dasharray: 5 5
    class ArtifactGen,Benchmark,Savings broken
```

## Ideal State: Event-Driven Data Flows

```mermaid
graph TB
    subgraph "Data Entry"
        Upload[Contract Upload]
        ManualRC[Manual Rate Card]
        CSVImport[CSV Import]
        Extract[Extract from Contract]
    end
    
    subgraph "Event Bus"
        Events{Event Bus}
    end
    
    subgraph "Storage Layer"
        MainDB[(Main Database)]
        AnalyticalDB[(Analytical DB)]
        Cache[Cache Layer]
    end
    
    subgraph "Event Handlers"
        ArtifactGen[Artifact Generator]
        Benchmark[Benchmark Calculator]
        Savings[Savings Analyzer]
        Sync[DB Sync Service]
        Invalidate[Cache Invalidator]
        Notify[Notification Service]
    end
    
    subgraph "UI Consumption"
        ContractView[Contract View]
        Dashboard[Dashboard]
        Analytics[Analytics]
        SSE[Real-time Updates]
    end
    
    Upload -->|writes| MainDB
    ManualRC -->|writes| MainDB
    CSVImport -->|writes| MainDB
    Extract -->|writes| MainDB
    
    MainDB -->|emits events| Events
    
    Events -->|contract.completed| ArtifactGen
    Events -->|ratecard.updated| Benchmark
    Events -->|artifact.generated| Savings
    Events -->|data.changed| Sync
    Events -->|data.changed| Invalidate
    Events -->|significant.event| Notify
    
    ArtifactGen -->|writes| MainDB
    Benchmark -->|writes| MainDB
    Savings -->|writes| MainDB
    Sync -->|syncs| AnalyticalDB
    Invalidate -->|clears| Cache
    
    MainDB -->|reads| ContractView
    MainDB -->|reads| Dashboard
    Cache -->|fast reads| Dashboard
    AnalyticalDB -->|reads| Analytics
    
    Notify -->|pushes| SSE
    SSE -->|updates| ContractView
    SSE -->|updates| Dashboard
    SSE -->|updates| Analytics
    
    style Events fill:#0f0,stroke:#333
    style MainDB fill:#9f9,stroke:#333
    style AnalyticalDB fill:#9f9,stroke:#333
    style Cache fill:#9f9,stroke:#333
```

## Contract Upload Flow - Detailed

### Current State
```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant DB
    participant BG as Background Job
    
    User->>UI: Upload contract
    UI->>API: POST /api/contracts/upload
    API->>DB: Create contract (processing)
    API-->>UI: Return contractId
    UI->>UI: Start polling
    
    Note over BG: Separate process
    BG->>DB: Check for processing contracts
    BG->>BG: Generate artifacts
    BG->>DB: Update contract (completed)
    
    loop Every 3 seconds
        UI->>API: GET /api/contracts/[id]
        API->>DB: Query contract
        DB-->>API: Contract data
        API-->>UI: Status update
    end
    
    Note over UI: Inefficient polling<br/>Delayed updates<br/>No real-time feedback
```

### Ideal State
```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant EventBus
    participant Services
    participant DB
    participant SSE
    
    User->>UI: Upload contract
    UI->>API: POST /api/contracts/upload
    API->>DB: Create contract (processing)
    API->>EventBus: emit('contract.uploaded')
    API-->>UI: Return contractId
    UI->>SSE: Subscribe to updates
    
    EventBus->>Services: Trigger artifact generation
    Services->>Services: Process contract
    Services->>DB: Save artifacts
    Services->>EventBus: emit('artifacts.generated')
    
    EventBus->>Services: Trigger rate extraction
    Services->>DB: Save rate cards
    Services->>EventBus: emit('rates.extracted')
    
    EventBus->>Services: Trigger analytics sync
    Services->>DB: Update analytics
    Services->>EventBus: emit('contract.completed')
    
    EventBus->>SSE: Push updates
    SSE-->>UI: Real-time progress
    SSE-->>UI: Completion notification
    
    Note over UI: Real-time updates<br/>Immediate feedback<br/>No polling needed
```

## Rate Card Edit Propagation

### Current State (Broken)
```mermaid
graph LR
    User[User Edits Rate Card]
    Update[Update Database]
    Stale1[Stale Benchmarks]
    Stale2[Stale Opportunities]
    Stale3[Stale Analytics]
    Stale4[Stale Cache]
    
    User --> Update
    Update -.->|no trigger| Stale1
    Update -.->|no trigger| Stale2
    Update -.->|no trigger| Stale3
    Update -.->|no invalidation| Stale4
    
    style Stale1 fill:#f99
    style Stale2 fill:#f99
    style Stale3 fill:#f99
    style Stale4 fill:#f99
```

### Ideal State (Event-Driven)
```mermaid
graph LR
    User[User Edits Rate Card]
    Update[Update Database]
    Event{Event: rate.updated}
    
    Recalc1[Recalc Benchmarks]
    Recalc2[Update Opportunities]
    Recalc3[Sync Analytics]
    Invalidate[Invalidate Cache]
    Notify[Send Notifications]
    
    User --> Update
    Update --> Event
    Event --> Recalc1
    Event --> Recalc2
    Event --> Recalc3
    Event --> Invalidate
    Event --> Notify
    
    Recalc1 --> Update
    Recalc2 --> Update
    Recalc3 --> Update
    
    style Event fill:#0f0
    style Recalc1 fill:#9f9
    style Recalc2 fill:#9f9
    style Recalc3 fill:#9f9
```

## Cache Invalidation Strategy

```mermaid
graph TB
    subgraph "Data Changes"
        RC[Rate Card Updated]
        Contract[Contract Updated]
        Artifact[Artifact Generated]
    end
    
    subgraph "Cache Tags"
        Tag1[rate-cards]
        Tag2[benchmarks]
        Tag3[supplier:X]
        Tag4[contract:Y]
        Tag5[analytics]
    end
    
    subgraph "Cached Data"
        Cache1[Rate Card List]
        Cache2[Benchmark Stats]
        Cache3[Supplier Dashboard]
        Cache4[Contract Details]
        Cache5[Analytics Dashboard]
    end
    
    RC -->|invalidate| Tag1
    RC -->|invalidate| Tag2
    RC -->|invalidate| Tag3
    
    Contract -->|invalidate| Tag4
    Contract -->|invalidate| Tag5
    
    Artifact -->|invalidate| Tag4
    Artifact -->|invalidate| Tag5
    
    Tag1 -.->|clears| Cache1
    Tag2 -.->|clears| Cache2
    Tag3 -.->|clears| Cache3
    Tag4 -.->|clears| Cache4
    Tag5 -.->|clears| Cache5
    
    style Tag1 fill:#ff9
    style Tag2 fill:#ff9
    style Tag3 fill:#ff9
    style Tag4 fill:#ff9
    style Tag5 fill:#ff9
```

## Database Sync Flow

```mermaid
sequenceDiagram
    participant Main as Main Database
    participant EventBus
    participant SyncService
    participant Analytical as Analytical DB
    participant Cache
    
    Note over Main: Data changes occur
    Main->>EventBus: emit('data.changed')
    
    EventBus->>SyncService: Trigger sync
    SyncService->>Main: Read changed data
    Main-->>SyncService: Return data
    
    SyncService->>SyncService: Transform for analytics
    SyncService->>Analytical: Write aggregated data
    
    SyncService->>EventBus: emit('sync.completed')
    EventBus->>Cache: Invalidate analytics cache
    
    Note over Analytical: Data now consistent
```

## Real-time Update Flow

```mermaid
sequenceDiagram
    participant User1
    participant User2
    participant API
    participant EventBus
    participant SSE
    participant DB
    
    User1->>API: Update rate card
    API->>DB: Save changes
    API->>EventBus: emit('rate.updated')
    
    EventBus->>SSE: Broadcast update
    
    SSE-->>User1: Confirmation
    SSE-->>User2: Live update
    
    Note over User2: Sees changes<br/>immediately without<br/>page refresh
```

## Data Lineage Tracking

```mermaid
graph TB
    Contract[Contract: ABC-123]
    Artifact1[Artifact: Financial]
    Artifact2[Artifact: Rates]
    RC1[Rate Card: Dev-Senior]
    RC2[Rate Card: PM-Mid]
    Benchmark[Benchmark: Tech Roles]
    Opportunity[Savings Opportunity]
    
    Contract -->|generates| Artifact1
    Contract -->|generates| Artifact2
    Artifact2 -->|extracts| RC1
    Artifact2 -->|extracts| RC2
    RC1 -->|feeds into| Benchmark
    RC2 -->|feeds into| Benchmark
    Benchmark -->|identifies| Opportunity
    
    style Contract fill:#9cf
    style Artifact1 fill:#9fc
    style Artifact2 fill:#9fc
    style RC1 fill:#fc9
    style RC2 fill:#fc9
    style Benchmark fill:#f9c
    style Opportunity fill:#cf9
    
    Note1[When Contract changes<br/>all downstream data<br/>should be updated]
```

## Conflict Resolution Flow

```mermaid
sequenceDiagram
    participant User1
    participant User2
    participant API
    participant DB
    participant Conflict as Conflict Resolver
    
    User1->>API: Read rate card (v1)
    User2->>API: Read rate card (v1)
    
    User1->>API: Update rate card
    API->>DB: Save (v2)
    API-->>User1: Success
    
    User2->>API: Update rate card (based on v1)
    API->>DB: Attempt save
    DB-->>API: Conflict! (v2 exists)
    
    API->>Conflict: Resolve conflict
    Conflict->>Conflict: Merge changes
    Conflict-->>API: Merged version (v3)
    
    API->>DB: Save merged (v3)
    API-->>User2: Conflict resolved
    
    Note over User2: Shows what changed<br/>and merged result
```

## Summary: Key Improvements Needed

1. **Event Bus Integration** - All data changes emit events
2. **Cache Invalidation** - Tag-based cache clearing
3. **Database Sync** - Automatic sync to analytical DB
4. **Real-time Updates** - SSE/WebSocket for live data
5. **Data Lineage** - Track dependencies and propagate changes
6. **Conflict Resolution** - Handle concurrent edits gracefully

These changes will transform the system from a collection of disconnected operations into a cohesive, real-time platform where data flows smoothly and stays consistent.
