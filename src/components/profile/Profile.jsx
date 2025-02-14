import React, { useState, useEffect } from "react";
import { Box, Typography, styled, IconButton, TextField } from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
// import ImageUpload from '../common/ImageUpload';
import SquareImageUpload from '../common/SquareImageUpload';
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
import { useUserContext } from "../contexts/UserContext";
import { DataValidationUtils } from "../auth/authUtils/DataValidationUtils";
import DialogBox from "../common/DialogBox";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

const FormBox = styled(Box)({
  padding: "0 16px",
});

export default function Profile() {
  const location = useLocation();
  const { editMode: initialEditMode = false } = location.state || {};
  const { user, updateUser } = useUserContext();
  // console.log('user data', user);
  const userId = user.userId;
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    tagLine: "",
    shortBio: "",
    facebookLink: "",
    twitterLink: "",
    linkedinLink: "",
    youtubeLink: "",
    template: "",
    weHelp: ["", "", "", "", ""],
    youHelp: ["", "", "", ""],
    profileImages: [],
    favImage: "",
  });
  const [profileId, setProfileId] = useState("");
  const [editMode, setEditMode] = useState(initialEditMode);
  const [errors, setErrors] = useState({});
  const { isValidPhoneNumber, formatPhoneNumber } = DataValidationUtils;
  const [dialog, setDialog] = useState({
    open: false,
    title: "",
    content: "",
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);
  const [showSpinner, setShowSpinner] = useState(false);
  const navigate = useNavigate();

  const templateMap = {
    0: "dark",
    1: "modern",
    2: "minimalist",
    3: "split",
    4: "creative",
  }

  const handleOpen = (title, content) => {
    setDialog({ open: true, title, content });
  };

  const handleClose =  () => {
    setDialog({ open: false, title: "", content: "" });
  };

  const fetchProfile = async () => {
    try {
      setShowSpinner(true);
      const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/profile/${userId}`);
      if (response.status === 200) {
        const user = response.data.result[0];
        setFormData({
          ...formData,
          firstName: user.profile_first_name || "",
          lastName: user.profile_last_name || "",
          phoneNumber: user.profile_phone || "",
          location: user.profile_location || "USA",
          tagLine: user.profile_tag_line || "",
          shortBio: user.profile_short_bio || "",
          facebookLink: user.profile_facebook_link || "",
          twitterLink: user.profile_twitter_link || "",
          linkedinLink: user.profile_linkedin_link || "",
          youtubeLink: user.profile_youtube_link || "",
          template: user.profile_template || "",
          youHelp: user.profile_how_can_you_help ? JSON.parse(user.profile_how_can_you_help) : ["", "", "", ""],
          weHelp: user.profile_how_can_we_help ? JSON.parse(user.profile_how_can_we_help) : ["", "", "", ""],
          profileImages: user.profile_images_url ? JSON.parse(user.profile_images_url) : [],
          favImage: user.profile_favorite_image,
          profileId: user.profile_uid,
        });
        //update data in context
        updateUser({ profileId: user.profile_uid, profile: user });
        setProfileId(user.profile_uid);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setShowSpinner(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const validateRequiredFields = () => {
    const newErrors = {};
    ["firstName", "lastName", "location", "phoneNumber"].forEach((field) => {
      if (!formData[field]) {
        newErrors[field] = `${field} is required`;
      }
    });

    if (isValidPhoneNumber(formData.phoneNumber) === false) {
      newErrors["phoneNumber"] = "Invalid phone number format";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
    } else {
      setErrors({});
    }
    // console.log('The errors are', errors)
    return Object.keys(newErrors).length === 0;
  }

  const handleImageUpload = (index, file) => {
    let currentIndex = formData.profileImages.length;
    const fileObj = {
      index: currentIndex,
      file: file,
      coverPhoto: currentIndex + index === 0 && !formData.favImage, // Only set the first new image as cover if there's no favorite image
    };
    console.log(fileObj)
    setSelectedImages(prev => ([
      ...prev,
      fileObj,
    ]));
  };

  const handleDeleteImage = (imageUrl) => {
    console.log('imageUrl in del', imageUrl, selectedImages)
    if (typeof (imageUrl) === "string") {
      const updatedImages = formData.profileImages.filter((link) => link != imageUrl);
      setFormData((prev) => ({ ...prev, profileImages: updatedImages }));
      setDeletedImages((prev) => [...prev, imageUrl]);
      const reassignedImages = selectedImages?.map((img, i) => ({ ...img, index: updatedImages.length + i }));
      // console.log('reassigned', reassignedImages);
      setSelectedImages(reassignedImages);
      if (imageUrl === formData.favImage) {
        setFormData((prev) => ({
          ...prev,
          favImage: "",
        }));
      }
    } else {
      const updatedImages = selectedImages?.filter((img) => img.file.name != imageUrl.name);
      setSelectedImages(updatedImages);
    }
  }

  const handleFavImage = (imageUrl) => {
    //type string for existing images 
    if (typeof (imageUrl) === "string") {
      const updatedImages = selectedImages?.map((img) => ({ ...img, coverPhoto: false }));
      setSelectedImages(updatedImages);
      setFormData((prev) => ({
        ...prev,
        favImage: imageUrl,
      }));
    } else {
      const updatedImages = selectedImages.map((img) => ({ ...img, coverPhoto: img.file.name === imageUrl.name }));
      setSelectedImages(updatedImages);
      setFormData((prev) => ({
        ...prev,
        favImage: '',
      }));
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateRequiredFields()) {
      const form = new FormData();
      form.append("profile_first_name", formData.firstName);
      form.append("profile_last_name", formData.lastName);
      form.append("profile_phone", formData.phoneNumber);
      // form.append("profile_location", formData.location);
      form.append("profile_tag_line", formData.tagLine);
      form.append("profile_short_bio", formData.shortBio);
      form.append("profile_facebook_link", formData.facebookLink);
      form.append("profile_twitter_link", formData.twitterLink);
      form.append("profile_linkedin_link", formData.linkedinLink);
      form.append("profile_youtube_link", formData.youtubeLink);
      form.append("profile_template", formData.template);
      form.append("profile_how_can_we_help", JSON.stringify(formData.weHelp));
      form.append("profile_how_can_you_help", JSON.stringify(formData.youHelp));

      //image related fields 
      // form.append("profile_images_url", JSON.stringify(formData.profileImages));

      let i = 0;
      for (const file of selectedImages) {
        let key = `img_${i++}`;
        form.append(key, file.file);
        if (file.coverPhoto) {
          form.append("img_favorite", key);
        }
      }

      if (deletedImages.length > 0) {
        form.append("delete_images", JSON.stringify(deletedImages));
      }

      if (formData.favImage) {
        form.append("profile_favorite_image", formData.favImage);
      } else {
        form.append("profile_favorite_image", "");
      }

      form.append("profile_uid", profileId);
      try {
        setShowSpinner(true);
        const response = await axios.put(`${APIConfig.baseURL.dev}/profile`, form);
        console.log("Profile updated successfully", response);
        if (response.data.code === 200) {
          // Fetch the latest profile data from the server
          await fetchProfile();
          setEditMode(false);
          handleOpen("Success", "Profile has been updated successfully.");
          // alert("Profile updated successfully");
        }
      } catch (error) {
        handleOpen("Error", "Cannot update the profile.");
        console.error("Error updating profile:", error);
      } finally {
        setShowSpinner(false);
      }
    } else {
      handleOpen("Error", "Cannot update the profile.");
      // alert("Error updating profile");
    }
  };

  return (
    <StyledContainer>
      <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Header title="Profile" />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '0px 30px', width: '100%', }}>
        <EditIcon
          onClick={() => setEditMode(!editMode)}
          sx={{ cursor: 'pointer', color: editMode && "red" }}
        />
      </Box>
      <Box sx={{ borderRadius: '10px', margin: "10px 25px" }}>
        <form>
          <FormBox>
            <InputField
              required
              label="First Name"
              value={formData.firstName}
              onChange={(value) => setFormData({ ...formData, firstName: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.firstName}
              helperText={errors.firstName}
            />
            <InputField
              required
              label="Last Name"
              value={formData.lastName}
              onChange={(value) => setFormData({ ...formData, lastName: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.lastName}
              helperText={errors.lastName}
            />
            <InputField
              required
              label="Phone Number"
              value={formData.phoneNumber}
              onChange={(value) =>
                setFormData({ ...formData, phoneNumber: formatPhoneNumber(value) })
              }
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.phoneNumber}
              helperText={errors.phoneNumber}
            />
            <InputField
              required
              label="Location"
              value={formData.location}
              onChange={(value) => setFormData({ ...formData, location: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.location}
              helperText={errors.location}
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
              {[0, 1, 2].map((index) => {
                console.log("Rendering index:", index);
                return (
                  <SquareImageUpload
                    key={index}
                    index={index}
                    onImageUpload={(file) => handleImageUpload(index, file)}
                    image={formData.profileImages && formData.profileImages[index] ? formData.profileImages[index] : selectedImages?.find((img) => img.index == index)}
                    imageUrl={formData.profileImages && formData.profileImages[index] ? formData.profileImages[index] : (selectedImages?.find((img) => img.index == index))?.file}
                    handleDeleteImage={(imageUrl) => handleDeleteImage(imageUrl)}
                    handleFavImage={(imageUrl) => handleFavImage(imageUrl)}
                    favImage={formData.favImage}
                    isDisabled={!editMode}
                    size={100}
                    shape="square"
                  />
                )
              })}
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
                    if(!editMode){
                      navigate("/showTemplate", {
                        state: {
                          data: user,
                          navigatingFrom: "profilePage",
                        }
                      })
                    }else{
                      navigate("/selectTemplate", { state: { data: formData } });
                    }
                  }}
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
        <DialogBox
          open={dialog.open}
          title={dialog.title}
          content={dialog.content}
          button1Text="Ok"
          button1Action={handleClose}
          handleClose={handleClose}
        />
        <NavigationBar />
      </Box>
    </StyledContainer>
  );
};
