'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RealtimeArtifactViewer } from '@/components/contracts/RealtimeArtifactViewer'

export default function TestUploadPage() {
  const [contractId, setContractId] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    console.log(msg)
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const handleUpload = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.txt,.doc,.docx'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      addLog(`Selected file: ${file.name}`)
      setUploading(true)
      setError('')
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('dataMode', 'real')
        formData.append('ocrMode', 'mistral')

        addLog('Uploading...')
        const response = await fetch('/api/contracts/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'x-tenant-id': 'demo'
          }
        })

        addLog(`Upload response status: ${response.status}`)
        
        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Upload failed: ${response.status} - ${text}`)
        }

        const data = await response.json()
        addLog(`Upload successful: ${JSON.stringify(data)}`)
        
        if (data.contractId) {
          addLog(`Contract ID: ${data.contractId}`)
          setContractId(data.contractId)
        } else {
          throw new Error('No contract ID in response')
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed'
        addLog(`ERROR: ${errorMsg}`)
        setError(errorMsg)
      } finally {
        setUploading(false)
      }
    }
    
    input.click()
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Upload Test Page</h1>
      
      <Card>
        <CardContent className="pt-6">
          <Button 
            onClick={handleUpload} 
            disabled={uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Select File to Upload'}
          </Button>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {contractId && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Contract ID: {contractId}</h2>
            <RealtimeArtifactViewer
              contractId={contractId}
              onComplete={() => addLog('✅ Processing complete!')}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Debug Logs:</h3>
          <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto font-mono text-sm space-y-1">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
            {logs.length === 0 && <div className="text-gray-400">No logs yet...</div>}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLogs([])}
            className="mt-2"
          >
            Clear Logs
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
