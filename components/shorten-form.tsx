"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link2, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { shortenUrl } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ShortenResponse } from "@/lib/types";

/** Initial state before any submission */
const initialState: ShortenResponse = { success: false, error: "" };

export function ShortenForm() {
  const searchParams = useSearchParams();

  const [state, formAction, isPending] = useActionState(
    async (_prev: ShortenResponse, formData: FormData) => {
      return await shortenUrl(formData);
    },
    initialState
  );

  // Show a toast if redirected from a non-existent short code
  useEffect(() => {
    if (searchParams.get("error") === "not-found") {
      toast.error("That short link doesn't exist or has expired.");
      // Clean up the URL without a reload
      window.history.replaceState(null, "", "/");
    }
  }, [searchParams]);

  // Show toast notifications on state changes
  useEffect(() => {
    if (state.success) {
      toast.success("URL shortened!", {
        description: state.shortUrl,
      });
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Snip
          </CardTitle>
          <CardDescription>
            Paste a long URL and get a short, shareable link instantly.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── URL Input Form ─────────────────────────────── */}
          <form action={formAction} className="flex gap-2">
            <Input
              name="url"
              type="url"
              placeholder="https://example.com/very/long/url..."
              required
              disabled={isPending}
              autoFocus
              className="flex-1"
            />
            <Button type="submit" disabled={isPending} className="shrink-0">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Shorten"
              )}
            </Button>
          </form>

          {/* ── Result Card ────────────────────────────────── */}
          {state.success && <ResultDisplay shortUrl={state.shortUrl} />}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Result sub-component ──────────────────────────────────────

function ResultDisplay({ shortUrl }: { shortUrl: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    toast.success("Copied to clipboard!");
  }, [shortUrl]);

  // Auto-reset the "copied" icon after 2 seconds
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Your shortened URL
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate text-sm font-semibold text-primary">
          {shortUrl}
        </code>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          asChild
        >
          <a href={shortUrl} target="_blank" rel="noopener noreferrer" title="Open link">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
