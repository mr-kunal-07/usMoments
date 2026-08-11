import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useIsAdmin, useAdminUsers, useAdminManageUser,
  useAdminAuditLog, AdminUser, PlanAuditEntry,
} from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Search, Users, TrendingUp, HardDrive,
  MoreHorizontal, RefreshCw, ShieldCheck, ShieldOff, Trash2,
  Sprout, HeartHandshake, Gem, UserCircle2, Heart, Upload,
  History, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isValid } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanKey = "single" | "dating" | "soulmate";
type PlanFilter = "all" | PlanKey;

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_CONFIG: Record<PlanKey, {
  label: string;
  Icon: React.ElementType;
  color: string;
  price: string;
}> = {
  single: { label: "Single", Icon: Sprout, color: "text-muted-foreground", price: "Free" },
  dating: { label: "Dating", Icon: HeartHandshake, color: "text-primary", price: "₹9/mo" },
  soulmate: { label: "Soulmate", Icon: Gem, color: "text-amber-500", price: "₹99/mo" },
};

const PLAN_FILTERS: PlanFilter[] = ["all", "single", "dating", "soulmate"];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  if (b < 1_048_576) return (b / 1_024).toFixed(1) + " KB";
  if (b < 1_073_741_824) return (b / 1_048_576).toFixed(1) + " MB";
  return (b / 1_073_741_824).toFixed(2) + " GB";
}

function safeDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isValid(d) ? d : null;
}

function safePlan(plan: string | null | undefined): PlanKey {
  if (plan === "dating" || plan === "soulmate") return plan;
  return "single";
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanBadge({ plan, isShared }: { plan: string | null; isShared?: boolean }) {
  const key = safePlan(plan);
  const cfg = PLAN_CONFIG[key];
  return (
    <Badge
      variant={key === "single" ? "secondary" : "outline"}
      className={cn("gap-1 text-xs font-medium shrink-0", cfg.color, key !== "single" && "border-primary/30")}
    >
      <cfg.Icon className="h-3 w-3" strokeWidth={1.75} />
      {cfg.label}
      {isShared && <span title="Shared from partner" className="opacity-60 text-[9px]">❤️</span>}
    </Badge>
  );
}

function StatCard({
  label, value, sub, Icon, highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  Icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 sm:p-5 flex items-start gap-3 sm:gap-4",
      highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card",
    )}>
      <div className={cn(
        "h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0",
        highlight ? "bg-primary/15" : "bg-muted",
      )}>
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", highlight ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold font-heading text-foreground leading-none">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm font-medium">{title}</p>
      {sub && <p className="text-xs opacity-60 text-center max-w-xs">{sub}</p>}
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin", className)} />
  );
}

function UserAvatar({ name, email, avatarUrl, size = "sm" }: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "xs";
}) {
  const initials = ((name ?? email ?? "?").slice(0, 2)).toUpperCase();
  const dim = size === "sm" ? "h-7 w-7" : "h-6 w-6";
  const text = size === "sm" ? "text-[10px]" : "text-[9px]";
  return (
    <Avatar className={cn(dim, "shrink-0")}>
      {avatarUrl && <AvatarImage src={avatarUrl} />}
      <AvatarFallback className={text}>{initials}</AvatarFallback>
    </Avatar>
  );
}

// ─── Plan change dropdown content (DRY — shared by user rows) ─────────────────

function PlanMenuItems({
  currentPlan,
  onSelect,
}: {
  currentPlan: string | null;
  onSelect: (plan: PlanKey) => void;
}) {
  return (
    <>
      <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Change plan
      </p>
      {(Object.entries(PLAN_CONFIG) as [PlanKey, typeof PLAN_CONFIG[PlanKey]][]).map(([key, cfg]) => (
        <DropdownMenuItem
          key={key}
          onClick={() => onSelect(key)}
          className={cn("gap-2 text-xs capitalize", safePlan(currentPlan) === key && "text-primary font-medium")}
        >
          <cfg.Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {cfg.label}
          {safePlan(currentPlan) === key && <span className="ml-auto text-[10px] opacity-60">current</span>}
        </DropdownMenuItem>
      ))}
    </>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

// ─── Access denied ────────────────────────────────────────────────────────────

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h1 className="text-xl font-bold font-heading text-foreground">Access denied</h1>
        <p className="text-sm text-muted-foreground mt-1">You don't have admin privileges.</p>
      </div>
      <Button variant="outline" onClick={onBack}>Go back</Button>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ users }: { users: AdminUser[] }) {
  const totalUsers = users.length;
  const datingCount = users.filter(u => u.plan === "dating").length;
  const soulmateCount = users.filter(u => u.plan === "soulmate").length;
  const singleCount = totalUsers - datingCount - soulmateCount;
  const paidCount = datingCount + soulmateCount;
  const totalStorage = users.reduce((acc, u) => acc + (u.storage_used ?? 0), 0);
  const couplesCount = users.filter(u => u.has_partner).length;

  const recentUsers = useMemo(
    () => [...users]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [users],
  );

  const breakdown = [
    { key: "single", count: singleCount, label: `Single — Free` },
    { key: "dating", count: datingCount, label: `Dating — ₹9/mo` },
    { key: "soulmate", count: soulmateCount, label: `Soulmate — ₹99/mo` },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total users" value={totalUsers} Icon={Users} />
        <StatCard
          label="Paid users"
          value={paidCount}
          sub={`${pct(paidCount, totalUsers)}% conversion`}
          Icon={TrendingUp}
          highlight
        />
        <StatCard label="Total storage" value={formatBytes(totalStorage)} Icon={HardDrive} />
        <StatCard label="Coupled users" value={couplesCount} Icon={Heart} />
      </div>

      {/* Plan breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold font-heading text-foreground">Plan breakdown</h3>
        <div className="space-y-3">
          {breakdown.map(({ key, count, label }) => {
            const cfg = PLAN_CONFIG[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <cfg.Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                <span className="text-xs sm:text-sm text-muted-foreground w-36 sm:w-40 shrink-0 truncate">{label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${pct(count, totalUsers)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground w-6 text-right shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent signups */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold font-heading text-foreground">Recent signups</h3>
        </div>
        <div className="divide-y divide-border">
          {recentUsers.map(u => {
            const d = safeDate(u.created_at);
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 sm:px-6 py-3">
                <UserAvatar name={u.display_name} email={u.email} avatarUrl={u.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{u.display_name ?? u.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {d ? formatDistanceToNow(d, { addSuffix: true }) : "—"}
                  </p>
                </div>
                <PlanBadge plan={u.plan} isShared={u.is_shared_plan} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({
  users,
  isLoading,
  onPlanChange,
  onToggleAdmin,
  onDelete,
}: {
  users: AdminUser[];
  isLoading: boolean;
  onPlanChange: (userId: string, plan: PlanKey) => void;
  onToggleAdmin: (u: AdminUser, make: boolean) => void;
  onDelete: (u: AdminUser) => void;
}) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || u.email?.toLowerCase().includes(q)
      || u.display_name?.toLowerCase().includes(q);
    const matchPlan = planFilter === "all" || safePlan(u.plan) === planFilter;
    return matchSearch && matchPlan;
  }), [users, search, planFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted shrink-0 overflow-x-auto">
          {PLAN_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setPlanFilter(f)}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap",
                planFilter === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Desktop header — hidden on mobile */}
        <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30">
          {["User", "Plan", "Storage", "Uploads", "Joined", ""].map((h, i) => (
            <p key={i} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserCircle2} title="No users found" />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(u => {
              const joined = safeDate(u.created_at);
              return (
                <div key={u.id} className="hover:bg-muted/20 transition-colors">
                  {/* Mobile layout */}
                  <div className="sm:hidden flex items-center gap-3 px-4 py-3">
                    <UserAvatar name={u.display_name} email={u.email} avatarUrl={u.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-medium text-foreground truncate">
                          {u.display_name ?? <span className="italic text-muted-foreground">No name</span>}
                        </p>
                        {u.is_admin && <ShieldCheck className="h-3 w-3 text-primary shrink-0" />}
                        {u.has_partner && <Heart className="h-3 w-3 text-primary fill-primary shrink-0" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <PlanBadge plan={u.plan} isShared={u.is_shared_plan} />
                        <span className="text-[10px] text-muted-foreground">{formatBytes(u.storage_used ?? 0)}</span>
                      </div>
                    </div>
                    <UserActionsMenu
                      user={u}
                      onPlanChange={plan => onPlanChange(u.id, plan)}
                      onToggleAdmin={onToggleAdmin}
                      onDelete={onDelete}
                    />
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center">
                    {/* User */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar name={u.display_name} email={u.email} avatarUrl={u.avatar_url} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {u.display_name ?? <span className="italic text-muted-foreground">No name</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                      {u.has_partner && <Heart className="h-3 w-3 text-primary fill-primary shrink-0" />}
                      {u.is_admin && <ShieldCheck className="h-3 w-3 text-primary shrink-0" />}
                    </div>

                    <PlanBadge plan={u.plan} isShared={u.is_shared_plan} />
                    <p className="text-xs text-muted-foreground">{formatBytes(u.storage_used ?? 0)}</p>

                    <div className="flex items-center gap-1">
                      <Upload className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{u.upload_count ?? 0}</p>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {joined ? format(joined, "MMM d, yyyy") : "—"}
                    </p>

                    <UserActionsMenu
                      user={u}
                      onPlanChange={plan => onPlanChange(u.id, plan)}
                      onToggleAdmin={onToggleAdmin}
                      onDelete={onDelete}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-4 sm:px-5 py-3 border-t border-border bg-muted/10">
          <p className="text-[11px] text-muted-foreground">
            Showing {filtered.length} of {users.length} users
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── User actions dropdown (DRY) ──────────────────────────────────────────────

function UserActionsMenu({
  user: u,
  onPlanChange,
  onToggleAdmin,
  onDelete,
}: {
  user: AdminUser;
  onPlanChange: (plan: PlanKey) => void;
  onToggleAdmin: (u: AdminUser, make: boolean) => void;
  onDelete: (u: AdminUser) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <PlanMenuItems currentPlan={u.plan} onSelect={onPlanChange} />
        <DropdownMenuSeparator />
        {u.is_admin ? (
          <DropdownMenuItem
            className="gap-2 text-xs text-destructive/70 focus:text-destructive"
            onClick={() => onToggleAdmin(u, false)}
          >
            <ShieldOff className="h-3.5 w-3.5" /> Remove admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => onToggleAdmin(u, true)}>
            <ShieldCheck className="h-3.5 w-3.5" /> Make admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-xs text-destructive focus:text-destructive"
          onClick={() => onDelete(u)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Audit log tab ────────────────────────────────────────────────────────────

function AuditTab({
  logs,
  isLoading,
}: {
  logs: PlanAuditEntry[];
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every plan change made by admins is recorded here.
      </p>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Desktop header */}
        <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_2fr_1.5fr] gap-4 px-5 py-3 border-b border-border bg-muted/30">
          {["User", "From", "To", "Changed by", "When"].map((h, i) => (
            <p key={i} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</p>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No plan changes yet"
            sub="Changes will appear here when an admin updates a user's plan."
          />
        ) : (
          <div className="divide-y divide-border">
            {logs.map(entry => {
              const target = entry.target_user;
              const changer = entry.changed_by_user;
              const targetName = target?.display_name ?? target?.email ?? entry.target_user_id.slice(0, 8);
              const changerName = changer?.display_name ?? changer?.email ?? entry.changed_by_user_id.slice(0, 8);
              const changedAt = safeDate(entry.changed_at);

              return (
                <div key={entry.id} className="hover:bg-muted/20 transition-colors">
                  {/* Mobile layout */}
                  <div className="sm:hidden px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={target?.display_name} email={target?.email} avatarUrl={target?.avatar_url} size="xs" />
                      <p className="text-xs font-medium text-foreground truncate">{targetName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.old_plan
                        ? <PlanBadge plan={entry.old_plan} />
                        : <span className="text-[11px] text-muted-foreground italic">none</span>}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <PlanBadge plan={entry.new_plan} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar name={changer?.display_name} email={changer?.email} avatarUrl={changer?.avatar_url} size="xs" />
                        <p className="text-[10px] text-muted-foreground truncate">{changerName}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">
                        {changedAt ? formatDistanceToNow(changedAt, { addSuffix: true }) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_2fr_1.5fr] gap-4 px-5 py-3.5 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={target?.display_name} email={target?.email} avatarUrl={target?.avatar_url} size="xs" />
                      <p className="text-xs font-medium text-foreground truncate">{targetName}</p>
                    </div>
                    <div>
                      {entry.old_plan
                        ? <PlanBadge plan={entry.old_plan} />
                        : <span className="text-[11px] text-muted-foreground italic">none</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <PlanBadge plan={entry.new_plan} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={changer?.display_name} email={changer?.email} avatarUrl={changer?.avatar_url} size="xs" />
                      <p className="text-xs text-muted-foreground truncate">{changerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {changedAt ? formatDistanceToNow(changedAt, { addSuffix: true }) : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {changedAt ? format(changedAt, "MMM d, HH:mm") : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {logs.length > 0 && (
          <div className="px-4 sm:px-5 py-3 border-t border-border bg-muted/10">
            <p className="text-[11px] text-muted-foreground">
              Showing {logs.length} most recent changes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete confirm dialog (DRY) ──────────────────────────────────────────────

function DeleteDialog({
  target,
  onConfirm,
  onCancel,
}: {
  target: AdminUser | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={!!target} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{" "}
            <strong>{target?.display_name ?? target?.email}</strong> and all their data.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Admin page ──────────────────────────────────────────────────────────

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: users = [], isLoading: usersLoading, refetch } = useAdminUsers();
  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useAdminAuditLog();
  const manageUser = useAdminManageUser();
  const { toast } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // ── Mutation handlers ──────────────────────────────────────────────────────

  const handlePlanChange = useCallback(async (userId: string, plan: PlanKey) => {
    try {
      await manageUser.mutateAsync({ target_user_id: userId, action: "update_plan", plan });
      await refetch();
      toast({ title: `Plan updated to ${PLAN_CONFIG[plan].label}` });
    } catch {
      toast({ title: "Failed to update plan", variant: "destructive" });
    }
  }, [manageUser, refetch, toast]);

  const handleToggleAdmin = useCallback(async (u: AdminUser, makeAdmin: boolean) => {
    try {
      await manageUser.mutateAsync({ target_user_id: u.id, action: "toggle_admin", add: makeAdmin });
      await refetch();
      toast({ title: makeAdmin ? `${u.display_name ?? u.email} is now admin` : "Admin role removed" });
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" });
    }
  }, [manageUser, refetch, toast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await manageUser.mutateAsync({ target_user_id: deleteTarget.id, action: "delete_user" });
      setDeleteTarget(null);
      await refetch();
      toast({ title: "User deleted" });
    } catch {
      toast({ title: "Failed to delete user", variant: "destructive" });
      setDeleteTarget(null);
    }
  }, [deleteTarget, manageUser, refetch, toast]);

  const handleRefreshAll = useCallback(() => {
    refetch();
    refetchAudit();
  }, [refetch, refetchAudit]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (adminLoading) return <FullScreenLoader />;
  if (!isAdmin) return <AccessDenied onBack={() => navigate("/dashboard")} />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-3 sm:px-8 h-14 flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate("/dashboard")}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-bold font-heading text-sm text-foreground">Admin</span>
        </div>

        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 hidden sm:flex truncate max-w-[200px]">
          {user?.email}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8"
            onClick={handleRefreshAll}
            title="Refresh all"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (usersLoading || auditLoading) && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="overview" className="flex-1 sm:flex-none">Overview</TabsTrigger>
            <TabsTrigger value="users" className="flex-1 sm:flex-none">
              Users
              <span className="ml-1.5 text-[10px] opacity-60">({users.length})</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-1 sm:flex-none gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">History</span>
              {auditLogs.length > 0 && (
                <span className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 leading-none py-0.5">
                  {auditLogs.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewTab users={users} />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UsersTab
              users={users}
              isLoading={usersLoading}
              onPlanChange={handlePlanChange}
              onToggleAdmin={handleToggleAdmin}
              onDelete={setDeleteTarget}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-0">
            <AuditTab logs={auditLogs} isLoading={auditLoading} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete dialog */}
      <DeleteDialog
        target={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}