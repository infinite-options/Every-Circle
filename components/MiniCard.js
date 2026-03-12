//components/MiniCard.js
import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";

// Web-compatible asset helper: default profile image for MiniCard (user and business)
// On native, require() works; on web we try require() so the default shows on both platforms
let PROFILE_IMAGE_SOURCE;
try {
  PROFILE_IMAGE_SOURCE = require("../assets/profile.png");
} catch (e) {
  if (Platform.OS !== "web") {
    console.warn("Could not load profile.png on native");
  }
  PROFILE_IMAGE_SOURCE = null;
}

/** Returns a source suitable for Image component when no custom image or Display is off. Works on web and mobile. */
function getDefaultProfileImageSource() {
  if (PROFILE_IMAGE_SOURCE) return PROFILE_IMAGE_SOURCE;
  try {
    return require("../assets/profile.png");
  } catch (e) {
    return { uri: "" };
  }
}

const MiniCard = ({ user, business, showRelationship = false }) => {
  const { darkMode } = useDarkMode();

  // --------------------------
  // HANDLE BUSINESS CARD
  // --------------------------
  if (business) {
    const businessName = sanitizeText(business.business_name);
    const tagline = sanitizeText(business.tagline || business.business_tag_line || "");
    const location = sanitizeText(business.business_location || "");
    const addressLine1 = sanitizeText(business.business_address_line_1 || "");
    const city = sanitizeText(business.business_city || "");
    const state = sanitizeText(business.business_state || "");
    const zipCode = sanitizeText(business.business_zip_code);
    const phone = sanitizeText(business.business_phone_number);
    const email = sanitizeText(business.business_email || business.business_email_id || "");
    const website = sanitizeText(business.business_website || "");
    const phoneIsPublic = business.phoneIsPublic;
    const emailIsPublic = business.emailIsPublic;
    const taglineIsPublic = business.taglineIsPublic;
    // For business, check if locationIsPublic is provided, otherwise default to true for backward compatibility
    const locationIsPublic = business.locationIsPublic !== undefined ? business.locationIsPublic : true;

    // Business profile image: prefer business_profile_img, then first_image, then business_image
    let businessImage = null;
    if (business.business_profile_img && typeof business.business_profile_img === "string" && business.business_profile_img.trim() !== "") {
      businessImage = business.business_profile_img;
    } else if (business.first_image) {
      if (typeof business.first_image === "string") businessImage = business.first_image;
      else if (business.first_image.url) businessImage = business.first_image.url;
      else if (business.first_image.photo_url) businessImage = business.first_image.photo_url;
    } else if (business.business_image) {
      if (typeof business.business_image === "string") businessImage = business.business_image;
      else if (business.business_image.url) businessImage = business.business_image.url;
      else if (business.business_image.photo_url) businessImage = business.business_image.photo_url;
    }

    // MiniCard: show profile image only when there is an image AND it is set to Display; otherwise default
    const hasProfileImage = businessImage && typeof businessImage === "string" && businessImage.trim() !== "";
    const shouldShowProfileImage = hasProfileImage && (business.imageIsPublic === true || business.imageIsPublic === "1" || business.imageIsPublic === 1);

    let imageSource;
    if (shouldShowProfileImage) {
      imageSource = { uri: businessImage };
    } else {
      imageSource = getDefaultProfileImageSource();
    }

    return (
      <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
        {/* HEADER: Name and Tagline above image */}
        <View style={styles.headerContainer}>
          {/* BUSINESS NAME */}
          {(() => {
            const name = businessName || "Business";
            if (name === "." || name.trim() === "") {
              return <Text style={[styles.name, darkMode && styles.darkName]}>Business</Text>;
            }
            return <Text style={[styles.name, darkMode && styles.darkName]}>{name}</Text>;
          })()}

          {/* TAGLINE */}
          {(() => {
            if (taglineIsPublic && isSafeForConditional(tagline) && tagline !== "." && tagline.trim() !== "") {
              return <Text style={[styles.tagline, darkMode && styles.darkText]}>{tagline}</Text>;
            }
            return null;
          })()}
        </View>

        {/* BODY: Image on left, details on right */}
        <View style={styles.bodyContainer}>
          {(() => {
            const defaultImg = getDefaultProfileImageSource();
            const hasValidDefault = defaultImg && (typeof defaultImg === "number" || (typeof defaultImg === "object" && defaultImg?.uri !== ""));
            return (
              <Image
                source={imageSource}
                style={[styles.profileImage, darkMode && styles.darkProfileImage]}
                onError={(error) => {
                  console.log("MiniCard business image failed to load:", error.nativeEvent.error);
                  console.log("Problematic business image URI:", businessImage);
                }}
                {...(hasValidDefault ? { defaultSource: defaultImg } : {})}
              />
            );
          })()}

          <View style={styles.textContainer}>
            {/* BUSINESS PHONE */}
            {(() => {
              if (phoneIsPublic && isSafeForConditional(phone) && phone !== "." && phone.trim() !== "") {
                return <Text style={[styles.phone, darkMode && styles.darkText]}>{phone}</Text>;
              }
              return null;
            })()}

            {/* BUSINESS EMAIL */}
            {(() => {
              if (emailIsPublic && isSafeForConditional(email) && email !== "." && email.trim() !== "") {
                return <Text style={[styles.email, darkMode && styles.darkText]}>{email}</Text>;
              }
              return null;
            })()}

            {/* LOCATION (business_location and business_address_line_1 combined) */}
            {(() => {
              if (locationIsPublic && (isSafeForConditional(location) || isSafeForConditional(addressLine1))) {
                const addressParts = [];
                if (location && location !== "." && location.trim() !== "") addressParts.push(location);
                if (addressLine1 && addressLine1 !== "." && addressLine1.trim() !== "") addressParts.push(addressLine1);

                const fullAddress = addressParts.join(", ");

                if (fullAddress && fullAddress.trim() !== "") {
                  return <Text style={[styles.location, darkMode && styles.darkText]}>{fullAddress}</Text>;
                }
              }
              return null;
            })()}

            {/* CITY, STATE (on same line) */}
            {(() => {
              if (locationIsPublic && (isSafeForConditional(city) || isSafeForConditional(state))) {
                const locationParts = [];
                if (city && city !== "." && city.trim() !== "") locationParts.push(city);
                if (state && state !== "." && state.trim() !== "") locationParts.push(state);

                const locationText = locationParts.join(", ");

                if (locationText && locationText.trim() !== "") {
                  return <Text style={[styles.city, darkMode && styles.darkText]}>{locationText}</Text>;
                }
              }
              return null;
            })()}
          </View>
        </View>
      </View>
    );
  }

  // --------------------------
  // HANDLE USER CARD
  // --------------------------
  const firstName = sanitizeText(user?.firstName || user?.personal_info?.profile_personal_first_name);
  const lastName = sanitizeText(user?.lastName || user?.personal_info?.profile_personal_last_name);
  const tagLine = sanitizeText(user?.tagLine || user?.personal_info?.profile_personal_tagline);
  const email = sanitizeText(user?.email || user?.user_email);
  const phone = sanitizeText(user?.phoneNumber || user?.personal_info?.profile_personal_phone_number);
  // Resolve profile image URL from either flattened (profileImage) or API shape (personal_info.profile_personal_image)
  const profileImageRaw = user?.profileImage ?? user?.personal_info?.profile_personal_image ?? "";
  const profileImage = sanitizeText(typeof profileImageRaw === "string" ? profileImageRaw : String(profileImageRaw || ""));

  const emailIsPublic = user?.personal_info?.profile_personal_email_is_public == 1 || user?.emailIsPublic;
  const phoneIsPublic = user?.personal_info?.profile_personal_phone_number_is_public == 1 || user?.phoneIsPublic;
  const tagLineIsPublic = user?.personal_info?.profile_personal_tagline_is_public == 1 || user?.tagLineIsPublic;
  // Display = TRUE: show uploaded image when user has chosen to display it (works with 1, "1", true from API or flattened shape)
  const imageIsPublic = user?.personal_info?.profile_personal_image_is_public == 1 || user?.imageIsPublic === true || user?.imageIsPublic === 1 || user?.imageIsPublic === "1";
  const city = sanitizeText(user?.personal_info?.profile_personal_city || user?.city || "");
  const state = sanitizeText(user?.personal_info?.profile_personal_state || user?.state || "");
  const locationIsPublic = user?.personal_info?.profile_personal_location_is_public === 1 || user?.locationIsPublic === true;

  // Profile image rule: show uploaded image only when (image uploaded AND Display is TRUE); otherwise show default (web + mobile)
  const hasUploadedImage = profileImage && String(profileImage).trim() !== "" && isSafeForConditional(profileImage);
  const showUploadedImage = hasUploadedImage && imageIsPublic;
  const userImageSource = showUploadedImage ? { uri: String(profileImage) } : getDefaultProfileImageSource();

  return (
    <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
      {/* HEADER: Name and Tagline */}
      <View style={styles.headerContainer}>
        {/* NAME */}
        {(() => {
          const nameParts = [firstName, lastName].filter((part) => part && part !== "." && part.trim() !== "" && !part.match(/^[\s.,;:!?\-_=+]*$/));

          const name = nameParts.length ? nameParts.join(" ") : "Unknown";

          if (!name || name === "." || name.trim() === "") {
            return <Text style={[styles.name, darkMode && styles.darkName]}>Unknown</Text>;
          }

          return <Text style={[styles.name, darkMode && styles.darkName]}>{name}</Text>;
        })()}

        {/* TAGLINE */}
        {(() => {
          if (tagLineIsPublic && isSafeForConditional(tagLine) && tagLine !== "." && tagLine.trim() !== "") {
            return <Text style={[styles.tagline, darkMode && styles.darkText]}>{tagLine}</Text>;
          }
          return null;
        })()}
      </View>

      {/* BODY: Image on left, details on right */}
      <View style={styles.bodyContainer}>
        {(() => {
          const defaultImgSource = getDefaultProfileImageSource();
          const hasValidDefault = defaultImgSource && (typeof defaultImgSource === "number" || (typeof defaultImgSource === "object" && defaultImgSource?.uri !== ""));
          return (
            <Image
              source={userImageSource}
              style={[styles.profileImage, darkMode && styles.darkProfileImage]}
              onError={(error) => {
                console.log("MiniCard user image failed to load:", error.nativeEvent.error);
                console.log("Problematic user image URI:", profileImage);
              }}
              {...(hasValidDefault ? { defaultSource: defaultImgSource } : {})}
            />
          );
        })()}

        <View style={styles.textContainer}>
          {/* PHONE */}
          {(() => {
            if (phoneIsPublic && isSafeForConditional(phone) && phone !== "." && phone.trim() !== "") {
              return <Text style={[styles.phone, darkMode && styles.darkText]}>{phone}</Text>;
            }
            return null;
          })()}

          {/* EMAIL */}
          {(() => {
            if (emailIsPublic && isSafeForConditional(email) && email !== "." && email.trim() !== "") {
              return <Text style={[styles.email, darkMode && styles.darkText]}>{email}</Text>;
            }
            return null;
          })()}

          {/* CITY, STATE */}
          {(() => {
            if (locationIsPublic && (isSafeForConditional(city) || isSafeForConditional(state))) {
              const locationParts = [];
              if (city && city !== "." && city.trim() !== "") locationParts.push(city);
              if (state && state !== "." && state.trim() !== "") locationParts.push(state);

              const locationText = locationParts.join(", ");

              if (locationText && locationText.trim() !== "") {
                return <Text style={[styles.city, darkMode && styles.darkText]}>{locationText}</Text>;
              }
            }
            return null;
          })()}

          {/* RELATIONSHIP - Only show if showRelationship prop is true */}
          {showRelationship &&
            (() => {
              const relationship = user?.relationship || user?.circle_relationship;
              const relationshipText = relationship && relationship !== null && relationship.trim() !== "" ? relationship.charAt(0).toUpperCase() + relationship.slice(1) : "Relationship not Assigned";
              return <Text style={[styles.relationship, darkMode && styles.darkText]}>{relationshipText}</Text>;
            })()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#000",
    marginVertical: 5,
  },
  // New header container for name and tagline
  headerContainer: {
    marginBottom: 10,
  },
  // New body container for image and details
  bodyContainer: {
    flexDirection: "row",
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: "#666",
    marginBottom: 0, // Remove bottom margin since it's in header now
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  city: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  relationship: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
    fontStyle: "italic",
  },
  location: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  website: {
    fontSize: 14,
    color: "#1a73e8",
    marginBottom: 2,
  },
  darkCardContainer: {
    backgroundColor: "#2d2d2d",
    borderColor: "#000",
  },
  darkName: {
    color: "#ffffff",
  },
  darkText: {
    color: "#cccccc",
  },
  darkProfileImage: {
    // tintColor moved to Image prop
  },
});

export default MiniCard;
