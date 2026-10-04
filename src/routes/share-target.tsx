import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/share-target")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
