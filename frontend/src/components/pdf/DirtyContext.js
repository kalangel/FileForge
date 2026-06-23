import { createContext, useContext, useEffect } from 'react'

// Lets PDF tools report whether they currently hold a loaded file / unsaved
// work, so PdfEditor can warn before switching sections.
export const DirtyContext = createContext(() => {})

/** Report "there is unsaved work" while `active` is true; clear on unmount. */
export function useDirtyFile(active) {
  const setDirty = useContext(DirtyContext)
  useEffect(() => {
    setDirty(Boolean(active))
    return () => setDirty(false)
  }, [active, setDirty])
}
