import Link from "next/link";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Custom 404 — shown when a short code doesn't exist
 * or the user navigates to a non-existent page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Link2 className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground">
          This short link doesn&apos;t exist or has expired.
        </p>
      </div>

      <Button asChild>
        <Link href="/">← Shorten a new URL</Link>
      </Button>
    </div>
  );
}
