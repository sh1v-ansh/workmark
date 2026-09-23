import type { BadgeTone } from '@/components/ui/Badge'

/** How an application's status reads to the student who sent it. One map,
 *  so the dashboard and the project page never call the same state two
 *  different things. */
export const APPLICATION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  submitted:   { label: 'Not read yet',       tone: 'neutral' },
  shortlisted: { label: "They're interested", tone: 'info' },
  accepted:    { label: "You're in",          tone: 'positive' },
  rejected:    { label: 'Not this time',      tone: 'neutral' },
  withdrawn:   { label: 'Withdrawn',          tone: 'neutral' },
}
