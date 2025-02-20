import { Box, Paper } from '@mui/material';

const ResponsiveContainer = ({ children, role }) => {
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
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: role === "user" ? '#1976d2' : '#00C721',
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
