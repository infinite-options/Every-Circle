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
          // width: '100%',
          width: '600px',
          borderRadius: '50%', // Keeps it circular
          overflow: 'hidden',
          backgroundColor: '#1976d2',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2,
          zIndex: 1,
          // '&::before': {
          //   content: '""',
          //   position: 'absolute',
          //   top: '-50%',
          //   left: '-100%', 
          //   width: '300%', 
          //   height: '200%',
          //   backgroundColor: '#1976d2',
          //   borderRadius: '50%',
          //   zIndex: 0,
          //   transform: 'scale(1.2)',
          //   '@media (min-width: 600px)': {
          //     left: '-50%',
          //     transform: 'scale(1)', 
          //   },
          // },
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
