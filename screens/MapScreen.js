import React, { useState, useRef } from "react";
import { StyleSheet, View, Dimensions, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import config from "../config";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// San Francisco coordinates
const DEFAULT_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: LATITUDE_DELTA,
  longitudeDelta: LONGITUDE_DELTA,
};

console.log("Google Maps API Key being used:", config.googleMapsApiKey);
console.log("Initializing GooglePlacesAutocomplete with API key:", config.googleMapsApiKey);

export default function MapScreen({ onLogout }) {
  const [isAutocompleteFocused, setAutocompleteFocused] = useState(false);
  const lastTextRef = useRef("");
  const [region, setRegion] = useState(DEFAULT_LOCATION);
  const [markerLocation, setMarkerLocation] = useState(DEFAULT_LOCATION);
  const mapRef = useRef(null);

  const handleZoom = (zoomIn) => {
    // console.log("handleZoom called with zoomIn:", zoomIn);
    const newRegion = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: zoomIn ? region.latitudeDelta / 2 : region.latitudeDelta * 2,
      longitudeDelta: zoomIn ? region.longitudeDelta / 2 : region.longitudeDelta * 2,
    };
    setRegion(newRegion);
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  const handlePlaceSelected = (data, details = null) => {
    // if (!details || !details.geometry || !details.geometry.location) return;

    // console.log("Place selected:", data.description);
    // console.log("Place details:", details);

    // console.log("handlePlaceSelected called with data:", data);

    if (!details) {
      console.error("No details provided to handlePlaceSelected");
      return;
    }

    if (!details.geometry) {
      console.error("No geometry in place details:", details);
      return;
    }

    if (!details.geometry.location) {
      console.error("No location in geometry:", details.geometry);
      return;
    }

    console.log("Processing valid place selection:", {
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng,
    });

    const newLocation = {
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };

    // Prevent unnecessary updates
    setRegion((prevRegion) => {
      console.log("Previous region:", prevRegion);
      console.log("New region:", newLocation);
      if (prevRegion.latitude === newLocation.latitude && prevRegion.longitude === newLocation.longitude) {
        return prevRegion; // No update needed
      }
      return newLocation;
    });

    setMarkerLocation(newLocation);

    // Animate map to new location only if necessary
    // mapRef.current?.animateToRegion(newLocation, 1000);
    if (mapRef.current) {
      mapRef.current.animateToRegion(newLocation, 1000);
    }
  };

  // const handlePlaceSelected = (data, details = null) => {
  //   console.log("Place selected:", data.description);
  //   if (details) {
  //     console.log("Place details:", details);
  //     const newLocation = {
  //       latitude: details.geometry.location.lat,
  //       longitude: details.geometry.location.lng,
  //       latitudeDelta: LATITUDE_DELTA,
  //       longitudeDelta: LONGITUDE_DELTA,
  //     };
  //     setRegion(newLocation);
  //     setMarkerLocation(newLocation);

  //     // Animate map to new location
  //     mapRef.current?.animateToRegion(newLocation, 1000);
  //   }
  // };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.container}>
        <GooglePlacesAutocomplete
          placeholder='Search for a location'
          minLength={2}
          autoFocus={false}
          returnKeyType={"search"}
          fetchDetails={true}
          enablePoweredByContainer={false}
          onPress={(data, details = null) => {
            // alert("GooglePlacesAutocomplete onPress triggered!");
            console.log("GooglePlacesAutocomplete onPress triggered");
            setAutocompleteFocused(false); // Hide suggestions when selecting an option
            // console.log("Selected data:", data);
            try {
              handlePlaceSelected(data, details);
            } catch (error) {
              console.error("Error in onPress handler:", error);
            }
          }}
          onFail={(error) => {
            console.error("GooglePlacesAutocomplete failed:", error);
          }}
          onTimeout={() => {
            console.log("GooglePlacesAutocomplete timeout");
          }}
          query={{
            key: config.googleMapsApiKey,
            language: "en",
            components: "country:us",
            sensor: true,
            // strictbounds: true,
          }}
          // styles={{
          //   container: {
          //     ...styles.autocompleteContainer,
          //     zIndex: 9999,
          //     elevation: 10,
          //   },
          //   textInput: styles.autocompleteInput,
          //   listView: {
          //     ...styles.autocompleteList,
          //     zIndex: 9999,
          //     elevation: 10,
          //     backgroundColor: "white",
          //   },
          //   row: styles.autocompleteRow,
          //   description: styles.autocompleteDescription,
          // }}

          styles={{
            container: {
              ...styles.autocompleteContainer,
              position: "absolute", // Ensure it's above other elements
              top: 10, // Adjust position to be reachable
              left: 10,
              right: 10,
              zIndex: 9999,
              elevation: 10,
            },
            textInput: {
              ...styles.autocompleteInput,
              backgroundColor: "white", // Ensure it's visible
            },
            listView: {
              ...styles.autocompleteList,
              position: "absolute", // Ensure suggestions appear on top
              top: 50, // Adjust so it doesn't get hidden
              left: 0,
              right: 0,
              zIndex: 10000, // Higher than other elements
              elevation: 10,
              backgroundColor: "red",
            },
            row: {
              ...styles.autocompleteRow,
              padding: 10, // Increase touchable area
            },
            description: {
              ...styles.autocompleteDescription,
              fontSize: 16, // Ensure text is readable
            },
          }}
          // textInputProps={{
          //   clearButtonMode: "while-editing",
          //   onChangeText: (text) => {
          //     if (text) {
          //       console.log("Input text changed:", text);
          //     }
          //   },
          //   onFocus: () => console.log("Input focused"),
          //   onBlur: () => console.log("Input blurred"),
          // }}

          textInputProps={{
            clearButtonMode: "while-editing",
            onChangeText: (text) => {
              if (text !== lastTextRef.current) {
                // console.log("Input text changed:", text);
                lastTextRef.current = text;
              }
            },
            // onFocus: () => console.log("Input focused"),
            // onBlur: () => console.log("Input blurred"),
            onFocus: () => {
              console.log("Input focused");
              setAutocompleteFocused(true); // Ensure map interaction is disabled
            },
            onBlur: () => {
              console.log("Input blurred");
              setAutocompleteFocused(false); // Restore map interaction
            },
          }}
          nearbyPlacesAPI='GooglePlacesSearch'
          debounce={300}
          enableHighAccuracyLocation={true}
          timeout={20000}
          maximumAge={10000}
          GoogleReverseGeocodingQuery={{}}
          GooglePlacesSearchQuery={{
            rankby: "distance",
          }}
          GooglePlacesDetailsQuery={{
            fields: "formatted_address,geometry,name",
          }}
        />
        {/* <MapView ref={mapRef} style={styles.map} region={region} onRegionChangeComplete={setRegion} pointerEvents={lastTextRef.current.length > 0 ? "none" : "auto"}> */}
        <MapView
          ref={mapRef}
          style={styles.map}
          // pointerEvents='none' // Disables interaction to test
          pointerEvents={isAutocompleteFocused ? "none" : "auto"} // Disable only when needed
          initialRegion={DEFAULT_LOCATION} // Set initial region once, only on first render
          // region={isAutocompleteFocused ? region : undefined} // Only bind region when needed (e.g., after autocomplete selection)
          // onRegionChangeComplete={setRegion} // Update region state after interaction
        >
          <Marker
            coordinate={{
              latitude: markerLocation.latitude,
              longitude: markerLocation.longitude,
            }}
          />
        </MapView>

        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(true)}>
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(false)}>
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  map: {
    flex: 1,
  },
  autocompleteContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1,
    elevation: 3,
  },
  autocompleteInput: {
    height: 44,
    fontSize: 16,
    backgroundColor: "white",
    borderRadius: 5,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  autocompleteList: {
    backgroundColor: "white",
    borderRadius: 5,
    marginTop: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  autocompleteRow: {
    padding: 13,
    height: 44,
    flexDirection: "row",
  },
  autocompleteDescription: {
    fontSize: 14,
  },
  logoutButton: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "#f44336",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  logoutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  zoomControls: {
    position: "absolute",
    right: 16,
    top: "50%",
    backgroundColor: "transparent",
    transform: [{ translateY: -50 }],
  },
  zoomButton: {
    backgroundColor: "white",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  zoomButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    lineHeight: 28,
  },
});
