import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error("useDarkMode must be used within a DarkModeProvider");
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load dark mode setting from AsyncStorage on app start
  useEffect(() => {
    const loadDarkModeSetting = async () => {
      try {
        const savedDarkMode = await AsyncStorage.getItem("darkMode");
        if (savedDarkMode !== null) {
          setDarkMode(JSON.parse(savedDarkMode));
        }
      } catch (error) {
        console.error("Error loading dark mode setting:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDarkModeSetting();
  }, []);

  // Save dark mode setting to AsyncStorage whenever it changes
  const toggleDarkMode = async (newValue) => {
    try {
      const value = newValue !== undefined ? newValue : !darkMode;
      setDarkMode(value);
      await AsyncStorage.setItem("darkMode", JSON.stringify(value));
      console.log("Dark mode setting saved:", value);
    } catch (error) {
      console.error("Error saving dark mode setting:", error);
    }
  };

  const value = {
    darkMode,
    isLoading,
    toggleDarkMode,
    setDarkMode: toggleDarkMode,
  };

  return <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>;
};
