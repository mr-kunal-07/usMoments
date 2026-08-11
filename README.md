  # 💕 usMoments
   
> A private, couples-only digital vault — store memories, chat securely, and celebrate your relationship milestones together.
   
--

## 📖 Overview
 
usMoments is a full-stack couples-only web application that acts as a private shared space for two partners. It combines a secure media vault, end-to-end encrypted real-time chat, relationship timeline, anniversary tracking, a shared bucket list, and a premium subscription system — all within a beautiful, installable Progressive Web App.
 
--
 
## ✨ Features

### 🔐 Authentication & Partner Linking
- Email/password sign-up and sign-in via Supabase Auth
- Email verification required before access
- Password reset via email link
- **Couple linking** via unique 8-character invite codes (or shareable invite links)
- Permanent one-to-one partner bond (`couples` table with `pending` / `active` status)
- Partners share all vault data once linked

---

### 🖼️ Media Vault
- Upload **photos and videos** (up to 500MB per file)
- Automatic **EXIF metadata extraction** (`exifr`) — captures `taken_at` date from camera data
- **Folder system** with nested sub-folders and emoji labels
- **Grid and List view** modes (persisted to localStorage)
- **Sort** by Date, Name, or File Size (asc/desc, persisted)
- **Search** by file title
- **Filter** by type: All / Images / Videos
- **Star** any file for quick access in Starred view
- **Soft-delete** with 14-day trash retention (`deleted_at` column) before permanent removal
- **Recently Deleted** view with restore functionality
- Drag-and-drop file upload directly onto the main area
- Real-time toast notification when partner uploads a new file

---

### 🔍 Media Preview
- Full-screen **lightbox** with dark overlay
- Native **video player** with controls
- **Keyboard navigation** (arrow keys, Escape)
- **Swipe navigation** on mobile
- **Download** file directly
- **Copy shareable link**
- Attach **Love Notes** (E2E encrypted notes per photo/video)
- Apply **colour-coded Tags** to any media item
- Add **Emoji reactions** (❤️, 😍, 😂, etc.)

---

### 🧠 Memories & Timeline
- **Memories Timeline** — chronological Google Photos-style scroll of all media
- **On This Day** — surfaces memories from previous years on the current calendar date
- **Anniversaries & Milestones** view with countdown rings to upcoming dates
- **Milestone Calendar** — visualises all events in a monthly calendar
- Create custom milestones with title, description, date, type, and optional linked media
- Milestone types: `anniversary`, `milestone`, `birthday`, etc.

---

### 🪣 Bucket List
- Shared bucket list between both partners
- **Categories**: adventure, travel, food, romance, home, health, learning, other
- Add **due dates** and optional **notes** per item
- **Mark as done** with optional completion photo URL
- **Emoji reactions** on each item (per user)
- Couple-scoped RLS — only active partners can view/edit

---

### 💬 Encrypted Chat
- **End-to-End Encrypted** using **AES-256-GCM** (keys derived per couple via PBKDF2, 100,000 iterations — never stored on server)
- WhatsApp-style bubble UI with day groupers (Today / Yesterday / Date)
- **Voice messages** — record in-app, stored in Supabase Storage, with waveform player
- **Real-time delivery** via Supabase Realtime (Postgres changes)
- **Typing indicators** — live "Partner is typing…" banner
- **Online presence** — green dot when partner is active
- **Read receipts** — single tick (sent) / double tick (read)
- **Reply-to** — swipe right on mobile or click reply icon on desktop
- **Emoji reactions** — long-press (mobile) or hover (desktop) to react
- **Select mode** — tap to multi-select messages, delete in bulk
- Either partner can delete any message (both sides cleared)
- **Auto-purge**: all messages older than 24 hours are permanently deleted daily at 3 AM UTC via `pg_cron` + Edge Function

---

### 📊 Activity Feed
- Unified feed of partner activity: uploads, love notes, reactions, new milestones
- Chronological with relative timestamps

---

### 🔔 Notifications
- Real-time bell icon with unread badge
- Notification types: uploads, reactions, love notes, milestones
- Mark all as read

---

### 📅 Days Together Widget
- Animated counter showing exact days the couple has been together
- Progress ring with milestone targets (100, 365, 1000 days)
- Available on premium plans

---

### 🔒 App Lock
- Optional **PIN lock** (4-digit, stored hashed in localStorage)
- Optional **Biometric lock** via **WebAuthn API** (fingerprint / Face ID)
- App auto-locks after **15 seconds** of being backgrounded (tab hidden)
- Lock screen shown on app open if a method is configured
- Fallback: biometric failure → PIN entry

---

### 💳 Billing & Subscriptions
Payments processed via **Razorpay** (India).

| Plan | Price | Storage | Uploads | Voice / Reactions |
|------|-------|---------|---------|-------------------|
| **Single** (Free) | ₹0 | 50 + 50 shared / mo | Limited | ❌ |
| **Dating** | ₹29/mo | 10 GB shared | Unlimited | ✅ |
| **Soulmate** | ₹99/mo | 50 GB shared | Unlimited | ✅ |

- Couple storage pool — both partners share the plan's storage
- Plan shared automatically when partner links (on paid plans)
- Subscription records stored in `subscriptions` table with Razorpay order/payment IDs
- Razorpay signature verified server-side in Edge Function before plan activation

---

### ⚙️ Settings
- Edit **display name** and upload **avatar** (stored in Supabase Storage)
- Toggle **dark / light theme** (persisted in localStorage)
- Configure or remove **App Lock** (PIN / Biometric)
- View current plan and navigate to Billing
- **PWA install** button (shown when browser install prompt available)
- **Sign out**

---

### 🛡️ Admin Panel
- Accessible only to users with `admin` role in `user_roles` table
- **User management table** — search, filter, change plans, toggle admin, delete users
- **Statistics overview** — total users, paid users, storage usage, plan distribution chart
- **Audit log** — every plan change recorded in `plan_audit_log` with actor, target, old/new plan, timestamp

---

### 📱 Progressive Web App (PWA)
- Installable on iOS, Android, and Desktop
- Service worker for offline caching of app shell
- Custom 192×192 and 512×512 icons
- `manifest.json` with theme colour

---

## 🏗️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Component library (Radix UI) |
| Radix UI | various | Accessible primitives |

### State & Data
| Technology | Version | Purpose |
|---|---|---|
| TanStack React Query | v5 | Server state, caching, invalidation |
| React Router | v6 | Client-side routing |
| React Hook Form | v7 | Form state management |
| Zod | v3 | Schema validation |

### UI & Media
| Technology | Purpose |
|---|---|
| Native UI components | Admin stats and progress summaries |
| date-fns | Date formatting and arithmetic |
| exifr | EXIF metadata extraction from photos |
| embla-carousel | Carousel (slideshow) |
| Vaul | Mobile drawer component |
| Lucide React | Icon library |
| Sonner | Toast notifications |

### Backend (Supabase)
| Service | Usage |
|---|---|
| PostgreSQL | Primary database (all tables below) |
| Supabase Auth | Email/password authentication |
| Supabase Storage | Media files, voice messages, avatars |
| Supabase Realtime | Chat messages, typing, presence |
| Edge Functions (Deno) | Razorpay orders/verification, admin ops, message purge |
| Row-Level Security | Data isolation per user/couple |
| pg_cron | Scheduled jobs (3 AM UTC purge) |

### Payments & Security
| Technology | Purpose |
|---|---|
| Razorpay | Indian payment gateway |
| AES-256-GCM | Client-side E2E message encryption |
| PBKDF2 | Per-couple key derivation (100,000 iterations) |
| WebAuthn | Biometric app lock (fingerprint / Face ID) |

### DevOps & PWA
| Technology | Purpose |
|---|---|
| vite-plugin-pwa | Service worker + manifest generation |
| Vitest | Unit testing |
| ESLint | Code linting |

---

## 🗄️ Database Schema

All tables live in the `public` schema with Row-Level Security enabled.

| Table | Description |
|---|---|
| `profiles` | User display name and avatar URL (linked to auth user by `user_id`) |
| `couples` | Partner pair with invite code and `pending`/`active` status |
| `media` | All uploaded files (photos/videos) with EXIF metadata and soft-delete |
| `folders` | Nested folder structure for organising media |
| `media_reactions` | Emoji reactions on media items |
| `media_tags` | Many-to-many link between media and tags |
| `tags` | User-created colour-coded tags |
| `love_notes` | Encrypted notes attached to media items |
| `messages` | Chat messages with E2E encrypted content |
| `message_reactions` | Emoji reactions on chat messages |
| `milestones` | Relationship milestones and anniversaries |
| `bucket_list` | Shared couple bucket list items |
| `bucket_list_reactions` | Reactions on bucket list items |
| `notifications` | In-app notifications for partner activity |
| `subscriptions` | User subscription records with Razorpay IDs |
| `plan_audit_log` | Admin audit trail for plan changes |
| `user_roles` | Role assignments (`admin` / `user`) |

### Database Functions
| Function | Description |
|---|---|
| `get_partner_id(_user_id)` | Returns the partner's user ID for a given user |
| `get_user_plan(_user_id)` | Returns the effective subscription plan |
| `accept_couple_invite(_invite_code)` | Atomically links two partners |
| `has_role(_user_id, _role)` | Security-definer role check (prevents RLS recursion) |

---

## 🔐 Security Architecture

### End-to-End Encryption (Chat & Love Notes)
```
1. Key Derivation: PBKDF2(coupleId + APP_SALT, 100,000 iterations) → AES-256 CryptoKey
2. Encryption:     AES-256-GCM(plaintext, random 96-bit IV) → base64("enc:" + IV + ciphertext)
3. Decryption:     base64 decode → split IV + ciphertext → AES-GCM decrypt
4. Storage:        Only ciphertext stored in DB — keys never leave the client
```

### Row-Level Security
- Every table has RLS enabled
- Couple-scoped policies use `get_partner_id()` (a `SECURITY DEFINER` function) to avoid recursive RLS
- Admin policies use `has_role()` (also `SECURITY DEFINER`)
- Service-role-only access for subscription management

### App Lock
- PIN stored as plaintext in `localStorage` under `usMoments_pin` (device-local, never synced)
- Biometric credential stored via WebAuthn browser API
- Lock triggers on `visibilitychange` after ≥ 15 seconds in background
- Lock triggers immediately when a new method is set in Settings

---

## 🚀 Local Development

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Setup
```sh
# 1. Clone the repo
git clone <YOUR_GIT_URL>
cd usMoments

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

The app connects to the hosted Supabase project automatically via the embedded anon key in `.env`.

### Available Scripts
```sh
npm run dev          # Start Vite dev server (hot reload)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

---

## ⚡ Edge Functions

Deployed automatically to Supabase as Deno serverless functions:

| Function | Description | Auth Required |
|---|---|---|
| `razorpay-create-order` | Creates a Razorpay order for a subscription plan | JWT (user) |
| `razorpay-verify-payment` | Verifies Razorpay payment signature and activates plan | JWT (user) |
| `admin-list-users` | Lists all users with profile and subscription data | Admin role |
| `admin-manage-user` | Update plan / toggle admin / delete user | Admin role |
| `admin-audit-log` | Returns enriched plan audit log | Admin role |
| `purge-old-messages` | Deletes messages + audio > 24h old (pg_cron 3 AM UTC) | Service role |
| `purge-deleted-media` | Permanently removes soft-deleted media > 14 days old | Service role |

---

## 📁 Project Structure

```
src/
├── components/          # Feature components (Chat, Media, Billing, etc.)
│   └── ui/              # shadcn/ui primitives
├── hooks/               # Custom React hooks (data fetching, auth, state)
├── integrations/
│   └── supabase/        # Auto-generated client & types
├── lib/                 # Utilities (crypto, query keys, cn)
├── pages/               # Route-level pages (Dashboard, Auth, Admin, etc.)
└── assets/              # Static images

supabase/
├── functions/           # Edge Functions (Deno)
└── config.toml          # Supabase project config
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feat/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © usMoments
