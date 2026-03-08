'use client'

import { useState } from 'react'
import { AlertCircle, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DocumentPreviewProps {
  url: string
  fileType: string
  fileName: string
}

export function DocumentPreview({ url, fileType, fileName }: DocumentPreviewProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [loadError, setLoadError] = useState(false)

  const isPdf = fileType === 'application/pdf'
  const isImage = fileType.startsWith('image/')

  if (loadError) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-gray-100 bg-white">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm text-gray-600">
            Preview kunne ikke indlæses
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Download filen for at åbne den i dit standardprogram
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      {/* Preview-toolbar (kun for billeder) */}
      {isImage && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
          <span className="flex-1 text-sm text-gray-500 truncate">{fileName}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
            title="Zoom ud"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-12 text-center text-xs text-gray-500">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale((s) => Math.min(4, s + 0.25))}
            title="Zoom ind"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotér"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* PDF preview */}
      {isPdf && (
        <div className="relative h-[700px] w-full">
          <iframe
            src={`${url}#toolbar=1&navpanes=1`}
            className="h-full w-full"
            title={fileName}
            onError={() => setLoadError(true)}
          />
        </div>
      )}

      {/* Billed-preview */}
      {isImage && (
        <div className="flex min-h-64 items-center justify-center overflow-auto p-4 bg-gray-50">
          <img
            src={url}
            alt={fileName}
            className="max-w-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            onError={() => setLoadError(true)}
          />
        </div>
      )}
    </div>
  )
}