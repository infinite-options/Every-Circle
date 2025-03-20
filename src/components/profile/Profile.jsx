
/////mobile view better  banner new

import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, styled, IconButton, TextField, Rating, Button } from "@mui/material";
import { SocialLink } from "./SocialLink";
import { InputField } from "../common/InputField";
import { DataGrid } from '@mui/x-data-grid';
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
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ProfileCard from "./ProfileCard"; // Import the new CSS file
import ProfileView from './ProfileView';
import moneyBag from "../../assets/moneybag.png";
import verifiedIcon from "../../assets/VerifiedProfile.png";

const FormBox = styled(Box)({
  padding: "0",
  maxWidth: "355px",
  margin: "0 auto",
  boxSizing: "border-box",
  width: "100%"
});

const SectionHeader = styled(Box)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
});

const SectionContainer = styled(Box)({
  marginBottom: "16px",
  backgroundColor: "white",
  borderRadius: "8px",
  padding: "12px 10px",
});

const PublicLabel = styled(Button)({
  color: "#666",
  fontSize: "14px",
  textTransform: "none",
  padding: "0",
  minWidth: "60px",
  '&:hover': {
    background: 'none',
    opacity: 0.8
  }
});

const UploadButton = styled(Button)({
  border: "2px dashed #ccc",
  borderRadius: "8px",
  padding: "15px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "white",
  '&:hover': {
    backgroundColor: "#f5f5f5",
    borderColor: "#999"
  }
});

const SectionItem = styled(Box)({
  position: "relative",
  marginBottom: "15px",
  padding: "15px 0",
});

const ItemActions = styled(Box)({
  position: "absolute",
  right: "0",
  top: "0",
  display: "flex",
});

const BannerSection = styled(Box)({
  backgroundColor: '#e0e0e0',
  borderRadius: '8px',
  padding: '12px 10px',
  display: 'flex',
  flexDirection: 'row', // Changed to row
  justifyContent: 'space-between', // This will push the "No" to the right
  alignItems: 'center', // This will vertically center the elements
  marginBottom: '16px',
  width: "100%",
  maxWidth: "355px",
  boxSizing: "border-box"
});

const BusinessCard = styled(Box)({
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '16px',
  border: '1px solid #e0e0e0',
});
///////////////////////

// Add these utility functions at the top level
const countWords = (str) => {
  return str.trim().split(/\s+/).filter(Boolean).length;
};

const truncateToWordLimit = (str, wordLimit) => {
  const words = str.trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return str;
  return words.slice(0, wordLimit).join(' ');
};




export default function Profile() {
  const location = useLocation();
  const { editMode: initialEditMode = false } = location.state || {};
  const { user, updateUser } = useUserContext();
  //console.log('user data', user);
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
    profileImages: [],
    favImage: "",
    experience: [{ company: "", title: "", startDate: "", endDate: "" }],
    education: [{ school: "", degree: "", startDate: "", endDate: "" }],
    expertise: [{ headline: "", description: "", cost: "", bounty: "" }],
    wishes: [{ helpNeeds: "", details: "" }],
    resume: null,
    businesses: [{ name: "", role: "" }],
    allowBannerAds: true,
    bannerAdsBounty: "",
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
  const [ratings, setRatings] = useState(null);
  const [publicFields, setPublicFields] = useState({
    profile_personal_email_is_public: 1,
    profile_personal_phone_number_is_public: 1,
    profile_personal_location_is_public: 1,
    profile_personal_image_is_public: 1,
    profile_personal_tag_line_is_public: 1,
    profile_personal_short_bio_is_public: 1,
    profile_personal_resume_is_public: 1,
    profile_personal_experience_is_public: 1,
    profile_personal_education_is_public: 1,
    profile_personal_expertise_is_public: 1,
    profile_personal_wishes_is_public: 1,
    profile_personal_allow_banner_ads: 1
  });
  const [deletedExperience, setDeletedExperience] = useState([]);
  const [deletedEducation, setDeletedEducation] = useState([]);
  const [deletedExpertise, setDeletedExpertise] = useState([]);
  const [deletedWishes, setDeletedWishes] = useState([]);

  const templateMap = {
    0: "dark",
    1: "modern",
    2: "minimalist",
    3: "split",
    4: "creative",
  }
  const [fetchCount, setFetchCount] = useState(0);
  const hasFetchedRef = useRef(false);
  const handleOpen = (title, content) => {
    setDialog({ open: true, title, content });
  };
  

  const handleClose =  () => {
    setDialog({ open: false, title: "", content: "" });
  };

  const fetchProfile = async () => {
    try {
      setShowSpinner(true);
      const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/api/v1/userprofileinfo/${userId}`);
      if (response.status === 200) {
        const { personal_info, links_info, expertise_info, wishes_info, experience_info, education_info } = response.data;
        const user_email = response.data.user_email || "";
        // Set public fields from personal info
        setPublicFields({
          profile_personal_email_is_public: personal_info.profile_personal_email_is_public,
          profile_personal_phone_number_is_public: personal_info.profile_personal_phone_number_is_public,
          profile_personal_location_is_public: personal_info.profile_personal_location_is_public,
          profile_personal_image_is_public: personal_info.profile_personal_image_is_public,
          profile_personal_tag_line_is_public: personal_info.profile_personal_tag_line_is_public,
          profile_personal_short_bio_is_public: personal_info.profile_personal_short_bio_is_public,
          profile_personal_resume_is_public: personal_info.profile_personal_resume_is_public,
          profile_personal_experience_is_public: personal_info.profile_personal_experience_is_public, // Default to public if not specified
          profile_personal_education_is_public: personal_info.profile_personal_education_is_public,
          profile_personal_expertise_is_public: personal_info.profile_personal_expertise_is_public,
          profile_personal_wishes_is_public: personal_info.profile_personal_wishes_is_public,
          profile_personal_allow_banner_ads: personal_info.profile_personal_allow_banner_ads 
        });

        // Map social links from links_info
        const socialLinks = links_info.reduce((acc, link) => {
          switch(link.social_link_name) {
            case 'facebook':
              acc.facebookLink = link.profile_link_url;
              break;
            case 'twitter':
              acc.twitterLink = link.profile_link_url;
              break;
            case 'linkedin':
              acc.linkedinLink = link.profile_link_url;
              break;
            case 'youtube':
              acc.youtubeLink = link.profile_link_url;
              break;
          }
          return acc;
        }, {});

        // Map expertise from expertise_info
        const expertise = expertise_info.map(exp => ({
          uid: exp.profile_expertise_uid, // This is the correct property name
          headline: exp.profile_expertise_title,
          description: exp.profile_expertise_description,
          cost: exp.profile_expertise_cost,
          bounty: exp.profile_expertise_bounty
        }));

        const wishes = wishes_info.map(wish => ({
          uid: wish.profile_wish_uid,
          helpNeeds: wish.profile_wish_title,
          details: wish.profile_wish_description,
          bounty: wish.profile_wish_bounty || "Free" // Make sure to extract the bounty
        }));

        // Map experience from experience_info
        const experience = experience_info.map(exp => ({
          uid: exp.profile_experience_uid,
          company: exp.profile_experience_company_name,
          title: exp.profile_experience_position,
          startDate: exp.profile_experience_start_date,
          endDate: exp.profile_experience_end_date || ""
        }));

        // Map education from education_info
        const education = education_info.map(edu => ({
          uid: edu.profile_education_uid,
          school: edu.profile_education_school_name,
          degree: edu.profile_education_degree,
          startDate: edu.profile_education_start_date,
          endDate: edu.profile_education_end_date
        }));

        // Handle profile images
        let profileImages = [];
        if (personal_info.profile_personal_image) {
          try {
            profileImages = [personal_info.profile_personal_image];
          } catch (e) {
            console.error("Error handling profile image:", e);
          }
        }
        //console.log()

        setFormData({
          firstName: personal_info.profile_personal_first_name || "",
          user_email: user_email,
          lastName: personal_info.profile_personal_last_name || "",
          phoneNumber: personal_info.profile_personal_phone_number || "",
          location: personal_info.profile_personal_country || "USA",
          tagLine: personal_info.profile_personal_tag_line || "",
          shortBio: personal_info.profile_personal_short_bio || "",
          ...socialLinks,
          template: personal_info.profile_template || "",
          profileImages,
          favImage: "",
          profileId: personal_info.profile_personal_uid,
          experience: experience.length > 0 ? experience : [{ company: "", title: "", startDate: "", endDate: "" }],
          education: education.length > 0 ? education : [{ school: "", degree: "", startDate: "", endDate: "" }],
          expertise: expertise.length > 0 ? expertise : [{ headline: "", description: "", cost: "", bounty: "" }],
          wishes: wishes.length > 0 ? wishes : [{ helpNeeds: "", details: "" }],
          resume: personal_info.profile_personal_resume || null,
          businesses: [{ name: "", role: "" }],
          allowBannerAds: true,
          bannerAdsBounty: personal_info.profile_personal_banner_ads_bounty || "", //////asad
          
        });

        setSelectedImages([]);  // Clear selected images after fetch
        setDeletedImages([]);   // Clear deleted images after fetch
        
        updateUser({ 
          profileId: personal_info.profile_personal_uid, 
          profile: personal_info 
        });
        setProfileId(personal_info.profile_personal_uid);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setShowSpinner(false);
    }
  };

  // useEffect(() => {
  //   fetchProfile();
  //   console.log("Inside useEffect")
  // }, [userId]);

  useEffect(() => {
    if (!hasFetchedRef.current && userId) {
      hasFetchedRef.current = true;
      fetchProfile();
      setFetchCount(prev => prev + 1);
      console.log("Inside useEffect - fetch #", fetchCount + 1);
    }
  }, [userId]);

  const validateRequiredFields = () => {
    const newErrors = {};
    
    // Required fields validation
    ["firstName", "lastName", "phoneNumber"].forEach((field) => {
      if (!formData[field]) {
        newErrors[field] = `${field} is required`;
      }
    });
    
    if (isValidPhoneNumber(formData.phoneNumber) === false) {
      newErrors["phoneNumber"] = "Invalid phone number format";
    }
    
    // Link validation - ensure they start with https://
    const linkFields = ["facebookLink", "twitterLink", "linkedinLink", "youtubeLink"];
    linkFields.forEach(field => {
      const link = formData[field];
      // Only validate if the link is not empty
      if (link && !link.startsWith("https://")) {
        newErrors[field] = "Link must start with https://";
      }
    });
    
    // Set the errors state
    setErrors(newErrors);
    
    // Return both a boolean indicating validity and the errors object
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleImageUpload = (index, file) => {
    // Create file object for tracking
    const fileObj = {
      index: index,
      file: file,
      coverPhoto: true
    };
    
    // Update selectedImages - only keep the latest image
    setSelectedImages([fileObj]);

    // Update formData.profileImages - only keep the latest image
    setFormData(prev => ({
      ...prev,
      profileImages: [file],  // Only keep the latest image
      favImage: ""  // Clear favImage when uploading new image
    }));

    // Clear deleted images when uploading new image
    setDeletedImages([]);

    // Log the upload for debugging
    console.log("Image upload:", {
      file: file.name,
      size: file.size,
      type: file.type
    });
  };  

  const handleDeleteImage = (imageUrl) => {
    if (typeof imageUrl === "string") {
      // Delete existing image
      const updatedImages = formData.profileImages.filter(link => link !== imageUrl);
      setFormData(prev => ({ 
        ...prev, 
        profileImages: updatedImages,
        favImage: imageUrl === prev.favImage ? "" : prev.favImage 
      }));
      // Add the image URL to deletedImages array
      setDeletedImages(prev => [...prev, imageUrl]);
    } else {
      // Delete newly uploaded image
      setFormData(prev => ({
        ...prev,
        profileImages: []
      }));
      setSelectedImages([]);
    }
  };


  /*const handleDeleteExperience = (index) => {
  const updatedExperience = [...formData.experience];
  const removedItem = updatedExperience[index];
  
  // If the item has a UID (exists in backend), add it to deletedExperience array
  if (removedItem.uid) {
    setDeletedExperience(prev => [...prev, removedItem.uid]);
  }
  
  updatedExperience.splice(index, 1);
  setFormData(prev => ({
    ...prev,
    experience: updatedExperience
  }));
}; */


  const handleDeleteExperience = (index) => {
    const updatedExperience = [...formData.experience];
    const removedItem = updatedExperience[index];
    console.log("DELETING EXPERTISE ITEM:", removedItem);
    console.log("ITEM HAS UID:", !!removedItem.uid);
    
    // If the item has a UID (exists in backend), add it to deletedExperience array
    if (removedItem.uid) {
      setDeletedExperience(prev => [...prev, removedItem.uid]);
    }
    
    updatedExperience.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      experience: updatedExperience
    }));
  };
  const handleDeleteExpertise = (index) => {
    const newExpertise = [...formData.expertise];
    const removedItem = newExpertise[index];
    
    if (removedItem.uid) {
      setDeletedExpertise(prev => [...prev, removedItem.uid]);
    }
    
    newExpertise.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      expertise: newExpertise
    }));
  };

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

  const handleAddExperience = () => {
    setFormData(prev => ({
      ...prev,
      experience: [...prev.experience, { company: "", title: "", startDate: "", endDate: "" }]
    }));
  };


  const handleExperienceChange = (index, field, value) => {
    const updatedExperience = [...formData.experience];
    // Ensure the experience object exists at this index
    if (!updatedExperience[index]) {
      updatedExperience[index] = { company: "", title: "", startDate: "", endDate: "" };
    }
    updatedExperience[index] = {
      ...updatedExperience[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      experience: updatedExperience
    }));
  };

  const handleAddEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { school: "", degree: "", startDate: "", endDate: "" }]
    }));
  };

  /*const handleDeleteEducation = (index) => {
    const updatedEducation = [...formData.education];
    updatedEducation.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      education: updatedEducation
    }));
  }; */

  const handleDeleteEducation = (index) => {
    const updatedEducation = [...formData.education];
    const removedItem = updatedEducation[index];
    
    if (removedItem.uid) {
      setDeletedEducation(prev => [...prev, removedItem.uid]);
    }
    
    updatedEducation.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      education: updatedEducation
    }));
  };

  const handleEducationChange = (index, field, value) => {
    const updatedEducation = [...formData.education];
    if (!updatedEducation[index]) {
      updatedEducation[index] = { school: "", degree: "", startDate: "", endDate: "" };
    }
    updatedEducation[index] = {
      ...updatedEducation[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      education: updatedEducation
    }));
  };

  const handleExpertiseChange = (index, field, value) => {
    const newExpertise = [...formData.expertise];
    if (!newExpertise[index]) {
      newExpertise[index] = { headline: "", description: "", cost: "", bounty: "" };
    }
    newExpertise[index] = {
      ...newExpertise[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      expertise: newExpertise
    }));
  };

  const handleWishChange = (index, field, value) => {
    const newWishes = [...formData.wishes];
    if (!newWishes[index]) {
      newWishes[index] = { helpNeeds: "", details: "" };
    }
    newWishes[index] = {
      ...newWishes[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      wishes: newWishes
    }));
  };
  const handleDeleteWish = (index) => {
    const newWishes = [...formData.wishes];
    const removedItem = newWishes[index];
    
    if (removedItem.uid) {
      setDeletedWishes(prev => [...prev, removedItem.uid]);
    }
    
    newWishes.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      wishes: newWishes
    }));
  };
const handleResumeUpload = (e) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    
    // Add detailed logging
    console.log("Resume file selected:", {
      name: file.name,
      type: file.type,
      size: file.size + " bytes",
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    // Validate file size (5MB limit is common)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      handleOpen("Error", `Resume file size (${(file.size/1024/1024).toFixed(2)}MB) exceeds the maximum allowed size of 5MB.`);
      return;
    }
    
    // Set the file in state
    setFormData(prev => {
      console.log("Setting resume in state:", file.name);
      return {
        ...prev,
        resume: file
      };
    });
    
    // Also set the public flag to 1 when a resume is uploaded
    setPublicFields(prev => ({
      ...prev,
      profile_personal_resume_is_public: 1
    }));
    
    // Show confirmation to user
    handleOpen("Resume Selected", `File "${file.name}" has been selected. Don't forget to save your profile to upload the resume.`);
  }
};


  // Replace the handleSubmit function with this optimized version





  // Replace the handleSubmit function with this optimized version
  /*const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateRequiredFields()) {
      const form = new FormData();
      
      // Personal Info
      form.append("profile_uid", profileId);
      form.append("profile_personal_first_name", formData.firstName);
      form.append("profile_personal_last_name", formData.lastName);
      form.append("profile_personal_phone_number", formData.phoneNumber);
      form.append("profile_personal_phone_number_is_public", publicFields.profile_personal_phone_number_is_public);
      form.append("profile_personal_tag_line", formData.tagLine || "");
      form.append("profile_personal_tag_line_is_public", publicFields.profile_personal_tag_line_is_public);
      form.append("profile_personal_short_bio", formData.shortBio || "");
      form.append("profile_personal_short_bio_is_public", publicFields.profile_personal_short_bio_is_public);
      form.append("profile_personal_image_is_public", publicFields.profile_personal_image_is_public);
      form.append("profile_personal_resume_is_public", publicFields.profile_personal_resume_is_public);
      
      // Add deleted image to form data if exists
      if (deletedImages.length > 0 && 
          !(formData.profileImages.length > 0 && typeof formData.profileImages[0] !== 'string')) {
        // This flag tells the backend to delete the profile image
        form.append("delete_profile_image", deletedImages[0]);
        console.log("Deleting profile image:", deletedImages[0]);
      } else {
        console.log("Skipping profile image deletion - either no image to delete or uploading new image");
      }

      // Add deleted UIDs to form data
      if (deletedExperience.length > 0) {
        form.append("delete_experiences", JSON.stringify(deletedExperience));
      }
      
      if (deletedEducation.length > 0) {
        form.append("delete_educations", JSON.stringify(deletedEducation));
      }
      
      if (deletedExpertise.length > 0) {
        form.append("delete_expertises", JSON.stringify(deletedExpertise));
      }
      
      if (deletedWishes.length > 0) {
        form.append("delete_wishes", JSON.stringify(deletedWishes));
      }

      // Social Links - only include non-empty links
      const socialLinks = {
        ...(formData.facebookLink && { facebook: formData.facebookLink }),
        ...(formData.twitterLink && { twitter: formData.twitterLink }),
        ...(formData.linkedinLink && { linkedin: formData.linkedinLink }),
        ...(formData.youtubeLink && { youtube: formData.youtubeLink })
      };
      form.append("social_links", JSON.stringify(socialLinks));

      // Handle image upload
      if (formData.profileImages[0]) {
        if (typeof formData.profileImages[0] === 'string') {
          form.append("profile_personal_image", formData.profileImages[0]);
        } else {
          form.append("profile_personal_image", formData.profileImages[0]);
        }
      }
      
      // With this updated code:
      
      // Handle image upload
      if (formData.profileImages.length > 0) {
        if (typeof formData.profileImages[0] !== 'string') {
          // If it's a File object (new upload), use profile_image
          form.append("profile_image", formData.profileImages[0]);
          console.log("Uploading new profile image file:", formData.profileImages[0].name);
        }
        // Don't send back existing image URLs - server already has them
      }

      // Handle resume upload
      if (formData.resume) {
        if (typeof formData.resume === 'string') {
          form.append("profile_resume", formData.resume);
        } else {
          form.append("profile_resume", formData.resume);
        }
      }

      // Experience - include UIDs for existing entries
      const experiences = formData.experience
        .filter(exp => exp.company || exp.title || exp.startDate || exp.endDate)
        .map(exp => ({
          ...(exp.uid && { uid: exp.uid }),
          company_name: exp.company,
          position: exp.title,
          start_date: exp.startDate,
          end_date: exp.endDate
        }));
      form.append("experiences", JSON.stringify(experiences));
      form.append("profile_personal_experience_is_public", publicFields.profile_personal_experience_is_public);

      // Education - include UIDs for existing entries
      const educations = formData.education
        .filter(edu => edu.school || edu.degree || edu.startDate || edu.endDate)
        .map(edu => ({
          ...(edu.uid && { uid: edu.uid }),
          school_name: edu.school,
          degree: edu.degree,
          course: edu.degree,
          start_date: edu.startDate,
          end_date: edu.endDate
        }));
      form.append("educations", JSON.stringify(educations));
      form.append("profile_personal_education_is_public", publicFields.profile_personal_education_is_public);

      // Expertise - include UIDs for existing entries
      const expertises = formData.expertise
        .filter(exp => exp.headline || exp.description || exp.cost || exp.bounty)
        .map(exp => ({
          ...(exp.uid && { uid: exp.uid }),
          title: exp.headline,
          description: exp.description,
          cost: exp.cost,
          bounty: exp.bounty
        }));
      form.append("expertises", JSON.stringify(expertises));
      form.append("profile_personal_expertise_is_public", publicFields.profile_personal_expertise_is_public);

      // Wishes - include UIDs for existing entries
      const wishes = formData.wishes
      .filter(wish => wish.helpNeeds || wish.details)
      .map(wish => ({
        ...(wish.uid && { uid: wish.uid }),
        title: wish.helpNeeds,
        description: wish.details,
        bounty: wish.bounty || "Free" // Properly save the bounty amount
      }));
    form.append("wishes", JSON.stringify(wishes));
    form.append("profile_personal_wishes_is_public", publicFields.profile_personal_wishes_is_public);
    
  //////
      try {
        setShowSpinner(true);
        
        // Log form data for debugging
        for (let pair of form.entries()) {
          console.log(pair[0] + ': ' + pair[1]);
        }
      
        const response = await axios.put(`https://ioec2testsspm.infiniteoptions.com/api/v1/userprofileinfo`, form, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log("Profile update response:", response);
      
        // Check both response.data.code AND response.status
        if (response.data.code === 200 || response.status === 200) {
          // Clear deleted items arrays after successful update
          setDeletedExperience([]);
          setDeletedEducation([]);
          setDeletedExpertise([]);
          setDeletedWishes([]);
          setDeletedImages([]);
          
          setEditMode(false);
          setTimeout(async () => {
            await fetchProfile();
            handleOpen("Success", "Profile has been updated successfully.");
            setShowSpinner(false);
          }, 1000);
        } else {
          console.error("Error in response:", response.data);
          handleOpen("Error", response.data.message || "Unable to update profile. Please try again.");
          setShowSpinner(false);
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        
        // Check if there's a response in the error object
        if (error.response) {
          console.error("Server response:", error.response.data);
          handleOpen("Error", error.response.data.message || "Cannot update the profile. Server error.");
        } else if (error.request) {
          // The request was made but no response was received
          console.error("No response received:", error.request);
          handleOpen("Error", "Cannot connect to the server. Please check your internet connection.");
        } else {
          // Something happened in setting up the request
          handleOpen("Error", error.message || "Cannot update the profile. Please try again.");
        }
        
        setShowSpinner(false);
      }

      /////
    } else {
      handleOpen("Error", "Please fill in all required fields.");
    }
  };  */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Run validation
    const validateRequiredFields = () => {
      const newErrors = {};
      
      // Required fields validation
      ["firstName", "lastName", "phoneNumber"].forEach((field) => {
        if (!formData[field]) {
          newErrors[field] = `${field} is required`;
        }
      });
      
      if (isValidPhoneNumber(formData.phoneNumber) === false) {
        newErrors["phoneNumber"] = "Invalid phone number format";
      }
      
      // Link validation - ensure they start with https://
      const linkFields = ["facebookLink", "twitterLink", "linkedinLink", "youtubeLink"];
      linkFields.forEach(field => {
        const link = formData[field];
        // Only validate if the link is not empty
        if (link && !link.startsWith("https://")) {
          newErrors[field] = "Link must start with https://";
        }
      });
      
      // Set the errors state
      setErrors(newErrors);
      
      // Return both a boolean indicating validity and the errors object
      return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
    };
  
    // Perform validation
    const { isValid, errors } = validateRequiredFields();
    
    if (isValid) {
      const form = new FormData();
      
      // Personal Info
      form.append("profile_uid", profileId);
      form.append("profile_personal_first_name", formData.firstName);
      form.append("profile_personal_last_name", formData.lastName);
      form.append("profile_personal_phone_number", formData.phoneNumber);
      form.append("profile_personal_phone_number_is_public", publicFields.profile_personal_phone_number_is_public);
      form.append("profile_personal_tag_line", formData.tagLine || "");
      form.append("profile_personal_tag_line_is_public", publicFields.profile_personal_tag_line_is_public);
      form.append("profile_personal_short_bio", formData.shortBio || "");
      form.append("profile_personal_short_bio_is_public", publicFields.profile_personal_short_bio_is_public);
      form.append("profile_personal_image_is_public", publicFields.profile_personal_image_is_public);
      form.append("profile_personal_resume_is_public", publicFields.profile_personal_resume_is_public);
      // Make sure this line is present in your form.append section
      form.append("profile_personal_email_is_public", publicFields.profile_personal_email_is_public);
      form.append("profile_personal_allow_banner_ads", publicFields.profile_personal_allow_banner_ads);
      form.append("profile_personal_banner_ads_bounty", formData.bannerAdsBounty || "");
      
      
      // Add deleted image to form data if exists
      if (deletedImages.length > 0 && 
          !(formData.profileImages.length > 0 && typeof formData.profileImages[0] !== 'string')) {
        // This flag tells the backend to delete the profile image
        form.append("delete_profile_image", deletedImages[0]);
        console.log("Deleting profile image:", deletedImages[0]);
      } else {
        console.log("Skipping profile image deletion - either no image to delete or uploading new image");
      }
  
      // Add deleted UIDs to form data
      if (deletedExperience.length > 0) {
        form.append("delete_experiences", JSON.stringify(deletedExperience));
      }
      
      if (deletedEducation.length > 0) {
        form.append("delete_educations", JSON.stringify(deletedEducation));
      }
      
      if (deletedExpertise.length > 0) {
        form.append("delete_expertises", JSON.stringify(deletedExpertise));
      }
      
      if (deletedWishes.length > 0) {
        form.append("delete_wishes", JSON.stringify(deletedWishes));
      }
  
      // Social Links - only include non-empty links
// Modified code for social links
      const socialLinks = {
        facebook: formData.facebookLink || "", // Always include the property, even if empty
        twitter: formData.twitterLink || "",
        linkedin: formData.linkedinLink || "",
        youtube: formData.youtubeLink || ""
      };
      form.append("social_links", JSON.stringify(socialLinks));
  
      // Handle image upload
      if (formData.profileImages.length > 0) {
        if (typeof formData.profileImages[0] !== 'string') {
          // If it's a File object (new upload), use profile_image
          form.append("profile_image", formData.profileImages[0]);
          console.log("Uploading new profile image file:", formData.profileImages[0].name);
        }
        // Don't send back existing image URLs - server already has them
      }
  //handle resume upload
// Handle resume upload specifically
if (formData.resume) {
  // Log details about the resume for debugging
  if (formData.resume instanceof File) {
    console.log("Resume upload details:", {
      name: formData.resume.name,
      type: formData.resume.type,
      size: formData.resume.size + " bytes"
    });
    
    // Try both field names to ensure compatibility
    form.append("profile_personal_resume", formData.resume);
    
    // Log that we're trying to upload the resume
    console.log("Uploading new resume file as 'profile_personal_resume'");
  } 
  else if (typeof formData.resume === 'string' && formData.resume) {
    // If it's a string URL from an existing resume
    form.append("profile_personal_resume", formData.resume);
    console.log("Using existing resume URL:", formData.resume);
  }
}

      console.log("Form data being sent:");
      for (let pair of form.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
      }
      // Experience - include UIDs for existing entries
      const experiences = formData.experience
        .filter(exp => exp.company || exp.title || exp.startDate || exp.endDate)
        .map(exp => ({
          ...(exp.uid && { uid: exp.uid }),
          company_name: exp.company,
          position: exp.title,
          start_date: exp.startDate,
          end_date: exp.endDate
        }));
      form.append("experiences", JSON.stringify(experiences));
      form.append("profile_personal_experience_is_public", publicFields.profile_personal_experience_is_public);
  
      // Education - include UIDs for existing entries
      const educations = formData.education
        .filter(edu => edu.school || edu.degree || edu.startDate || edu.endDate)
        .map(edu => ({
          ...(edu.uid && { uid: edu.uid }),
          school_name: edu.school,
          degree: edu.degree,
          course: edu.degree,
          start_date: edu.startDate,
          end_date: edu.endDate
        }));
      form.append("educations", JSON.stringify(educations));
      form.append("profile_personal_education_is_public", publicFields.profile_personal_education_is_public);
  
      // Expertise - include UIDs for existing entries
      const expertises = formData.expertise
        .filter(exp => exp.headline || exp.description || exp.cost || exp.bounty)
        .map(exp => ({
          ...(exp.uid && { uid: exp.uid }),
          title: exp.headline,
          description: exp.description,
          cost: exp.cost,
          bounty: exp.bounty
        }));
      form.append("expertises", JSON.stringify(expertises));
      form.append("profile_personal_expertise_is_public", publicFields.profile_personal_expertise_is_public);
  
      // Wishes - include UIDs for existing entries
      const wishes = formData.wishes
        .filter(wish => wish.helpNeeds || wish.details)
        .map(wish => ({
          ...(wish.uid && { uid: wish.uid }),
          title: wish.helpNeeds,
          description: wish.details,
          bounty: wish.bounty || "Free" // Properly save the bounty amount
        }));
      form.append("wishes", JSON.stringify(wishes));
      form.append("profile_personal_wishes_is_public", publicFields.profile_personal_wishes_is_public);
      
      try {
        setShowSpinner(true);
        
        // Log form data for debugging
        for (let pair of form.entries()) {
          console.log(pair[0] + ': ' + pair[1]);
        }
      
        const response = await axios.put(`https://ioec2testsspm.infiniteoptions.com/api/v1/userprofileinfo`, form, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log("Profile update response:", response);
      
        // Check both response.data.code AND response.status
        if (response.data.code === 200 || response.status === 200) {
          // Clear deleted items arrays after successful update
          setDeletedExperience([]);
          setDeletedEducation([]);
          setDeletedExpertise([]);
          setDeletedWishes([]);
          setDeletedImages([]);
          
          setEditMode(false);
          window.scrollTo(0, 0);
          setTimeout(async () => {
            await fetchProfile();
            console.log("Inside ==200")
            handleOpen("Success", "Profile has been updated successfully.");
            setShowSpinner(false);
          }, 1000);
        } else {
          console.error("Error in response:", response.data);
          handleOpen("Error", response.data.message || "Unable to update profile. Please try again.");
          setShowSpinner(false);
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        
        // Check if there's a response in the error object
        if (error.response) {
          console.error("Server response:", error.response.data);
          handleOpen("Error", error.response.data.message || "Cannot update the profile. Server error.");
        } else if (error.request) {
          // The request was made but no response was received
          console.error("No response received:", error.request);
          handleOpen("Error", "Cannot connect to the server. Please check your internet connection.");
        } else {
          // Something happened in setting up the request
          handleOpen("Error", error.message || "Cannot update the profile. Please try again.");
        }
        
        setShowSpinner(false);
      }
    } else {
      // Create an error message from all validation errors
      let errorMessage = "Please fix the following issues:\n\n";
      
      // Format field names to be more readable
      const formatFieldName = (field) => {
        // Remove "Link" suffix from social media fields
        if (field.endsWith("Link")) {
          const socialPlatform = field.replace("Link", "");
          return socialPlatform.charAt(0).toUpperCase() + socialPlatform.slice(1);
        }
        
        // Convert camelCase to Title Case with spaces
        return field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());
      };
      
      // Add each error to the message
      Object.entries(errors).forEach(([field, message]) => {
        errorMessage += `• ${formatFieldName(field)}: ${message}\n`;
      });
      
      // Show the dialog with validation errors
      handleOpen("Validation Error", errorMessage);
    }
  };
  const handleRowClick = (row) => {
    const imageUrls = JSON.parse(row.rating_images_url) || [];

    // Convert into required object format
    const selectedImages = imageUrls.map((url, index) => ({
        index: index,
        file: url,
        coverPhoto: index === 0, 
    }));

    const formattedData = {
        ratingid: row.rating_uid || "",
        businessName: row.business_name || "",
        location: row.business_address_line_1 + ", " + row.business_city + ", " + row.business_state || "",
        rating: row.rating_star || 0,
        lastInteraction: row.rating_receipt_date ? row.rating_receipt_date: null,
        review: row.rating_description || "",
        businessTypes: row.business_types || [],
        ownerFname: row.owner_first_name || "",
        ownerLname: row.owner_last_name || "",
        phoneNumber: row.business_phone_number || "",
        yelpUrl: row.business_yelp || "",
        websiteUrl: row.business_website || "",
        email: row.business_email_id || "",
        receiptImage: row.rating_receipt_url || "",
        selectedImages: selectedImages,
    };

    
    console.log('formattedData', formattedData);

    navigate("/editRecommendation", { state: { formData: formattedData } });
  };

  const columns = [
    { 
      field: 'business_name', 
      headerName: 'Business Name', 
      width: 150,
      renderCell: (params) => {
          return (
              <span 
                  style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }} 
                  onClick={() => handleRowClick(params.row)}
              >
                  {params.value}
              </span>
          );
      }
    },
    { 
        field: 'rating_business_id', 
        headerName: 'Business ID', 
        width: 150,
        renderCell: (params) => {
            return (
                <span 
                    style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }} 
                    onClick={() => handleRowClick(params.row)}
                >
                    {params.value}
                </span>
            );
        }
    },
    {
        field: 'rating_star',
        headerName: 'Rating',
        width: 180,
        renderCell: (params) => {
          return <Rating value={params.value} readOnly />;
        },
    },
    { field: 'rating_description', headerName: 'Description', width: 200 },
  ];

  const handlePublicToggle = (field) => {
    if (!editMode) return;
    
    const fieldMapping = {
        'email': 'profile_personal_email_is_public',
        'phoneNumber': 'profile_personal_phone_number_is_public',
        'location': 'profile_personal_location_is_public',
        'profileImage': 'profile_personal_image_is_public',
        'tagLine': 'profile_personal_tag_line_is_public',
        'shortBio': 'profile_personal_short_bio_is_public',
        'resume': 'profile_personal_resume_is_public',
        'experience': 'profile_personal_experience_is_public',
        'education': 'profile_personal_education_is_public',
        'expertise': 'profile_personal_expertise_is_public',
        'wishes': 'profile_personal_wishes_is_public',
        'bannerAds': 'profile_personal_allow_banner_ads'
    };
    console.log("PublicFields in render:", publicFields);
    const apiField = fieldMapping[field];
    if (apiField) {
        setPublicFields(prev => ({
            ...prev,
            [apiField]: prev[apiField] === 1 ? 0 : 1
        }));
    }
  };

  const handleYesToggle = (field) => {
    if (!editMode) return;
    
    const fieldMapping = {

        'bannerAds': 'profile_personal_allow_banner_ads'
    };
    console.log("PublicFields in render:", publicFields);
    const apiField = fieldMapping[field];
    if (apiField) {
        setPublicFields(prev => ({
            ...prev,
            [apiField]: prev[apiField] === 1 ? 0 : 1
        }));
    }
  };
  

  if (!editMode) {
    return (
      <ProfileView 
        formData={formData}
        publicFields={publicFields}
        onEditClick={(e) => {
          // Prevent any form event behaviors
          if (e) {
            e.preventDefault && e.preventDefault();
            e.stopPropagation && e.stopPropagation();
          }
          
          // Ensure no dialogs are showing when switching modes
          setDialog({ open: false, title: "", content: "" });
          
          // Set edit mode to true
          setEditMode(true);
        }}
        verifiedIcon={verifiedIcon}
      />
    );
  }

 /////////////

 // This section shows where to make changes in the Profile component's render method

  // ...existing code...
///sdhugd
  return (
    <StyledContainer sx={{ maxWidth: "1000px", display: 'flex', margin: "0 auto", padding: 0, boxSizing: "border-box" }}>
      <Backdrop sx={{ color: '#fff', zIndex: 1 }} open={showSpinner}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Header title="Profile" />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '0px 10px', width: '100%', maxWidth: "355px", margin: "0 auto" }}>
  <EditIcon
    onClick={() => setEditMode(false)}
    sx={{ cursor: 'pointer', color: "red" }}
  />
</Box>
      
      
      
      <Box sx={{ borderRadius: '10px', margin: "10px 25px" }}>
        <form>
          <FormBox>
            <InputField
              required
              label="First Name (Public)"
              value={formData.firstName}     /////
              onChange={(value) => setFormData({ ...formData, firstName: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.firstName}
              helperText={errors.firstName}
            />
            <InputField
              required
              label="Last Name (Public)"
              value={formData.lastName}
              onChange={(value) => setFormData({ ...formData, lastName: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.lastName}
              helperText={errors.lastName}
            />
            <Box sx={{ position: 'relative', display: editMode || publicFields.profile_personal_phone_number_is_public === 1 ? 'block' : 'none' }}>
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
              <PublicLabel 
                onClick={() => handlePublicToggle('phoneNumber')}
                disabled={!editMode}
                sx={{ position: 'absolute', right: 0, top: 0 }}
              >
                {publicFields.profile_personal_phone_number_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}

              </PublicLabel>
            </Box>
            
            <Box sx={{ position: 'relative', display: 'block' }}>
            <InputField
              label="Email"
              value={formData.user_email || ""}
              disabled={true} // Email is typically non-editable
              backgroundColor={'#e0e0e0'}
            />
            <PublicLabel 
              onClick={() => handlePublicToggle('email')}
              disabled={!editMode}
              sx={{ position: 'absolute', right: 0, top: 0 }}
            >
              {publicFields.profile_personal_email_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
            </PublicLabel>
          </Box>
            <InputField
              required
              label="Location"
              value={formData.profile_personal_country}
              onChange={(value) => setFormData({ ...formData, location: value })}
              disabled={!editMode}
              backgroundColor={editMode ? 'white' : '#e0e0e0'}
              error={errors.location}
              helperText={errors.location}
            />

            {/* Profile Image Section */}
            <Box sx={{ mb: 3, display: editMode || publicFields.profile_personal_image_is_public === 1 ? 'block' : 'none' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body1" color="text.secondary">
                  Profile Image
                </Typography>
                <PublicLabel 
                  onClick={() => handlePublicToggle('profileImage')}
                  disabled={!editMode}
                >
                  {publicFields.profile_personal_image_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                </PublicLabel>
              </Box>
              {formData.profileImages[0] ? (
                <Box 
                  sx={{ 
                    width: '100%',
                    height: '120px',
                    border: '2px dashed #ccc',
                    borderRadius: '8px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img 
                    src={typeof formData.profileImages[0] === 'string' ? formData.profileImages[0] : URL.createObjectURL(formData.profileImages[0])} 
                    alt="Profile"
                    style={{ 
                      width: '100px',
                      height: '100px',
                      objectFit: 'cover',
                      borderRadius: '4px'
                    }}
                  />
                  {editMode && (
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteImage(formData.profileImages[0])}
                      sx={{ 
                        position: 'absolute', 
                        right: 8, 
                        top: 8, 
                        bgcolor: 'rgba(255,255,255,0.8)',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.9)'
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ) : (
                <UploadButton
                  component="label"
                  disabled={!editMode}
                >
                  <FileUploadIcon sx={{ fontSize: 40, color: "#666", mb: 1 }} />
                  <Typography variant="body2" color="textSecondary">
                    Upload Image
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    (png, jpeg) &lt; 2.5MB
                  </Typography>
                  <input
                    type="file"
                    hidden
                    accept=".png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        handleImageUpload(0, file);
                      }
                    }}
                    disabled={!editMode}
                  />
                </UploadButton>
              )}
            </Box>

            <Box sx={{ position: 'relative', display: editMode || publicFields.profile_personal_tag_line_is_public === 1 ? 'block' : 'none' }}>
              <InputField
                label="Tag Line (40 characters)"
                value={formData.tagLine}
                onChange={(value) => {
                  // Limit to 40 characters
                  const truncatedValue = value.slice(0, 40);
                  setFormData(prev => ({ ...prev, tagLine: truncatedValue }));
                }}
                disabled={!editMode}
                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                helperText={`${formData.tagLine?.length || 0}/40 characters`}
              />
              <PublicLabel 
                onClick={() => handlePublicToggle('tagLine')}
                disabled={!editMode}
                sx={{ position: 'absolute', right: 0, top: 0 }}
              >
                {publicFields.profile_personal_tag_line_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
              </PublicLabel>
            </Box>

            {/* Mini Card */}
            <Box sx={{ padding: '0px 30px', width: '100%', marginBottom: '10px' }}>
              <ProfileCard
                firstName={formData.firstName || ""}
                lastName={formData.lastName || ""}
                tagLine={publicFields.profile_personal_tag_line_is_public === 1 ? formData.tagLine || "" : ""}
                imageUrl={publicFields.profile_personal_image_is_public === 1 ? (
                  formData.profileImages[0] ? (
                    typeof formData.profileImages[0] === 'string' 
                      ? formData.profileImages[0] 
                      : URL.createObjectURL(formData.profileImages[0])
                  ) : ""
                ) : ""}
                email={publicFields.profile_personal_email_is_public === 1 ? formData.user_email || "" : ""}
                phoneNumber={publicFields.profile_personal_phone_number_is_public === 1 ? formData.phoneNumber || "" : ""}
                selectedImages={selectedImages}
                deletedImages={deletedImages}
              />
            </Box>

            <Box sx={{ position: 'relative', display: editMode || publicFields.profile_personal_short_bio_is_public === 1 ? 'block' : 'none' }}>
              <InputField
                label="Short Bio (15 words)"
                multiline
                rows={4}
                value={formData.shortBio}
                onChange={(value) => {
                  // Check if exceeds 15 words
                  if (countWords(value) > 15) {
                    const truncatedBio = truncateToWordLimit(value, 15);
                    setFormData(prev => ({ ...prev, shortBio: truncatedBio }));
                  } else {
                    setFormData(prev => ({ ...prev, shortBio: value }));
                  }
                }}
                disabled={!editMode}
                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                helperText={`${countWords(formData.shortBio || '')}/15 words`}
              />
              <PublicLabel 
                onClick={() => handlePublicToggle('shortBio')}
                disabled={!editMode}
                sx={{ position: 'absolute', right: 0, top: 0 }}
              >
                {publicFields.profile_personal_short_bio_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
              </PublicLabel>
            </Box>

            {/* Add a divider line here */}
            <Box sx={{ borderBottom: '1px solid #e0e0e0', my: 3 }} />

            {/* Resume Upload - Moved above Experience section */}
            <SectionContainer>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Resume</Typography>
                <PublicLabel 
                  onClick={() => handlePublicToggle('resume')}
                  disabled={!editMode}
                >
                  {publicFields.profile_personal_resume_is_public === 1 ? ('Public') : (
  <span style={{ color: 'orange' }}>Private</span>
)}
                </PublicLabel>
              </Box>
              {editMode ? (
                <>
                  <UploadButton
                    component="label"
                    disabled={!editMode}
                  >
                    <FileUploadIcon sx={{ fontSize: 40, color: "#666", mb: 1 }} />
                    <Typography variant="body2" color="textSecondary">
                      {formData.resume ? 'Change Resume' : 'Upload Resume'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      (pdf, doc) &lt; 2.5MB
                    </Typography>
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx"
                      onChange={handleResumeUpload}
                      disabled={!editMode}
                    />
                  </UploadButton>
                  {formData.resume && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        {typeof formData.resume === 'string' ? formData.resume.split('/').pop() : formData.resume.name}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => setFormData(prev => ({ ...prev, resume: null }))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </>
              ) : formData.resume ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" component="a" 
                    href={typeof formData.resume === 'string' ? formData.resume : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ 
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    {typeof formData.resume === 'string' ? formData.resume.split('/').pop() : formData.resume.name}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No resume uploaded
                </Typography>
              )}
            </SectionContainer>

            {/* Experince section */}
            <SectionContainer sx={{ display: editMode || publicFields.profile_personal_experience_is_public === 1 ? 'block' : 'none' }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="h6">Experience</Typography>
      {editMode && (
        <IconButton onClick={handleAddExperience} size="small">
          <AddIcon />
        </IconButton>
      )}
    </Box>
    <PublicLabel 
      onClick={() => handlePublicToggle('experience')}
      disabled={!editMode}
    >
      {publicFields.profile_personal_experience_is_public === 1 ? ('Public') : (
        <span style={{ color: 'orange' }}>Private</span>
      )}
    </PublicLabel>
  </Box>
              
              {formData.experience.map((exp, index) => (
                <Box key={`exp-${index}`} sx={{ 
                  position: 'relative',
                  mb: 2,
                  p: 2,
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  {editMode && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteExperience(index)}
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  <InputField
                    label="Company"
                    value={exp.company}
                    placeholder="Conoco"
                    onChange={(value) => handleExperienceChange(index, "company", value)}
                    disabled={!editMode}
                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                  />
                  <InputField
                    label="Title"
                    value={exp.title}
                    placeholder="Financial Analyst"
                    onChange={(value) => handleExperienceChange(index, "title", value)}
                    disabled={!editMode}
                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                  />
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <InputField
                      label="Start Date"
                      value={exp.startDate}
                      placeholder="06/1988"
                      onChange={(value) => handleExperienceChange(index, "startDate", value)}
                      disabled={!editMode}
                      backgroundColor={editMode ? 'white' : '#e0e0e0'}
                    />
                    <InputField
                      label="End Date"
                      value={exp.endDate}
                      placeholder="08/1991"
                      onChange={(value) => handleExperienceChange(index, "endDate", value)}
                      disabled={!editMode}
                      backgroundColor={editMode ? 'white' : '#e0e0e0'}
                    />
                  </Box>
                </Box>
              ))}
            </SectionContainer>

              {/* Education Section */}
              <SectionContainer sx={{ display: editMode || publicFields.profile_personal_education_is_public === 1 ? 'block' : 'none' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h6">Education:</Typography>
                    {editMode && (
                      <IconButton onClick={handleAddEducation} size="small">
                        <AddIcon />
                      </IconButton>
                    )}
                  </Box>
                  <PublicLabel 
                    onClick={() => handlePublicToggle('education')}
                    disabled={!editMode}
                  >
                    {publicFields.profile_personal_education_is_public === 1 ? ('Public') : (
                      <span style={{ color: 'orange' }}>Private</span>
                    )}
                  </PublicLabel>
                </Box>
              
              {formData.education.map((edu, index) => (
                <Box key={`edu-${index}`} sx={{ 
                  position: 'relative',
                  mb: 2,
                  p: 2,
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  {editMode && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteEducation(index)}
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  <InputField
                    label="School"
                    value={edu.school}
                    placeholder="University of Arizona"
                    onChange={(value) => handleEducationChange(index, "school", value)}
                    disabled={!editMode}
                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                  />
                  <InputField
                    label="Degree"
                    value={edu.degree}
                    placeholder="MS Chemical Engineering"
                    onChange={(value) => handleEducationChange(index, "degree", value)}
                    disabled={!editMode}
                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                  />
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <InputField
                      label="Start Date"
                      value={edu.startDate}
                      placeholder="08/1991"
                      onChange={(value) => handleEducationChange(index, "startDate", value)}
                      disabled={!editMode}
                      backgroundColor={editMode ? 'white' : '#e0e0e0'}
                    />
                    <InputField
                      label="End Date"
                      value={edu.endDate}
                      placeholder="06/1994"
                      onChange={(value) => handleEducationChange(index, "endDate", value)}
                      disabled={!editMode}
                      backgroundColor={editMode ? 'white' : '#e0e0e0'}
                    />
                  </Box>
                </Box>
              ))}
            </SectionContainer>

            {/* Social Links Section */}
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

            {/* Banner Adds Section */}



<BannerSection>
  <Box sx={{ 
    display: 'flex', 
    alignItems: 'center'
  }}>
    <Typography 
      variant="body1" 
      sx={{ 
        fontSize: '14px', 
        whiteSpace: 'nowrap', 
        mr: 1
      }}
    >
      Allow Banner Ads
    </Typography>
    <Box sx={{ 
      display: 'flex',
      alignItems: 'center',
      ml: 1
    }}>
      <img src={moneyBag} alt="Money Bag" style={{ width: '20px', height: '20px' }} />
      <TextField
        size="small"
        placeholder="Bounty"
        value={formData.bannerAdsBounty}
        onChange={(e) => setFormData(prev => ({ ...prev, bannerAdsBounty: e.target.value }))}
        disabled={!editMode}
        sx={{
          width: '80px', // Reduced width
          ml: 1,
          backgroundColor: editMode ? 'white' : '#f5f5f5',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
          },
          '& .MuiInputBase-input': {
            padding: '6px 8px',
            fontSize: '12px'
          }
        }}
      />
    </Box>
  </Box>
  <PublicLabel 
    onClick={() => handleYesToggle('bannerAds')}
    disabled={!editMode}
    sx={{ 
      fontSize: '14px',
      minWidth: 'auto',
      ml: 1
    }}
  >
    {publicFields.profile_personal_allow_banner_ads === 1 ? ('Yes') : (
      <span style={{ color: 'orange' }}>No</span>
    )}
  </PublicLabel>
</BannerSection>

{/* Businesses Section */}
<Box sx={{ mt: 4, mb: 4 }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="h6">Businesses</Typography>
      {editMode && (
        <IconButton 
          onClick={() => {
            const newBusinesses = [...formData.businesses];
            newBusinesses.push({ name: "", role: "" });
            setFormData(prev => ({
              ...prev,
              businesses: newBusinesses
            }));
          }} 
          size="small"
        >
          <AddIcon />
        </IconButton>
      )}
    </Box>
    {/* Any other controls you need on the right side */}
  </Box>
              
              {formData.businesses.map((business, index) => (
                <BusinessCard key={`business-${index}`}>
                  <Box sx={{ position: 'relative' }}>
                    {editMode && (
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          const newBusinesses = [...formData.businesses];
                          newBusinesses.splice(index, 1);
                          setFormData(prev => ({
                            ...prev,
                            businesses: newBusinesses
                          }));
                        }}
                        sx={{ position: 'absolute', right: -8, top: -8 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        placeholder="Business Name"
                        value={business.name}
                        onChange={(e) => {
                          const newBusinesses = [...formData.businesses];
                          newBusinesses[index] = { ...business, name: e.target.value };
                          setFormData(prev => ({
                            ...prev,
                            businesses: newBusinesses
                          }));
                        }}
                        disabled={!editMode}
                        sx={{
                          backgroundColor: editMode ? 'white' : '#e0e0e0',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                          },
                        }}
                      />
                    </Box>
                    <Box>
                      <TextField
                        fullWidth
                        placeholder="Role (Owner/Editor)"
                        value={business.role}
                        onChange={(e) => {
                          const newBusinesses = [...formData.businesses];
                          newBusinesses[index] = { ...business, role: e.target.value };
                          setFormData(prev => ({
                            ...prev,
                            businesses: newBusinesses
                          }));
                        }}
                        disabled={!editMode}
                        sx={{
                          backgroundColor: editMode ? 'white' : '#e0e0e0',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                          },
                        }}
                      />
                    </Box>
                  </Box>
                </BusinessCard>
              ))}
            </Box>

            {/* Rest of the component remains unchanged... */}







            {/* Expertise Section */}
            <SectionContainer sx={{ display: editMode || publicFields.profile_personal_expertise_is_public === 1 ? 'block' : 'none' }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="h6">Expertise</Typography>
      {editMode && (
        <IconButton onClick={() => {
          const newExpertise = [...formData.expertise];
          newExpertise.push({ headline: "", description: "", cost: "", bounty: "" });
          setFormData(prev => ({
            ...prev,
            expertise: newExpertise
          }));
        }} size="small">
          <AddIcon />
        </IconButton>
      )}
    </Box>
    <PublicLabel 
      onClick={() => handlePublicToggle('expertise')}
      disabled={!editMode}
    >
      {publicFields.profile_personal_expertise_is_public === 1 ? ('Public') : (
        <span style={{ color: 'orange' }}>Private</span>
      )}
    </PublicLabel>
  </Box>
              
              {formData.expertise.map((item, index) => (
                <Box key={`expertise-${index}`} sx={{ 
                  position: 'relative',
                  mb: 2,
                  p: 2,
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  {editMode && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteExpertise(index)}
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  <InputField
                    label="Headline"
                    value={item.headline || ""}
                    placeholder="Enter expertise headline"
                    onChange={(value) => handleExpertiseChange(index, "headline", value)}
                    disabled={!editMode}
                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                  />
                  <InputField
                    label="Description"
                    value={item.description || ""}
                    placeholder="Enter expertise description"
                    onChange={(value) => handleExpertiseChange(index, "description", value)}
                    disabled={!editMode}
                    backgroundColor={editMode ? 'white' : '#e0e0e0'}
                    multiline
                    rows={2}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mr: 1, minWidth: '40px' }}>
                        Cost
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Free"
                        value={item.cost || ""}
                        onChange={(e) => handleExpertiseChange(index, "cost", e.target.value)}
                        disabled={!editMode}
                        sx={{
                          backgroundColor: editMode ? 'white' : '#e0e0e0',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                          },
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <img src={moneyBag} alt="Cost" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Free"
                        value={item.bounty || ""}
                        onChange={(e) => handleExpertiseChange(index, "bounty", e.target.value)}
                        disabled={!editMode}
                        sx={{
                          backgroundColor: editMode ? 'white' : '#e0e0e0',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                          },
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              ))}
            </SectionContainer>

            {/* Wishes Section */}
        {/*     f    */ }

        {/* Wishes Section */}
        {/* Wishes Section */}

        <SectionContainer sx={{ display: editMode || publicFields.profile_personal_wishes_is_public === 1 ? 'block' : 'none' }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="h6">Wishes</Typography>
      {editMode && (
        <IconButton onClick={() => {
          const newWishes = [...formData.wishes];
          newWishes.push({ helpNeeds: "", details: "", bounty: "Free" });
          setFormData(prev => ({
            ...prev,
            wishes: newWishes
          }));
        }} size="small">
          <AddIcon />
        </IconButton>
      )}
    </Box>
    <PublicLabel 
      onClick={() => handlePublicToggle('wishes')}
      disabled={!editMode}
    >
      {publicFields.profile_personal_wishes_is_public === 1 ? ('Public') : (
        <span style={{ color: 'orange' }}>Private</span>
      )}
    </PublicLabel>
  </Box>
          
          {formData.wishes.map((item, index) => (
            <Box key={`wish-${index}`} sx={{ 
              position: 'relative',
              mb: 2,
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: '8px'
            }}>
              {editMode && (
                <IconButton 
                  size="small" 
                  onClick={() => handleDeleteWish(index)}
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
              <InputField
                label="Title"
                value={item.helpNeeds || ""}
                placeholder="What help do you need?"
                onChange={(value) => handleWishChange(index, "helpNeeds", value)}
                disabled={!editMode}
                backgroundColor={editMode ? 'white' : '#e0e0e0'}
              />
              <InputField
                label="Help Needed (15 words)"
                value={item.details || ""}
                placeholder="Enter details about your need"
                onChange={(value) => handleWishChange(index, "details", value)}
                disabled={!editMode}
                backgroundColor={editMode ? 'white' : '#e0e0e0'}
                multiline
                rows={2}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <img src={moneyBag} alt="Money Bag" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                <TextField
                  size="small"
                  placeholder="Free"
                  value={item.bounty || "Free"}
                  onChange={(e) => handleWishChange(index, "bounty", e.target.value)}
                  disabled={!editMode}
                  sx={{
                    maxWidth: '120px',
                    backgroundColor: editMode ? 'white' : '#f5f5f5',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                    },
                    '& .MuiInputBase-input': {
                      padding: '8px 12px',
                    }
                  }}
                />
              </Box>
            </Box>
          ))}
        </SectionContainer>

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

        {/* ratings */}
        <Box sx={{ width: '100%', my: 3 }}>
            <Typography variant="h6" align="center" sx={{ mb: 2 }}>
                Recommendations
            </Typography>
            <div style={{ height: 400, width: '100%' }}>
                <DataGrid rows={ratings} columns={columns} pageSize={5} getRowId={(row) => row.rating_uid}/>
            </div>
        </Box>

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