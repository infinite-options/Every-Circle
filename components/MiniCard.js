//components/MiniCard.js
import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useDarkMode } from "../contexts/DarkModeContext";
import { sanitizeText, isSafeForConditional } from "../utils/textSanitizer";

// Web-compatible asset helper
// On web, require() for local assets may cause issues with Metro bundler
// We'll handle this by conditionally setting defaultSource
let PROFILE_IMAGE_SOURCE;
if (Platform.OS !== "web") {
  // On native, require works normally
  try {
    PROFILE_IMAGE_SOURCE = require("../assets/profile.png");
  } catch (e) {
    console.warn("Could not load profile.png on native");
    PROFILE_IMAGE_SOURCE = null;
  }
} else {
  // On web, we'll skip the require to avoid Metro bundler issues
  // The Image component will handle missing images gracefully
  PROFILE_IMAGE_SOURCE = null;
}

const MiniCard = ({ user, business, showRelationship = false }) => {
  const { darkMode } = useDarkMode();

  if (__DEV__) {
    console.log("🔵 MiniCard - RENDER START", { hasUser: !!user, hasBusiness: !!business });
  }

  // --------------------------
  // HANDLE BUSINESS CARD
  // --------------------------
  if (business) {
    if (__DEV__) console.log("🔵 MiniCard - Rendering BUSINESS card");
    if (__DEV__) {
      console.log("🔍 MiniCard - Business data received:", {
        business_name: business.business_name,
        business_address_line_1: business.business_address_line_1,
        business_zip_code: business.business_zip_code,
        business_phone_number: business.business_phone_number,
        business_website: business.business_website,
      });
    }

    const businessName = sanitizeText(business.business_name);
    const tagline = sanitizeText(business.tagline || business.business_tag_line || "");
    const location = sanitizeText(business.business_address_line_1);
    const city = sanitizeText(business.business_city || "");
    const state = sanitizeText(business.business_state || "");
    const zipCode = sanitizeText(business.business_zip_code);
    const phone = sanitizeText(business.business_phone_number);
    const website = sanitizeText(business.business_website);
    const phoneIsPublic = business.phoneIsPublic;
    const taglineIsPublic = business.taglineIsPublic;
    // For business, we'll show location/city/state if they exist (no separate locationIsPublic flag for business yet)
    const locationIsPublic = true; // Default to true for business, can be made configurable later

    if (__DEV__) {
      const sanitized = { businessName, location, zipCode, phone, website };
      if (Object.values(sanitized).some((v) => v === ".")) {
        console.error("🚨 MiniCard - PERIOD DETECTED in sanitized values:", sanitized);
      }
    }

    let businessImage = null;
    // Check for first_image (used for multiple images - first one)
    if (business.first_image) {
      if (typeof business.first_image === "string") businessImage = business.first_image;
      else if (business.first_image.url) businessImage = business.first_image.url;
      else if (business.first_image.photo_url) businessImage = business.first_image.photo_url;
    }
    // Also check for business_image (used for single image upload)
    else if (business.business_image) {
      if (typeof business.business_image === "string") businessImage = business.business_image;
      else if (business.business_image.url) businessImage = business.business_image.url;
      else if (business.business_image.photo_url) businessImage = business.business_image.photo_url;
    }

    // Determine the image source with proper fallback
    let imageSource;
    if (businessImage && typeof businessImage === "string" && businessImage.trim() !== "") {
      imageSource = { uri: businessImage };
    } else if (PROFILE_IMAGE_SOURCE) {
      imageSource = PROFILE_IMAGE_SOURCE;
    } else {
      // Fallback for web - use require() which should work in React Native Web
      try {
        imageSource = require("../assets/profile.png");
      } catch (e) {
        // If require fails on web, use empty URI as last resort
        imageSource = { uri: "" };
      }
    }

    return (
      <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
        {/* HEADER: Name and Tagline above image */}
        <View style={styles.headerContainer}>
          {/* BUSINESS NAME */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Rendering business name:", businessName);
            const name = businessName || "Business";
            if (name === "." || name.trim() === "") {
              if (__DEV__) console.log("🔵 MiniCard - Invalid business name, using fallback");
              return <Text style={[styles.name, darkMode && styles.darkName]}>Business</Text>;
            }
            return <Text style={[styles.name, darkMode && styles.darkName]}>{name}</Text>;
          })()}

          {/* TAGLINE */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Checking business tagline:", { tagline, taglineIsPublic, isSafe: isSafeForConditional(tagline) });
            if (taglineIsPublic && isSafeForConditional(tagline) && tagline !== "." && tagline.trim() !== "") {
              if (__DEV__) console.log("🔵 MiniCard - Rendering business tagline");
              return <Text style={[styles.tagline, darkMode && styles.darkText]}>{tagline}</Text>;
            }
            return null;
          })()}
        </View>

        {/* BODY: Image on left, details on right */}
        <View style={styles.bodyContainer}>
          {(() => {
            // Check if image should be displayed based on imageIsPublic flag
            const shouldShowImage = business.imageIsPublic !== false && business.imageIsPublic !== "0";
            if (__DEV__) console.log("🔵 MiniCard - Rendering business image", { shouldShowImage, imageIsPublic: business.imageIsPublic });
            if (__DEV__) console.log("🔵 MiniCard - businessImage:", businessImage);
            if (__DEV__) console.log("🔵 MiniCard - imageSource:", imageSource);
            
            if (!shouldShowImage) {
              // If image is hidden, show placeholder
              return (
                <Image
                  source={PROFILE_IMAGE_SOURCE || require("../assets/profile.png")}
                  style={[styles.profileImage, darkMode && styles.darkProfileImage]}
                />
              );
            }
            
            return (
              <Image
                source={imageSource}
                style={[styles.profileImage, darkMode && styles.darkProfileImage]}
                onError={(error) => {
                  console.log("MiniCard business image failed to load:", error.nativeEvent.error);
                  console.log("Problematic business image URI:", businessImage);
                }}
                defaultSource={PROFILE_IMAGE_SOURCE || require("../assets/profile.png")}
              />
            );
          })()}

          <View style={styles.textContainer}>
            {/* BUSINESS PHONE */}
            {(() => {
              if (__DEV__) console.log("🔵 MiniCard - Checking business phone:", { phone, phoneIsPublic, isSafe: isSafeForConditional(phone) });
              if (phoneIsPublic && isSafeForConditional(phone) && phone !== "." && phone.trim() !== "") {
                if (__DEV__) console.log("🔵 MiniCard - Rendering business phone");
                return <Text style={[styles.phone, darkMode && styles.darkText]}>{phone}</Text>;
              }
              return null;
            })()}

            {/* LOCATION (Address Line 1) */}
            {(() => {
              if (__DEV__) console.log("🔵 MiniCard - Rendering location:", { location, locationIsPublic });
              if (locationIsPublic && location && location !== "." && location.trim() !== "" && isSafeForConditional(location)) {
                if (__DEV__) console.log("🔵 MiniCard - Rendering location");
                return <Text style={[styles.location, darkMode && styles.darkText]}>{location}</Text>;
              }
              return null;
            })()}

            {/* CITY, STATE (on same line) */}
            {(() => {
              if (__DEV__) console.log("🔵 MiniCard - Checking city/state:", { city, state, locationIsPublic, isSafeCity: isSafeForConditional(city), isSafeState: isSafeForConditional(state) });
              
              if (locationIsPublic && (isSafeForConditional(city) || isSafeForConditional(state))) {
                const locationParts = [];
                if (city && city !== "." && city.trim() !== "") locationParts.push(city);
                if (state && state !== "." && state.trim() !== "") locationParts.push(state);

                const locationText = locationParts.join(", ");

                if (locationText && locationText.trim() !== "") {
                  if (__DEV__) console.log("🔵 MiniCard - Rendering city/state:", locationText);
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
  if (__DEV__) console.log("🔵 MiniCard - Rendering USER card, user data:", user);
  const firstName = sanitizeText(user?.firstName || user?.personal_info?.profile_personal_first_name);
  const lastName = sanitizeText(user?.lastName || user?.personal_info?.profile_personal_last_name);
  const tagLine = sanitizeText(user?.tagLine || user?.personal_info?.profile_personal_tagline);
  const email = sanitizeText(user?.email || user?.user_email);
  const phone = sanitizeText(user?.phoneNumber || user?.personal_info?.profile_personal_phone_number);
  const profileImage = sanitizeText(user?.profileImage);

  if (__DEV__) {
    console.log("🔵 MiniCard - After sanitization:", { firstName, lastName, tagLine, email, phone, profileImage });
    const hasPeriod = [firstName, lastName, tagLine, email, phone, profileImage].some((v) => v === ".");
    if (hasPeriod) {
      console.error("🚨 MiniCard - PERIOD DETECTED in user data after sanitization!");
    }
  }

  const emailIsPublic = user?.personal_info?.profile_personal_email_is_public == 1 || user?.emailIsPublic;
  const phoneIsPublic = user?.personal_info?.profile_personal_phone_number_is_public == 1 || user?.phoneIsPublic;
  const tagLineIsPublic = user?.personal_info?.profile_personal_tagline_is_public == 1 || user?.tagLineIsPublic;
  const imageIsPublic = user?.personal_info?.profile_personal_image_is_public == 1 || user?.imageIsPublic;
  const city = sanitizeText(user?.personal_info?.profile_personal_city || user?.city || "");
  const state = sanitizeText(user?.personal_info?.profile_personal_state || user?.state || "");
  const locationIsPublic = user?.personal_info?.profile_personal_location_is_public === 1 || user?.locationIsPublic === true;
  
  
  return (
    <View style={[styles.cardContainer, darkMode && styles.darkCardContainer]}>
      {/* HEADER: Name and Tagline */}
      <View style={styles.headerContainer}>
        {/* NAME */}
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Rendering user name:", { firstName, lastName });
          const nameParts = [firstName, lastName].filter((part) => part && part !== "." && part.trim() !== "" && !part.match(/^[\s.,;:!?\-_=+]*$/));

          const name = nameParts.length ? nameParts.join(" ") : "Unknown";
          if (__DEV__) console.log("🔵 MiniCard - User name result:", name);

          if (!name || name === "." || name.trim() === "") {
            if (__DEV__) console.log("🔵 MiniCard - Invalid user name, using fallback");
            return <Text style={[styles.name, darkMode && styles.darkName]}>Unknown</Text>;
          }

          return <Text style={[styles.name, darkMode && styles.darkName]}>{name}</Text>;
        })()}

        {/* TAGLINE */}
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Checking tagline:", { tagLine, tagLineIsPublic, isSafe: isSafeForConditional(tagLine) });
          if (tagLineIsPublic && isSafeForConditional(tagLine) && tagLine !== "." && tagLine.trim() !== "") {
            if (__DEV__) console.log("🔵 MiniCard - Rendering tagline");
            return <Text style={[styles.tagline, darkMode && styles.darkText]}>{tagLine}</Text>;
          }
          return null;
        })()}
      </View>

      {/* BODY: Image on left, details on right */}
      <View style={styles.bodyContainer}>
        {(() => {
          if (__DEV__) console.log("🔵 MiniCard - Rendering user image:", { profileImage, imageIsPublic, isSafe: isSafeForConditional(profileImage) });
          
          // Determine image source - avoid empty string URIs
          // Check if profileImage is valid (not empty, not null, not undefined)
          const profileImageStr = profileImage ? String(profileImage).trim() : "";
          const hasValidProfileImage = profileImageStr !== "" && 
                                       isSafeForConditional(profileImage) && 
                                       imageIsPublic;
          
          let imageSource;
          if (hasValidProfileImage) {
            imageSource = { uri: String(profileImage) };
          } else if (PROFILE_IMAGE_SOURCE) {
            imageSource = PROFILE_IMAGE_SOURCE;
          } else {
            // On web when PROFILE_IMAGE_SOURCE is null, don't render the image
            // This prevents the { uri: "" } error
            return null;
          }
          
          return (
            <Image
              source={imageSource}
              style={[styles.profileImage, darkMode && styles.darkProfileImage]}
              onError={(error) => {
                // Only log errors in dev mode and if we have a non-empty profileImage
                if (__DEV__ && hasValidProfileImage) {
                  console.log("MiniCard user image failed to load:", error.nativeEvent.error);
                  console.log("Problematic user image URI:", profileImage);
                }
              }}
              {...(PROFILE_IMAGE_SOURCE && { defaultSource: PROFILE_IMAGE_SOURCE })}
            />
          );
        })()}

        <View style={styles.textContainer}>
          {/* EMAIL */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Checking email:", { email, emailIsPublic, isSafe: isSafeForConditional(email) });
            if (emailIsPublic && isSafeForConditional(email) && email !== "." && email.trim() !== "") {
              if (__DEV__) console.log("🔵 MiniCard - Rendering email");
              return <Text style={[styles.email, darkMode && styles.darkText]}>{email}</Text>;
            }
            return null;
          })()}

          {/* PHONE */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Checking phone:", { phone, phoneIsPublic, isSafe: isSafeForConditional(phone) });
            if (phoneIsPublic && isSafeForConditional(phone) && phone !== "." && phone.trim() !== "") {
              if (__DEV__) console.log("🔵 MiniCard - Rendering phone");
              return <Text style={[styles.phone, darkMode && styles.darkText]}>{phone}</Text>;
            }
            return null;
          })()}

          {/* CITY, STATE */}
          {(() => {
            if (__DEV__) console.log("🔵 MiniCard - Checking city/state:", { city, state, locationIsPublic, isSafeCity: isSafeForConditional(city), isSafeState: isSafeForConditional(state) });

            if (locationIsPublic && (isSafeForConditional(city) || isSafeForConditional(state))) {
              const locationParts = [];
              if (city && city !== "." && city.trim() !== "") locationParts.push(city);
              if (state && state !== "." && state.trim() !== "") locationParts.push(state);

              const locationText = locationParts.join(", ");

              if (locationText && locationText.trim() !== "") {
                if (__DEV__) console.log("🔵 MiniCard - Rendering city/state:", locationText);
                return <Text style={[styles.city, darkMode && styles.darkText]}>{locationText}</Text>;
              }
            }
            return null;
          })()}

          {/* RELATIONSHIP - Only show if showRelationship prop is true */}
          {showRelationship &&
            (() => {
              const relationship = user?.relationship || user?.circle_relationship;
              if (__DEV__) console.log("🔵 MiniCard - Checking relationship:", relationship);
              const relationshipText = relationship && relationship !== null && relationship.trim() !== "" ? relationship.charAt(0).toUpperCase() + relationship.slice(1) : "Relationship not Assigned";
              if (__DEV__) console.log("🔵 MiniCard - Rendering relationship:", relationshipText);
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
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.1)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }),
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
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.3)",
        }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.3,
        }),
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
