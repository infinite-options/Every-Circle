import React, { useState, useEffect, memo } from 'react';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
import { Typography, TextField, Box } from '@mui/material';


const LIBRARIES = ["places"];

function AutoComplete({ getAutoCompleteData, formData }) {
    const apiKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;
    const [autocomplete, setAutocomplete] = useState(null);
    const [businessName, setBusinessName] = useState(formData.businessName);
    console.log('autocomplete name', formData.businessName)

    useEffect(() => {
        setBusinessName(formData.businessName);
    }, [formData.businessName]);

    const onLoad = (autocomplete) => {
        setAutocomplete(autocomplete);
    };

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            console.log(place)
            if (place.name) {
                console.log("Place Name:", place.name);
                console.log("Address:", place.formatted_address);
                console.log("Place Type:", place.types);
                setBusinessName(place.name)

                const addressComponents = place.address_components;

                const getAddressComponent = (type) => {
                    const component = addressComponents.find((comp) => comp.types.includes(type));
                    return component ? component.long_name : "";
                };

                // Extract individual address parts
                const addressLine1 = getAddressComponent("street_number") + " " + getAddressComponent("route");
                const addressLine2 = getAddressComponent("subpremise");
                const city = getAddressComponent("locality"); 
                const state = getAddressComponent("administrative_area_level_1");
                const country = getAddressComponent("country"); 
                const zip = getAddressComponent("postal_code"); 
                getAutoCompleteData({
                    ...place,
                    addressLine1,
                    addressLine2,
                    city,
                    state,
                    country,
                    zip,
                });
            }
        }
    };

    return (
        <LoadScript
            googleMapsApiKey={apiKey}
            libraries={LIBRARIES}
        >
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ ml: 1, mr: 1 }}>
                        {"Business Name"}  <span style={{ color: "red" }}>*</span>
                    </Typography>
                </Box>
                <Autocomplete
                    onLoad={onLoad}
                    onPlaceChanged={onPlaceChanged}
                    options={{
                        fields: [
                            "place_id",
                            "name",
                            "formatted_address",
                            "geometry",
                            "types",
                            "website",
                            "formatted_phone_number",
                            "photos",
                            "rating",
                            "opening_hours",
                            "icon",
                            "price_level",
                            "address_components",
                        ],
                    }}
                >
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder='Enter a Business name'
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        sx={{
                            backgroundColor: "#e0e0e0",
                            borderRadius: 2,
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                            },
                        }}
                    />
                </Autocomplete>
            </Box>
        </LoadScript>
    );
}


export default AutoComplete;
