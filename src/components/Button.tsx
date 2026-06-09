import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button: React.FC<ButtonProps> = ({ children, ...props }) => (
  <button {...props} style={{ padding: '8px 12px', borderRadius: 6 }}>
    {children}
  </button>
)

export default Button
