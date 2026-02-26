"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkProps {
  userId: string;
  onSuccess?: () => void;
  onExit?: () => void;
}

export default function PlaidLink({ userId, onSuccess, onExit }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate link token on component mount
  useEffect(() => {
    async function createLinkToken() {
      try {
        setLoading(true);
        const response = await fetch("/api/plaid/create-link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          throw new Error("Failed to create link token");
        }

        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (err: unknown) {
        console.error("Error creating link token:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    createLinkToken();
  }, [userId]);

  const onPlaidSuccess = useCallback(
    async (public_token: string) => {
      try {
        setLoading(true);
        // Exchange public token for access token
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, userId }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange token");
        }

        const data = await response.json();
        console.log("Bank connected successfully:", data);

        if (onSuccess) {
          onSuccess();
        }
      } catch (err: unknown) {
        console.error("Error exchanging token:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [userId, onSuccess]
  );

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err: unknown) => {
      if (err) {
        console.error("Plaid Link exited with error:", err);
      }
      if (onExit) {
        onExit();
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error: {error}</p>
        <p className="mt-2 text-xs text-red-600">
          Make sure your Plaid credentials are configured in .env.local
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {loading ? "Connecting..." : ready ? "Connect Bank Account" : "Loading..."}
    </button>
  );
}
