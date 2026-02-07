import { Suspense } from "react";
import { ShortenForm } from "@/components/shorten-form";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <>
      <Suspense>
        <ShortenForm />
      </Suspense>
      <Toaster richColors position="top-center" />
    </>
  );
}
