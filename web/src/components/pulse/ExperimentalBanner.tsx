import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * Top-of-page banner. Always visible — the demo is explicitly labeled as
 * experimental and not part of the shipped Polity product. This carries the
 * no-AI-synthesis / no-notifications spec boundary into the UI itself.
 */
export function ExperimentalBanner({ text }: { text: string }) {
  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <Info className="h-4 w-4" />
      <AlertTitle className="sr-only">Experimental preview</AlertTitle>
      <AlertDescription>
        <span className="font-medium">{text}</span>
      </AlertDescription>
    </Alert>
  );
}