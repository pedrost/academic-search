/**
 * Design System Tokens
 * Centralized source of truth for colors, spacing, shadows, and utilities
 */

export const colors = {
  // Primary brand color (blue)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Accent color (purple)
  accent: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  // Sector-specific colors
  sector: {
    academia: {
      bg: '#dbeafe',
      text: '#1e40af',
      border: '#93c5fd',
    },
    government: {
      bg: '#dcfce7',
      text: '#166534',
      border: '#86efac',
    },
    private: {
      bg: '#fef3c7',
      text: '#92400e',
      border: '#fcd34d',
    },
    ngo: {
      bg: '#e0e7ff',
      text: '#3730a3',
      border: '#a5b4fc',
    },
    unknown: {
      bg: '#f3f4f6',
      text: '#4b5563',
      border: '#d1d5db',
    },
  },
  // Semantic colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  // Neutrals
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
}

export const spacing = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
}

export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
}

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
}

/**
 * Helper functions
 */

type Sector = 'ACADEMIA' | 'GOVERNMENT' | 'PRIVATE' | 'NGO' | 'UNKNOWN'

export function getSectorColor(sector: Sector | null | undefined): {
  bg: string
  text: string
  border: string
} {
  const normalizedSector = sector?.toUpperCase() as Sector

  switch (normalizedSector) {
    case 'ACADEMIA':
      return colors.sector.academia
    case 'GOVERNMENT':
      return colors.sector.government
    case 'PRIVATE':
      return colors.sector.private
    case 'NGO':
      return colors.sector.ngo
    default:
      return colors.sector.unknown
  }
}

export function getSectorBgClass(sector: Sector | null | undefined): string {
  const normalizedSector = sector?.toUpperCase() as Sector

  switch (normalizedSector) {
    case 'ACADEMIA':
      return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'GOVERNMENT':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'PRIVATE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'NGO':
      return 'bg-indigo-100 text-indigo-800 border-indigo-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}
