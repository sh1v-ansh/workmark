import { redirect } from 'next/navigation'

/**
 * The student directory moved into Find work, as its People tab, so finding
 * somebody to build with sits next to the projects instead of behind the
 * account menu. Old links and bookmarks land there.
 */
export default function StudentsDirectoryPage() {
  redirect('/listings?tab=people')
}
