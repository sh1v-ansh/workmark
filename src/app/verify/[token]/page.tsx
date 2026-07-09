import { createClient } from '@supabase/supabase-js'
import VerifyClient from './VerifyClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function VerifyPage({ params }: Props) {
  const { token } = await params

  // Use service role to look up record without auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: record, error } = await supabase
    .from('verified_work_records')
    .select('*, students(full_name)')
    .eq('verification_token', token)
    .maybeSingle()

  if (error || !record) {
    return <VerifyClient record={null} token={token} />
  }

  return <VerifyClient record={record} token={token} />
}
