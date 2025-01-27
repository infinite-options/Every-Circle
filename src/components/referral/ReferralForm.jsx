import React, { useState } from "react";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import NavigationBar from "../navigation/NavigationBar";
import { Box } from "@mui/material";
import { InputField } from "../common/InputField";
import CircleButton from "../common/CircleButton";
import { DataValidationUtils } from "../auth/authUtils/DataValidationUtils";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import axios from "axios";
import { useUserContext } from "../contexts/UserContext";
import DialogBox from "../common/DialogBox";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

export default function ReferralForm() {
    const { user } = useUserContext();
    const userId = user.userId;
    const messages = {
        message1: "Hi There!  I’d like to invite you to join Every Circle.  Click the link below to join!",
        message2: "It was a pleasure meeting you.  I’d like to invite you to join Every Circle.  Please click the link below to join for free and share your recommendations!",
        message3: "It pays to be connected!  Join Every Circle and we both benefit when we use each others recommendations! Let me know if you have questions!"
    }
    const [formData, setFormData] = useState({
        email: "",
        phoneNumber: "",
        message: messages["message1"],
    });
    const [errors, setErrors] = useState({});
    const { isValidPhoneNumber, isValidEmail, formatPhoneNumber } = DataValidationUtils;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [showSpinner, setShowSpinner] = useState(false);



    const handleOpen = () => setDialogOpen(true);
    const handleClose = () => setDialogOpen(false);

    const validateFields = () => {
        const newErrors = {};
        if (!formData.email && !formData.phoneNumber) {
            newErrors["email"] = "Enter email Id/phone number";
        }

        if (formData.email && isValidEmail(formData.email) === false) {
            newErrors["email"] = "Invalid email format";
        }

        if (formData.phoneNumber && isValidPhoneNumber(formData.phoneNumber) === false) {
            newErrors["phoneNumber"] = "Invalid phone number format";
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
        } else {
            setErrors({});
        }

        return Object.keys(newErrors).length === 0;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(formData);
        try {
            if (validateFields()) {
                setShowSpinner(true);
                const data = {
                    user_uid: userId,
                    ...(formData.email && { user_referred_email: formData.email }),
                    ...(formData.phoneNumber && { user_referred_number: formData.phoneNumber }),
                    message: formData.message,
                }
                const response = await axios.post('https://ioec2testsspm.infiniteoptions.com/refer-a-friend', data);
                console.log('response from referral', response);
                if (response.status === 200) {
                    setTitle("Success");
                    setContent("You have successfully sent your invite.")
                    handleOpen();
                } else {
                    setTitle("Error");
                    setContent("Cannot send the invite.")
                    handleOpen();
                }
            }
        } catch (error) {
            console.log("Cannot send invite", error);
        } finally {
            setShowSpinner(false);
        }

    };

    const handleMessageChange = (e) => {
        e.preventDefault();
        // console.log(e.target.value)
        setFormData((prev) => ({ ...prev, message: messages[e.target.value] }))
    }

    return (
        <StyledContainer>
            <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Header title="Join My Circle" />
            <Box sx={{ width: '100%', padding: "10px 40px" }}>
                <form>
                    <InputField
                        label="Email"
                        value={formData.email}
                        onChange={(value) => setFormData({ ...formData, email: value })}
                        error={!!errors.email}
                        helperText={errors.email}
                    />
                    <InputField
                        label="Phone Number"
                        value={formData.phoneNumber}
                        onChange={(value) =>
                            setFormData({ ...formData, phoneNumber: formatPhoneNumber(value) })
                        }
                        error={!!errors.phoneNumber}
                        helperText={errors.phoneNumber}
                    />

                    <FormControl sx={{ ml: 8, mt: 4 }}>
                        <FormLabel id="message"></FormLabel>
                        <RadioGroup
                            defaultValue="message1"
                            name="radio-buttons-group"
                            sx={{ gap: 5 }}
                            onChange={(e) => handleMessageChange(e)}
                        >
                            <FormControlLabel value="message1" control={<Radio />} label={messages["message1"]} />
                            <FormControlLabel value="message2" control={<Radio />} label={messages["message2"]} />
                            <FormControlLabel value="message3" control={<Radio />} label={messages["message3"]} />
                        </RadioGroup>
                    </FormControl>

                    <CircleButton width={100} height={100} text="Send Invite" onClick={handleSubmit} />

                </form>
                <DialogBox
                    open={dialogOpen}
                    title={title}
                    content={content}
                    button1Text="Ok"
                    button1Action={handleClose}
                    handleClose={handleClose}
                />
            </Box>
            <NavigationBar />
        </StyledContainer>
    )
}