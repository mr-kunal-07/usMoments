import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
    open: boolean;
    title?: string;
    description?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
}

export function DeleteConfirmDialog({
    open,
    title = "Delete milestone?",
    description = "This action cannot be undone.",
    onConfirm,
    onCancel,
    isPending = false,
}: DeleteConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="font-heading text-base">{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel} disabled={isPending}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}