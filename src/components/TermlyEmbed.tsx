'use client'

import { useEffect } from 'react'

/**
 * Renders a Termly-hosted policy in the page.
 *
 * Termly's embed is a div it recognises plus a loader script that finds the
 * div and fills it in. The script is added here rather than in the document
 * head so it only loads on the three pages that need it — a policy loader
 * has no business running on the dashboard.
 *
 * The document lives at Termly rather than in this repo on purpose. These
 * are legal texts that get amended, and a version in the codebase means the
 * published version is whatever was deployed last, which is exactly the
 * wrong property for a document that has to say what is true today.
 */
export function TermlyEmbed({ dataId }: { dataId: string }) {
  useEffect(() => {
    const SRC = 'https://app.termly.io/embed-policy.min.js'
    // Re-navigating between the three policy pages must not stack loaders.
    if (document.querySelector(`script[src="${SRC}"]`)) return
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    document.body.appendChild(script)
  }, [])

  // `name` rather than `id`: Termly's loader looks for that exact attribute,
  // and React's div typings have no `name`, hence the cast.
  const attrs = {
    name: 'termly-embed',
    'data-id': dataId,
    'data-type': 'iframe',
  } as React.HTMLAttributes<HTMLDivElement>

  return <div {...attrs} />
}
