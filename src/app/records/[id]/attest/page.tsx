import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AttestClient from './AttestClient'
import type { VerifiedWorkRecord } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AttestPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/records/${id}/attest`)

  const { data: record } = await supabase
    .from('verified_work_records')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!record) notFound()
  if (record.poster_id !== user.id) notFound()

  return <AttestClient record={record as VerifiedWorkRecord} />
}
