import React, { createContext, useState, useContext } from 'react';
import { useCookies, Cookies } from "react-cookie";

const UserContext = createContext();

export const UserProvider = ({ children, cookiesObj = new Cookies() }) => {
    const [cookies, setCookie] = useCookies(["user"]);
    const [user, setUser] = useState(cookies.user);


    const updateUser = (updates) => {
        setUser((prevUser) => {
            const newUserData = { ...prevUser, ...updates };
            // Perform side effects after updating state
            setCookie("user", newUserData);
            // Return the new state
            return newUserData;
          });
      };

      const logout = () => {
        // //console.log("In logout as ", user);
        sessionStorage.clear();
        cookiesObj.remove("user");
        window.location.href = "/";
      };

    return (
        <UserContext.Provider value={{ user, updateUser, logout }}>
            {children}
        </UserContext.Provider>
    )
}

export const useUserContext = () => useContext(UserContext);
