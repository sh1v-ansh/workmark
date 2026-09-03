'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import Button from '@/components/ui/Button'

export function RestoreButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function restore() {
    setBusy(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not restore the account.')
      toast('Your account is back.', 'success')
      router.replace('/student/dashboard')
      router.refresh()
    } catch (err) {
      setBusy(false)
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    }
  }

  return (
    <Button variant="accent" onClick={restore} disabled={busy} busyLabel={busy ? 'Restoring…' : null}>
      Restore my account
    </Button>
  )
}
