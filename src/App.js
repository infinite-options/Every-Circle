import { ThemeProvider, createTheme } from '@mui/material';
import ProfileSetupForm from './components/ProfileSetup/ProfileSetupForm';

const theme = createTheme({
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          padding: '12px',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ProfileSetupForm />
    </ThemeProvider>
  );
}

export default App; 