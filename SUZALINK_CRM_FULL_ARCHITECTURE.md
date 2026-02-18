# Captain Prospect CRM - Full Architecture Audit

**Generated on:** 2026-01-20
**Version:** v0.1.0
**Scope:** Complete Codebase Analysis

---

# 1. Global Overview

### Project Purpose
Captain Prospect CRM is a bespoke Client Relationship Management and Sales Engagement Platform designed for high-velocity outbound sales teams. It integrates typical CRM features (Contact/Company management) with advanced Sales Engagement tools (Sequencing, Calling, Scripting) and internal collaboration (Team Chat).

### Business Goals
1.  **Centralize Sales Ops**: Combine prospecting, outreach, and closing in one tool.
2.  **Enforce Process**: Guide SDRs through specific workflows via "Missions" and "Campaigns".
3.  **Client Transparency**: Provide clients with a view of the activity (Client Portal).
4.  **Automation**: Automate email sequences and reporting.

### Target Users & Roles
*   **Manager**: Administers the system, creates missions, assigns tasks, reviews performance.
*   **SDR (Sales Development Rep)**: Executes the outreach (Calls, Emails). High-volume, focused interface.
*   **Business Developer (BD)**: Hybrid role managing client relationships and post-sales delivery.
*   **Client**: External viewers monitoring their campaign progress.
*   **Developer**: Technical admin (super-user).

### High-Level Architecture
```mermaid
graph TD
    Client[Browser Client] --> LB[Load Balancer]
    LB --> Next[Next.js App Server]
    
    subgraph "Application Layer (Next.js 16+)"
        Auth[NextAuth.js]
        API[API Routes / Server Actions]
        Pages[React Server Components]
        Workers[BullMQ Workers]
    end
    
    subgraph "Data Layer"
        Postgres[PostgreSQL Database]
        Redis[Redis (Queues/Cache)]
        Storage[S3 Compatible Storage]
    end
    
    subgraph "External Integrations"
        Gmail[Gmail API]
        Outlook[Outlook Graph API]
        Mistral[Mistral AI (LLM)]
        GoogleDrive[Google Drive API]
        SMTP[Custom SMTP/IMAP]
    end
    
    Next --> Postgres
    Workers --> Redis
    Workers --> Gmail
    Workers --> Outlook
    Next --> Mistral
    Next --> Storage
```

---

# 2. Tech Stack

### Core Frameworks
*   **Runtime**: Node.js
*   **Framework**: Next.js 16.1.1 (App Router)
*   **Language**: TypeScript 5.x
*   **Database ORM**: Prisma 6.19.1

### Frontend Libraries
*   **UI System**: Tailwind CSS v4 (Alpha/Beta implied by config), Tailwind Merge, clsx
*   **Icons**: Lucide React
*   **Components**: Radix UI primitives (implied by `components/ui` structure), React Hook Form
*   **Visualization**: Recharts
*   **Data Fetching**: React Query (TanStack Query) v5
*   **State**: React Context + Local State (Zustand not explicit but possible, mostly Context)

### Backend & Infrastructure
*   **Auth**: NextAuth.js v4 (JWT Strategy)
*   **Queue System**: BullMQ + IORedis
*   **Email Engine**: ImapFlow, Nodemailer, Mailparser
*   **Storage**: AWS SDK v3 (S3 Client)
*   **Encryption**: Bcrypt.js (Passwords), Custom encryption for tokens.

### Build & Deploy
*   **Linting**: ESLint 9
*   **Bundler**: Webpack (via Next.js)

---

# 3. Folder-by-Folder Breakdown

## `/app`
*   **`app/api`**: Roots for all backend logic. Massive surface area covering `auth`, `campaigns`, `clients`, `comms`, `email`, etc. Functions as a REST-ish API consumed by the frontend.
*   **`app/manager`**: Protected routes for the `MANAGER` role. Contains sub-pages for `dashboard`, `users`, `missions`, `campaigns`, `email`, `files`.
*   **`app/sdr`**: Protected routes for `SDR`. Focuses on execution: `action`, `lists`, `dashboard`.
*   **`app/bd`**: Protected routes for `BUSINESS_DEVELOPER`. Hybrid views: `clients`, `projects`.
*   **`app/client`**: Portal for external clients (limited visibility).
*   **`app/developer`**: Admin/Debug views.

## `/lib`
*   **`lib/email`**: Core logic for the "Email Hub". Contains `providers` (IMAP/Gmail), `queue` (Workers), `services` (Sending, Sync).
*   **`lib/comms`**: Logic for internal chat system.
*   **`lib/permissions`**: granular permission verification logic (`PermissionProvider`).
*   **`lib/prisma.ts`**: Singleton Prisma client instance.
*   **`lib/auth.ts`**: NextAuth configuration, callbacks, and role definitions.
*   **`lib/encryption.ts`**: Utilities to encrypt/decrypt OAuth tokens in DB.

## `/components`
*   **`components/ui`**: Atomic design components (Button, Input, Card, Modal). Reused everywhere.
*   **`components/manager`**: Complex views specific to managers (e.g., `FilesExplorer`, `ClientOnboardingModal`).
*   **`components/sdr`**: SDR-specific components (likely `ActionPanel`, `ScriptViewer`).
*   **`components/email`**: Email client UI parts (`InboxLayout`, `ThreadView`, `EmailComposer`).
*   **`components/comms`**: Chat UI parts (`ThreadList`, `CommsInbox`).
*   **`components/dialogs`**: Global modals (e.g., `CSVImportDialog`).
*   **`components/guards`**: Security wrappers (`PermissionGuard`).

## `/prisma`
*   **`schema.prisma`**: The source of truth for data models. Defines ~40 models covering Users, CRM entities, Email machinery, and Comms.

---

# 4. File-by-File Analysis (Critical Selection)

## Configuration & Core
*   **`middleware.ts`**:
    *   **Type**: Next.js Middleware.
    *   **Responsibility**: Enforces `active` status and Role-Based Access Control (RBAC) on route prefixes (`/sdr`, `/manager`).
    *   **Risk**: Hardcoded paths. Needs to be kept in sync with file structure.
*   **`lib/auth.ts`**:
    *   **Type**: Utility / Config.
    *   **Responsibility**: Defines `authOptions` for NextAuth.
    *   **Key Logic**: `authorize` callback verifies password AND `isActive`. `jwt` and `session` callbacks persist `role` and `clientId` into the session.
*   **`lib/permissions/PermissionProvider.tsx`**:
    *   **Type**: React Context Provider.
    *   **Responsibility**: Fetches and caches granular permissions for the current user. Exposes `useHasPermission`.

## Manager Views (`app/manager`)
*   **`dashboard/page.tsx`**:
    *   **Role**: Manager.
    *   **Responsibility**: High-level KPIs. Fetches stats, active missions, recent files.
    *   **Interactions**: Calls `/api/stats`, `/api/missions`.
*   **`users/page.tsx`**:
    *   **Role**: Manager.
    *   **Responsibility**: User management.
    *   **Logic**: Complex state for "Edit User", "Manage Permissions". Optimistic UI updates for permission toggles.
*   **`missions/[id]/page.tsx`**:
    *   **Role**: Manager.
    *   **Responsibility**: Mission control center.
    *   **Logic**: Assign SDRs, pause/start mission. Aggregates data from multiple sub-relations.

## SDR Views (`app/sdr`)
*   **`action/page.tsx`**:
    *   **Role**: SDR.
    *   **Responsibility**: "The Cockpit" for cold calling/emailing.
    *   **Logic**: Heavy client-side logic. Fetches next lead, displays script, handles call outcome submission, triggers navigation to next lead.
    *   **Dependencies**: `ActionService` (implied frontend service).

## Shared Components
*   **`components/manager/files/FilesExplorer.tsx`**:
    *   **Type**: Component (Mega-Component).
    *   **Risk**: **CRITICAL**. ~67KB file size. Contains Folder tree, File list, Drag&Drop, Upload logic, Context menus all in one file. Difficult to maintain.
*   **`components/email/inbox/InboxLayout.tsx`**:
    *   **Type**: Layout Component.
    *   **Responsibility**: Structure for the Email Client (Sidebar + List + View).

---

# 5. Data Models & Schemas

### Core CRM
*   **`User`**: Base entity. Has `role` (Enum) and `isActive` (Bool). Relations to practically everything (files, tasks, missions).
*   **`Client`**: Top-level grouping. Has `Missions`, `Projects`.
*   **`Mission`**: Time-bound operational unit. Links `Client` ↔ `Campaigns` ↔ `SDRs`.
*   **`Campaign`**: Specific outreach strategy (e.g., "Cold Email Q1"). Contains `Scripts` and `Actions`.
*   **`Contact` / `Company`**: The targets. Grouped into `Lists`.

### Email Hub (Sophisticated)
*   **`Mailbox`**: Represents a connected email account (Gmail/Outlook/SMTP). Tracks sync status, health score, daily limits.
*   **`EmailThread` / `Email`**: Mirrored email data.
*   **`EmailSequence`**: Automation engine. Has `EmailSequenceStep` (templates, delays).
*   **`EmailSequenceEnrollment`**: Linking `Contact` to `Sequence`. Tracks progress.

### Internal Comms
*   **`CommsGroup` / `CommsChannel` / `CommsThread` / `CommsMessage`**: Slack-like structure stored in Postgres. Polymorphic association to Missions/Clients.

---

# 6. API Layer

The API is structured as Next.js Route Handlers (`app/api/.../route.ts`).

*   **`/api/auth/[...nextauth]`**: Handled by NextAuth library.
*   **`/api/users`**: CRUD for users. Protected (Manager only).
*   **`/api/missions`**:
    *   `GET`: List missions (filters supported).
    *   `POST`: Create mission.
*   **`/api/ai/mistral/script`**:
    *   `POST`: Accepts `icp`, `pitch`. Calls Mistral AI. Returns JSON script suggestions.
*   **`/api/email/accounts`**: Legacy endpoint (deprecated by Mailbox).
*   **`/api/files`**: Handles S3 presigned URLs or direct uploads.

**Security**: Most routes implement `getServerSession` checks. Some use a higher-order function `withErrorHandler` (seen in early file lists) for consistent error responses.

---

# 7. Role-Based Functional Coverage

| Feature | Manager | SDR | Business Dev |
| :--- | :---: | :---: | :---: |
| **User Mgmt** | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Missions** | ✅ Create/Edit/Delete | 👁️ Read Active | 👁️ Read Assigned |
| **Contacts** | ✅ Full Access | ✅ Edit (Enriched) | ✅ Edit (Assigned) |
| **Campaigns** | ✅ Full Access (AI) | 👁️ Read Scripts | 👁️ Read |
| **Emailing** | ✅ Full Access | ✅ Send Individual | ✅ Send Individual |
| **Files** | ✅ Full Access | ❌ Restricted | ✅ Read Only |
| **Billing** | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |

---

# 8. Permissions & Security

### System Design
1.  **AuthN**: JWT Tokens via NextAuth.
2.  **AuthZ (Route)**: Middleware checks `token.role`.
3.  **AuthZ (feature)**: `PermissionGuard` component wraps UI elements. Database stores `UserPermission` for overrides.

### Security Gaps
*   **API Granularity**: It is unclear if *every* API endpoint meticulously checks the *ownership* of resources (e.g., Can SDR A fetch Contact B if not assigned?). The `prisma` schema has relations, but the API implementation logic needs strict `where: { userId: currentUserId }` checks for SDRs.
*   **Token Invalidation**: JWTs are stateless. Banning a user (`isActive: false`) takes effect only on next refresh (or middleware check if implemented correctly). Middleware *does* check `token.isActive`, which is good, but token expiry dictates the window of vulnerability.

---

# 9. UX & Design System

*   **Design Tokens**: Tailwdin CSS v4 theme.
*   **Colors**: Slate (Neutral), Indigo (Primary), Semantic colors (Red/Emerald/Amber).
*   **Components**: Low-level generic components in `components/ui` ensure consistency.
*   **Feedback**: Extensive use of `Toast` for actions (Success/Error).
*   **Loading**: Skeleton screens used in `ClientDetails`, standard Spinners elsewhere.
*   **Responsiveness**: Grid layouts (`grid-cols-1 md:grid-cols-2`) used frequently. Mobile views are supported but desktop-first.

---

# 10. Performance & Scalability

### Strengths
*   **Server Components**: Next.js App Router reduces bundle size.
*   **Optimistic UI**: Used in Users and Email handling for perceived speed.
*   **Background Processing**: BullMQ offloads heavy tasks (Email Sync, CSV Import).

### Weaknesses / Bottlenecks
*   **`FilesExplorer`**: The massive component will be a rendering bottleneck.
*   **Large Lists**: `DataTable` component needs to support windowing (virtualization) if contact lists grow >1000 rows. Currently seems to rely on pagination.
*   **Database Constraints**: The `Email` table will grow effectively infinite. Postgres partitioning strategy will be needed eventually. No evidence of partitioning in `schema.prisma`.

---

# 11. Integrations

### AI (Mistral)
*   **Usage**: Script generation for Campaigns.
*   **Flow**: User Input -> API -> Mistral API -> JSON Response -> UI.
*   **Key File**: `api/ai/mistral/script/route.ts`.

### Email (Custom Engine)
*   **Usage**: Syncing heavy volumes of emails (Inbound/Outbound).
*   **Tech**: `imapflow` for IMAP, `nodemailer` for SMTP.
*   **Architecture**: Workers (`lib/email/queue/workers.ts`) run in background, consuming jobs from Redis. This decouples the UI from the slow email protocols.

### Google Drive
*   **Usage**: syncing folders between CRM and GDrive.
*   **Tech**: Google Drive API v3.
*   **Auth**: OAuth2 flow stored in `GoogleDriveSync` model.

---

# 12. Technical Debt Register

1.  **Monolithic UI Components**: `FilesExplorer.tsx` (67KB) is too large. Needs immediate refactoring.
2.  **Duplicated Logic**: Search/Filter logic is copy-pasted across `UsersPage`, `ProjectsPage`, `ClientsPage`. Needs a `<SearchFilterBar>` abstraction.
3.  **Complex State**: `PlanningPage` (Manager) has >700 lines of scheduling logic mixed with UI.
4.  **Schema Complexity**: The `User` model is becoming a "God Object" with too many direct relations.

---

# 13. Missing Features & Gaps

*   **Global Search**: No global search bar to jump to a specific contact/company from anywhere.
*   **Notifications**: Backend model exists (`Notification`), but no real-time WebSocket delivery (e.g., Pusher/Socket.io) observed in tech stack. Polling likely used.
*   **Analytics Visualization**: Currently relies on numbers/badges. No charts (Line/Bar) implemented despite `recharts` being in `package.json`.
*   **Audit Logging**: `EmailAuditLog` exists, but generic System Audit Log (who changed what permission) is missing.

---

# 14. Refactoring Opportunities

| Component | Action | Impact |
| :--- | :--- | :--- |
| `FilesExplorer` | Split into `FolderTree`, `FileList`, `UploadZone` | High (Maintainability) |
| `PlanningPage` | Extract Calendar Logic to custom hook | Medium (Readability) |
| Filter Bars | Create generic `FilterToolbar` | Medium (DRY) |
| API Routes | Standardize Error Handling Middleware | High (Reliability) |

---

# 15. Product Readiness Assessment

*   **Current State**: **Late Alpha / Early Beta**.
*   **Feature Completeness**: ~80%. Core flows (Prospecting, Emailing, Managing) work. Visualization and advanced settings are thin.
*   **Stability**: Good. Error handling and valid architecture preventing major crashes.
*   **Scalability**: **Pre-Scale**. The current architecture works for ~50 users. For >500 users, the Database interactions (Prisma includes) and Email Workers need optimization.

---

# 16. Final Verdict

### Technical Maturity Score: 7.5/10
Solid stack choice, professional directory structure, use of background queues shows seniority. Deductions for some monolithic components and UI duplication.

### Product Maturity Score: 7.0/10
Functional and aesthetically pleasing ("Premium" UI). Lacks the depth of analytics and configuration expected in Enterprise SaaS.

### Top 3 Priorities
1.  **Refactor `FilesExplorer`**: It is a ticking time bomb for bugs.
2.  **Implement Charts**: `recharts` is installed but unused. Managers need curves, not just numbers.
3.  **Optimize SDR Workflow**: Ensure the `ActionPage` loading time is <300ms via prefetching. This is the revenue-generating page.
