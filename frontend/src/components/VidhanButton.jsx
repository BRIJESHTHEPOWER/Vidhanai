import React from 'react';
import { Button } from 'antd';
import './VidhanButton.css';

/**
 * VidhanButton — antd Button with shimmer + lift micro-animations.
 * variant: 'primary' | 'outline' | 'ghost' | 'danger' | 'text'
 * size:    'large' | 'default' | 'small'
 */
export default function VidhanButton({
  variant = 'primary',
  size = 'default',
  children,
  icon,
  block = false,
  loading = false,
  disabled = false,
  onClick,
  className = '',
  href,
  target,
  htmlType,
  style,
  ...rest
}) {
  const antdType = {
    primary: 'primary',
    outline: 'default',
    ghost:   'default',
    danger:  'primary',
    text:    'text',
  }[variant] ?? 'primary';

  return (
    <Button
      type={antdType}
      size={size}
      icon={icon}
      block={block}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      href={href}
      target={target}
      htmlType={htmlType}
      danger={variant === 'danger'}
      ghost={variant === 'ghost'}
      style={style}
      className={`vbtn vbtn--${variant} ${className}`}
      {...rest}
    >
      {children}
    </Button>
  );
}
