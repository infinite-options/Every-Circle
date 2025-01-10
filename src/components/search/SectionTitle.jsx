import * as React from 'react';
import { Typography } from '@mui/material';

export default function SectionTitle({ children, sx }) {
  return (
    <Typography
      variant="h2"
      sx={{
        color: '#1a1a1a',
        fontFamily: 'Lexend, sans-serif',
        fontSize: '16px',
        fontWeight: 700,
        lineHeight: 1,
        mt: 1,
        ...sx
      }}
    >
      {children}
    </Typography>
  );
}