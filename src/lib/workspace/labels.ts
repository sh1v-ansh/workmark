// What the stored values are called on screen.
//
// One copy, because the draft checklist, the team list and the role picker
// all name the same thing and three copies drift. The values themselves live
// in membership.ts; this is only how they read.

import type { WorkRole } from './membership'

export const ROLE_LABEL: Record<WorkRole, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  // 'fullstack' already matched any task in the planner, so it is the
  // honest name for somebody doing all of it — usually a project done alone.
  fullstack: 'Everything',
  mobile: 'Mobile',
  data: 'Data',
  ml: 'ML / AI',
  infra: 'Infrastructure',
  design: 'Design',
  other: 'Other',
}
