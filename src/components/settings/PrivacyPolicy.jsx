import React from "react";
import { Box, Typography, Paper, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 2, bgcolor: "#f0f0f0", minHeight: "100vh" }}>  
      {/* Content Box with Purple Header */}
      <Paper elevation={3} sx={{ maxWidth: "800px", width: "100%", bgcolor: "#e8e8e8", borderRadius: "12px", overflow: "hidden" }}>
        
        {/* Purple Gradient Header with Back Arrow */}
        <Box
          sx={{
            width: "100%",
            height: "60px",
            background: "linear-gradient(to right, #a044ff,rgb(196, 106, 235))",  // 🎨 Updated Purple
            display: "flex",
            alignItems: "center",
            px: 2,
            boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)",
          }}
        >
          <IconButton onClick={() => navigate("/settings")} sx={{ color: "white" }}>
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Typography variant="h6" fontWeight="bold" color="white" sx={{ ml: 1 }}>
            Privacy Policy
          </Typography>
        </Box>

        {/* Privacy Policy Content */}
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Every Circle Privacy Policy
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
            Last updated: August 1, 2024
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Infinite Options, LLC ("us", "we", or "our") operates Every Circle (the "Application"). 
            This page informs you of our policies regarding the collection, use, and disclosure of 
            Personal Information we receive from users of the mobile application and web applications 
            (the "Platforms").
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Information Collection And Use
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            While using our Application, we may ask you to provide us with certain personally identifiable 
            information that can be used to contact or identify you. Personally identifiable information 
            may include, but is not limited to, your name, email, social ID (if you logged in via social media), 
            street address, phone number, and payment information ("Personal Information"). This data is stored 
            within our secure databases and we use this data to identify you with your account and purchases. 
            We also use this data to pre-populate the information into your Application profile.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Log Data
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Like many application operators, we collect information that your Platform sends whenever you visit 
            our Application ("Log Data").
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            This Log Data may include information such as your phone’s Internet Protocol ("IP") address, phone 
            type, software version, the pages of our Application that you visit, the time and date of your visit, 
            the time spent on those pages and other statistics.
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            In addition, we may use third-party services such as Google Analytics that collect, monitor, and 
            analyze this information to improve the Application.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Communications
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            We may use your Personal Information to contact you with newsletters, marketing or promotional 
            materials, and other information regarding the mobile application.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Security
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            The security of your Personal Information is important to us, but remember that no method of 
            transmission over the Internet, or method of electronic storage, is 100% secure. While we strive 
            to use commercially acceptable means to protect your Personal Information, we cannot guarantee 
            its absolute security.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Your Rights to Your Data
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            We believe that your personal data is your data. As such, should you ever request to be removed 
            from our email lists or database, you need only send us an email at info@infiniteoptions.com stating 
            your request. We will comply within 5 working days of receiving your email.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Changes To This Privacy Policy
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            This Privacy Policy is effective as of August 1, 2024, and will remain in effect except with respect 
            to any changes in its provisions in the future, which will be in effect immediately after being 
            posted on this page.
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            We reserve the right to update or change our Privacy Policy at any time, and you should check this 
            Privacy Policy periodically. Your continued use of the Service after we post any modifications to 
            the Privacy Policy on this page will constitute your acknowledgment of the modifications and your 
            consent to abide and be bound by the modified Privacy Policy.
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            If we make any material changes to this Privacy Policy, we will notify you either through the email 
            address you have provided us, or by placing a prominent notice on our mobile application.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Contact Us
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            If you have any questions about this Privacy Policy, please contact us:
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            <strong>Infinite Options, LLC</strong>
            <br />
            <a href="mailto:info@infiniteoptions.com">info@infiniteoptions.com</a>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PrivacyPolicy;
