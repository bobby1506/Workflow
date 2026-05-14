"use client";

import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { TriggerAuthContext } from "@trigger.dev/react-hooks";
import type { ApiClientConfiguration } from "@trigger.dev/core/v3";

export default function ClientProviders({
  children,
  accessToken,
}: Readonly<{
  children: React.ReactNode;
  accessToken?: string | null;
}>) {
  const triggerConfig: ApiClientConfiguration | undefined = accessToken
    ? { accessToken }
    : undefined;

  return (
    <ClerkProvider>
      <TriggerAuthContext.Provider value={triggerConfig}>
        {children}
      </TriggerAuthContext.Provider>
    </ClerkProvider>
  );
}
