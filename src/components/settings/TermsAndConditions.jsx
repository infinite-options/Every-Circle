import React from "react";
import { Box, Typography, Paper, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

const TermsAndConditions = () => {
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
            background: "linear-gradient(to right, #a044ff, rgb(196, 106, 235))",  // 🎨 Updated Purple
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
            Terms & Conditions
          </Typography>
        </Box>

        {/* Terms & Conditions Content */}
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Every Circle Terms & Conditions
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
            Updated: July 2024
          </Typography>

          <Typography variant="body1" sx={{ mt: 3 }}>
            PLEASE REVIEW THE TERMS OF THIS AGREEMENT CAREFULLY. IF YOU DO NOT AGREE TO THIS AGREEMENT IN ITS ENTIRETY, YOU ARE NOT AUTHORIZED TO USE THE EVERY CIRCLE OFFERINGS IN ANY MANNER OR FORM.
          </Typography>

          <Typography variant="body1" sx={{ mt: 2 }}>
            THIS AGREEMENT REQUIRES THE USE OF ARBITRATION ON AN INDIVIDUAL BASIS TO RESOLVE DISPUTES, RATHER THAN JURY TRIALS OR CLASS ACTIONS, AND ALSO LIMITS THE REMEDIES AVAILABLE TO YOU IN THE EVENT OF A DISPUTE.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Welcome to Every Circle
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            These terms and conditions govern your use of Every Circle's website, mobile application, and services (collectively, the "Every Circle Offerings"). By using the Every Circle Offerings, you acknowledge that you have read, understood, and agree to be legally bound by these Terms & Conditions and our Privacy Policy.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Modifications to the Agreement
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Every Circle may modify this Agreement from time to time at its sole discretion. When changes are made, we will notify you by making the revised version available on this webpage, and will indicate the date that revisions were last made. Your continued use of the Every Circle Offerings after such modifications will constitute your acknowledgment and acceptance of the revised terms.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Eligibility
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            By using the Every Circle Offerings, you represent that you are at least eighteen (18) years of age (or the applicable age of majority in your jurisdiction) and have the requisite power and authority to enter into this Agreement.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Registration and Account Security
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            When creating an account, you must provide accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials and are fully responsible for all activities that occur under your account.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Billing and Subscription
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Every Circle offers subscription-based services. By signing up for a subscription, you agree to recurring charges as specified during your purchase. You may modify or cancel your subscription at any time by managing your account settings.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Cancellations and Refunds
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            If you wish to cancel your subscription, you must do so before the next billing cycle. Refunds are only available under specific circumstances outlined in our refund policy.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Prohibited Conduct
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            You agree not to use the Every Circle Offerings to engage in any unlawful, fraudulent, or abusive activities, including but not limited to spamming, data mining, and unauthorized access to accounts or data.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Intellectual Property
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            The Every Circle brand, logo, content, and software are protected by intellectual property laws. You may not reproduce, distribute, or modify any of our content without explicit permission.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Dispute Resolution & Arbitration
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Any disputes arising out of this Agreement will be resolved through binding arbitration in accordance with the rules of the American Arbitration Association (AAA). You agree to waive your right to a jury trial or class action lawsuit.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Changes to the Every Circle Offerings
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            Every Circle reserves the right to modify, suspend, or discontinue any of its services at any time without prior notice.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            Contact Us
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            If you have any questions regarding these Terms & Conditions, please contact us at:
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            <strong>Every Circle</strong>
            <br />
            <a href="mailto:support@everycircle.com">support@everycircle.com</a>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default TermsAndConditions;
