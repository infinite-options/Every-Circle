import React, { createContext, useState, useContext } from "react";

// Create the navigation context
const NavigationContext = createContext();

// Create a provider component
export const NavigationProvider = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState("Profile");

  const navigateTo = (screenName) => {
    console.log(`Navigating to ${screenName}`);
    setCurrentScreen(screenName);
  };

  return <NavigationContext.Provider value={{ currentScreen, navigateTo }}>{children}</NavigationContext.Provider>;
};

// Create a custom hook to use the navigation context
export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};
