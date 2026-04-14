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
    .from('experience_records')
    .select('*, students(full_name), companies(contact_email)')
    .eq('verification_token', token)
    .maybeSingle()

  if (error || !record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-6xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link not found</h1>
          <p className="text-sm text-gray-500">
            This verification link is invalid or has expired.
          </p>
        </div>
      </div>
    )
  }

  return <VerifyClient record={record} token={token} />
}
