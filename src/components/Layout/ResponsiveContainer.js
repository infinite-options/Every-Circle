import { Box, Paper } from '@mui/material';

const ResponsiveContainer = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'start', 
        overflow: 'hidden', 
        padding: { xs: 1, sm: 2 },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#1976d2',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2,
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            zIndex: 2, 
            width: '100%',
            padding: { xs: 2, sm: 4 },
          }}
        >
          {children}
        </Box>
      </Paper>
    </Box>
  );
};

export default ResponsiveContainer;
