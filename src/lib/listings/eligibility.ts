/**
 * Who may see which postings.
 *
 * Students on a visa (F-1, J-1) need work authorization (CPT) before they
 * can take paid work, and Workmark does not handle that yet. So paid roles
 * are hidden from them everywhere a posting can appear: Find work, a
 * posting's own page, Goals, and the apply route itself. One rule, in one
 * place, so a new surface cannot forget it.
 */
export function canSeeKind(kind: string | null | undefined, isInternational: boolean | null | undefined): boolean {
  return !(kind === 'paid' && isInternational === true)
}

export const PAID_HIDDEN_NOTE =
  'Paid roles need work authorization (CPT) that we cannot arrange for student visas yet.'
