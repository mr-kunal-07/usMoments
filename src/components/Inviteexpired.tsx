import { useNavigate } from "react-router-dom";
import { HeartCrack, ArrowRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";


export default function InviteExpired() {
    const navigate = useNavigate();

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden px-4 py-10">

            {/* Subtle ambient blobs — matches Auth.tsx atmosphere */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
                <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-rose-500/5 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center text-center">

                {/* Brand */}
                <div className="flex items-center gap-2.5 mb-10">
                    <div className="h-10 w-10 rounded-xl overflow-hidden">
                        <img src="/logo.png" alt="" width={40} height={40} aria-hidden />
                    </div>
                    <h1 className="text-2xl font-semibold">
                        <span className="gradient-text">usMoments</span>
                    </h1>
                </div>

                {/* Card */}
                <div className="w-full bg-card border border-border rounded-2xl p-8 sm:p-10 shadow-sm">

                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className={cn(
                            "h-16 w-16 rounded-2xl flex items-center justify-center",
                            "bg-rose-500/10 border border-rose-500/20",
                        )}>
                            <HeartCrack className="h-7 w-7 text-rose-500" aria-hidden />
                        </div>
                    </div>

                    {/* Heading */}
                    <h2 className="text-xl font-bold font-heading mb-2">
                        This spot's already taken
                    </h2>
                    <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
                        This invite link has already been used.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        If you're the intended partner, just sign in to your account and you'll be connected already.
                    </p>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-7">
                        <div className="flex-1 h-px bg-border/60" />
                        <Heart className="h-3 w-3 text-border/60 shrink-0" aria-hidden />
                        <div className="flex-1 h-px bg-border/60" />
                    </div>

                    {/* CTA */}
                    <p className="text-sm text-muted-foreground mb-4">
                        Want to start your own couple space?
                    </p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => navigate("/auth", { state: { mode: "signin" } })}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 h-11 rounded-lg",
                                "bg-primary text-primary-foreground text-sm font-medium",
                                "hover:bg-primary/90 active:scale-[0.98] transition-all",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            )}
                        >
                            Sign in
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/auth", { state: { mode: "signup" } })}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 h-11 rounded-lg",
                                "border border-border bg-background text-foreground text-sm font-medium",
                                "hover:bg-accent/50 active:scale-[0.98] transition-all",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            )}
                        >
                            Create a new account
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-muted-foreground/60 mt-6 select-none">
                    Private. Secure. Just for us.
                </p>
            </div>
        </div>
    );
}



