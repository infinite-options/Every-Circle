import React, { useState, useEffect } from "react";
import { Box, Typography, styled, IconButton, TextField } from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
import { ImageUpload } from "../common/ImageUpload";
import { HelpItem } from "./HelpItem";
import StyledContainer from "../common/StyledContainer";
import Header from "../common/Header";
import facebook from "../../assets/facebook-icon.png";
import youtube from "../../assets/youtube-icon.png";
import linkedin from "../../assets/linkedin-icon.png";
import twitter from "../../assets/twitter-icon.png";
import CircleButton from "../common/CircleButton";
import NavigationBar from "../navigation/NavigationBar";
import axios from "axios";
import APIConfig from "../../APIConfig";
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate, useLocation } from "react-router-dom";

const FormBox = styled(Box)({
  padding: "0 16px",
});

export default function Profile() {
  const location = useLocation();
  const { userId } = location.state;
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    tagLine: "",
    shortBio: "",
    images: [],
    facebookLink: "",
    twitterLink: "",
    linkedinLink: "",
    youtubeLink: "",
    template: "",
    weHelp: ["", "", "", "", ""],
    youHelp: ["", "", "", ""],
  });
  const [profileId, setProfileId] = useState("");
  const [editMode, setEditMode] = useState(location.state?.editMode ?? false);
  const navigate = useNavigate();

  const templateMap = {
    1: "modern",
    2: "minimalist",
    3: "split",
    4: "creative",
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/profile/${userId}`);
        console.log("Profile GET response", response);
        if (response.status === 200) {
          const user = response.data.result[0];
          setFormData(
            {
              ...formData,
              firstName: user.profile_first_name || "",
              lastName: user.profile_last_name || "",
              phoneNumber: user.profile_phone || "",
              tagLine: user.profile_tag_line || "",
              shortBio: user.profile_short_bio || "",
              images: user.profile_images || [],
              facebookLink: user.profile_facebook_link || "",
              twitterLink: user.profile_twitter_link || "",
              linkedinLink: user.profile_linkedin_link || "",
              youtubeLink: user.profile_youtube_link || "",
              template: user.profile_template || "",
              youHelp: user.profile_how_can_you_help ? JSON.parse(user.profile_how_can_you_help) : ["", "", "", ""],
              weHelp: user.profile_how_can_we_help ? JSON.parse(user.profile_how_can_we_help) : ["", "", "", ""],
              profileId: user.profile_uid,
            });
          setProfileId(user.profile_uid);
        } else {
          console.log("Error fetching profile: ", response.status);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append("profile_first_name", formData.firstName);
    form.append("profile_last_name", formData.lastName);
    form.append("profile_phone", formData.phoneNumber);
    form.append("profile_tag_line", formData.tagLine);
    form.append("profile_short_bio", formData.shortBio);
    // form.append("profile_images", formData.images);
    form.append("profile_facebook_link", formData.facebookLink);
    form.append("profile_twitter_link", formData.twitterLink);
    form.append("profile_linkedin_link", formData.linkedinLink);
    form.append("profile_youtube_link", formData.youtubeLink);
    form.append("profile_template", formData.template);
    form.append("profile_how_can_we_help", JSON.stringify(formData.weHelp));
    form.append("profile_how_can_you_help", JSON.stringify(formData.youHelp));
    form.append("profile_uid", profileId);
    try {
      const response = await axios.put(`${APIConfig.baseURL.dev}/profile`, form);
      console.log("Profile updated successfully", response);
      if (response.data.code === 200) {
        alert("Profile updated successfully");
      } else {
        alert("Error updating profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  return (
    <StyledContainer>
      <Header title="Profile" />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '0px 30px', width: '100%', }}>
        <EditIcon
          onClick={() => setEditMode(!editMode)}
          sx={{ cursor: 'pointer' }}
        />
      </Box>
      <Box sx={{ borderRadius: '10px', margin: "10px 25px" }}>
        <form>
          <FormBox>
            <InputField
              label="First Name"
              value={formData.firstName}
              onChange={(value) => setFormData({ ...formData, firstName: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />
            <InputField
              label="Last Name"
              value={formData.lastName}
              onChange={(value) => setFormData({ ...formData, lastName: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />
            <InputField
              label="Phone Number"
              value={formData.phoneNumber}
              onChange={(value) =>
                setFormData({ ...formData, phoneNumber: value })
              }
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />
            <InputField
              label="Tag Line"
              optional
              value={formData.tagLine}
              onChange={(value) => setFormData({ ...formData, tagLine: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />
            <InputField
              label="Short Bio"
              optional
              multiline
              rows={4}
              value={formData.shortBio}
              onChange={(value) => setFormData({ ...formData, shortBio: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />

            <Box sx={{ display: "flex", gap: 2, my: 3, justifyContent: "space-between" }}>
              {[0, 1, 2].map((index) => (
                <ImageUpload
                  key={index}
                  index={index}
                  onUpload={(file) => {
                    const newImages = [...formData.images];
                    newImages[index] = file;
                    setFormData({ ...formData, images: newImages });
                  }}
                />
              ))}
            </Box>

            <SocialLink
              iconSrc={facebook}
              alt="Facebook"
              value={formData.facebookLink}
              onChange={(value) => setFormData({ ...formData, facebookLink: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />

            <SocialLink
              iconSrc={twitter}
              alt="Twitter"
              value={formData.twitterLink}
              onChange={(value) => setFormData({ ...formData, twitterLink: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />

            <SocialLink
              iconSrc={linkedin}
              alt="LinkedIn"
              value={formData.linkedinLink}
              onChange={(value) => setFormData({ ...formData, linkedinLink: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />

            <SocialLink
              iconSrc={youtube}
              alt="YouTube"
              value={formData.youtubeLink}
              onChange={(value) => setFormData({ ...formData, youtubeLink: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
            />

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
                  Template
                </Typography>
                <IconButton size="small" sx={{ p: 0 }}
                  onClick={() => {
                    navigate("/selectTemplate", { state: { data: formData } });
                  }}
                  disabled={!editMode}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Box>
              <TextField
                fullWidth
                variant="outlined"
                value={templateMap[formData.template]}
                placeholder="Template (Optional)"
                disabled
                sx={{
                  backgroundColor: editMode ? 'white' : '#e0e0e0',
                  borderRadius: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 4, mb: 2 }}>
              How Can We Help You
            </Typography>
            {formData.weHelp.map((item, index) => (
              <HelpItem
                key={index}
                text={item}
                onChange={(value) => {
                  const newItems = [...formData.weHelp];
                  newItems[index] = value;
                  setFormData({ ...formData, weHelp: newItems });
                }}
                disabled={!editMode}
                backgroundColor={editMode ? 'white' : '#e0e0e0'}
              />
            ))}

            <Typography variant="subtitle2" sx={{ mt: 4, mb: 2 }}>
              How Can You Help Others
            </Typography>
            {formData.youHelp.map((item, index) => (
              <HelpItem
                key={index}
                text={item}
                onChange={(value) => {
                  const newItems = [...formData.youHelp];
                  newItems[index] = value;
                  setFormData({ ...formData, youHelp: newItems });
                }}
                disabled={!editMode}
                backgroundColor={editMode ? 'white' : '#e0e0e0'}
              />
            ))}

            {editMode && (
              <CircleButton
                onClick={handleSubmit}
                width={135}
                height={135}
                text="Save"
              />
            )}
          </FormBox>
        </form>
        <NavigationBar />
      </Box>

    </StyledContainer>
  );
};
