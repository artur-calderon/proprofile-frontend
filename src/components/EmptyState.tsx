import React from 'react'

export const EmptyState: React.FC<{ message?: string }> = ({ message = 'Nada para mostrar' }) => (
  <div style={{ padding: 12, color: '#666' }}>{message}</div>
)

export default EmptyState
