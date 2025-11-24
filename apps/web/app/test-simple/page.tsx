/**
 * Simple test page for E2E testing
 * No SSE, no real-time features, just a basic page
 */

export default function TestSimplePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Test Simple Page</h1>
      <p className="text-gray-600 mb-4">This is a simple page for E2E testing.</p>
      <div data-testid="test-content" className="bg-blue-100 p-4 rounded">
        Test content loaded successfully
      </div>
      <button
        data-testid="test-button"
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Click Me
      </button>
    </div>
  )
}
