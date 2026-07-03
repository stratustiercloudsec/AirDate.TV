import { createContext, useContext, useEffect, useState } from 'react'
import { fetchCuratedPremieres } from '@/utils/tmdb'

const CuratedContext = createContext([])

export function CuratedProvider({ children }) {
  const [curated, setCurated] = useState([])

  useEffect(() => {
    fetchCuratedPremieres()
      .then(shows => setCurated(shows))
      .catch(() => setCurated([]))
  }, [])

  return (
    <CuratedContext.Provider value={curated}>
      {children}
    </CuratedContext.Provider>
  )
}

export function useCurated() {
  return useContext(CuratedContext)
}
