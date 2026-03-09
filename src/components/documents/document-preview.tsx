'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getDocumentPreviewUrl, getDocumentDownloadUrl } from '@/actions/documents'
import { isPreviewable } from '@/lib/storage'
import { formatFileSize } from '@/lib/validations/document'
import { Download, ExternalLink, Loader2, FileText, X } from 'lucide-react'
import { toast } from 'sonner'

interface DocumentPreviewProps {
  documentId: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentPreview({
  documentId,
  fileName,
  fileType,
  fileSizeBytes,
  open,
  onOpenChange,
}: DocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canPreview = isPreviewable(fileType)

  useEffect(() => {
    if (!open || !canPreview) {
      setPreviewUrl(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    getDocumentPreviewUrl(documentId).then((result) => {
      if (result.error) {
        setError(result.error)
      } else {
        setPreviewUrl(result.data!.downloadUrl)
      }
      setLoading(false)
    })
  }, [open, documentId, canPreview])

  const handleDownload = async () => {
    const result = await getDocumentDownloadUrl(documentId)
    if (result.error) {
      toast.error(result.error)
      return
    }

    // Åbn download i nyt vindue
    window.open(result.data!.downloadUrl, '_blank')
  }

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              {canPreview && previewUrl && (
                <Button variant="ghost" size="sm" onClick={handleOpenInNewTab}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Åbn i ny fane
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {formatFileSize(fileSizeBytes)}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-gray-50">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">{error}</p>
              <Button variant="outline" className="mt-4" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download i stedet
              </Button>
            </div>
          ) : !canPreview ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">
                Forhåndsvisning ikke tilgængelig
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Denne filtype kan ikke forhåndsvises i browseren
              </p>
              <Button variant="outline" className="mt-4" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download fil
              </Button>
            </div>
          ) : fileType === 'application/pdf' && previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-full w-full"
              title={fileName}
            />
          ) : (fileType === 'image/png' || fileType === 'image/jpeg') && previewUrl ? (
            <div className="flex h-full items-center justify-center p-4">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}