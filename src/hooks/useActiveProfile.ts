import { useEffect, useState } from 'react'
import { Profile } from '../shared/types'
import storageService from '../services/storageService'

// Hook to expose the active profile object and a setter.
export function useActiveProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const id = await storageService.getActiveProfileId()
      if (!id) return
      const all = await storageService.getAllProfiles()
      if (!mounted) return
      setProfile(all.find((p) => p.id === id) ?? null)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return { profile, setProfile }
}

export default useActiveProfile
