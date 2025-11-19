export default function AuthError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">
          There was a problem signing you in. Please try again.
        </p>
        <a
          href="/auth/signin"
          className="text-primary hover:underline"
        >
          Return to Sign In
        </a>
      </div>
    </div>
  );
}
