import { Box, MobileStepper } from '@mui/material';

const ProfileSetupStepper = ({ activeStep, steps }) => {
  return (
    <Box sx={{ width: '100%'}}>
      <MobileStepper
        variant="dots"
        steps={steps}
        position="static"
        activeStep={activeStep}
        sx={{
          maxWidth: 200,
          flexGrow: 1,
          background: 'transparent',
          '& .MuiMobileStepper-dot': {
            width: '20px',
            height: '20px',
            backgroundColor: '#F5F5F5'
          },
          '& .MuiMobileStepper-dotActive': {
            backgroundColor: '#00C7BE'
          },
          // Add styles for completed dots till now
          [`& .MuiMobileStepper-dots > :nth-of-type(-n+${activeStep})`]: {
            backgroundColor: '#00C7BE'
          }
        }}
        nextButton={null}
        backButton={null}
      />
    </Box>
  );
};

export default ProfileSetupStepper; 