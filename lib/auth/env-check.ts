/**
 * Critical environment variables checker.
 * Validates existence of mandatory credentials on startup/import.
 */
export function validateEnv() {
  const required = [
    "NEXTAUTH_SECRET",
    "DATABASE_URL",
    "SHOPIFY_ADMIN_ACCESS_TOKEN",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(", ")}`;
    console.error(errorMsg);
    if (process.env.NODE_ENV === "production") {
      throw new Error(errorMsg);
    }
  }
}

// Auto-run on import to ensure fail-fast behavior
try {
  validateEnv();
} catch (e: any) {
  if (process.env.NODE_ENV === "production") {
    throw e;
  }
}
